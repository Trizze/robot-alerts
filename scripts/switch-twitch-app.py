#!/usr/bin/env python3
"""Owner-run only: private prompts on marvin, scoped migration on universe.

Never invoke main() through an AI terminal. No credentials in arguments/logs.
Only this explicitly requested helper privately reads/updates the server env file.
"""
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import warnings

ENV_PATH = '/etc/robot-alerts/robot-alerts.env'
CALLBACK = 'https://trizze.tv/robot/api/auth/callback'


def valid_credential(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{10,256}', value):
        raise ValueError('Invalid credential format; nothing changed.')
    return value


def replacement_env(text, client_id, client_secret, webhook_secret):
    replacements = {
        'TWITCH_CLIENT_ID': valid_credential(client_id),
        'TWITCH_CLIENT_SECRET': valid_credential(client_secret),
        'TWITCH_WEBHOOK_SECRET': valid_credential(webhook_secret),
    }
    lines = text.splitlines(keepends=True)
    required = set(replacements) | {'DATA_ENCRYPTION_KEY', 'PATTERN_SEED'}
    found = {key: 0 for key in required}
    for line in lines:
        name, sep, value = line.rstrip('\r\n').partition('=')
        if sep and name in found:
            found[name] += 1
            if not value:
                raise ValueError('Existing configuration is incomplete; nothing changed.')
    if any(n != 1 for n in found.values()):
        raise ValueError('Missing or duplicate configuration entries; nothing changed.')
    result = []
    for line in lines:
        name = line.partition('=')[0]
        if name in replacements:
            ending = '\r\n' if line.endswith('\r\n') else '\n'
            result.append(name + '=' + replacements[name] + ending)
        else:
            result.append(line)
    return ''.join(result)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_new_app(client_id, client_secret):
    # The temporary app token is discarded privately; never returned or printed.
    payload = urllib.parse.urlencode({
        'client_id': client_id, 'client_secret': client_secret,
        'grant_type': 'client_credentials',
    }).encode('ascii')
    request = urllib.request.Request(
        'https://id.twitch.tv/oauth2/token', data=payload, method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=8) as response:
            data = json.loads(response.read(65536))
            if not isinstance(data.get('access_token'), str) or not data['access_token']:
                raise ValueError()
    except Exception:
        raise ValueError('Twitch could not validate the new credentials. Nothing changed.') from None


def atomic_env_write(text):
    fd, name = tempfile.mkstemp(prefix='.robot-app-', dir='/etc/robot-alerts')
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf8', newline='') as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, ENV_PATH)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def docker(*args, input=None):
    # Capture all subprocess output; never echo Docker config, logs or raw errors.
    result = subprocess.run(['docker', *args], input=input, text=True,
                            capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('Robot Alerts Docker operation failed.')
    return result.stdout.strip()


def healthy():
    for _ in range(15):
        result = subprocess.run(['docker', 'exec', 'robot-alerts', 'node', '-e',
            'fetch("http://127.0.0.1:8080/healthz",{signal:AbortSignal.timeout(2000)})'
            '.then(r=>process.exit(r.status===204?0:1)).catch(()=>process.exit(1))'],
            capture_output=True, timeout=5)
        if result.returncode == 0:
            return True
        time.sleep(1)
    return False


def server_main(maintenance_js):
    if os.geteuid() != 0:
        raise RuntimeError('Server helper requires the existing unlocked admin gate.')
    pair = json.loads(sys.stdin.read(4096))
    client_id = valid_credential(pair['clientId'])
    client_secret = valid_credential(pair['clientSecret'])
    parent = os.stat('/etc/robot-alerts', follow_symlinks=False)
    info = os.stat(ENV_PATH, follow_symlinks=False)
    if (not stat.S_ISDIR(parent.st_mode) or parent.st_uid != 0 or parent.st_mode & 0o022
            or not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077):
        raise RuntimeError('Private configuration permissions need owner review; nothing changed.')
    # Explicit owner-authorized migration: preserve existing private keys verbatim.
    fd = os.open(ENV_PATH, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, encoding='utf8', newline='') as existing:
        old_env = existing.read()
    if any(line == 'TWITCH_CLIENT_ID=' + client_id for line in old_env.splitlines()):
        raise ValueError('That is the current app. Use the new Robot Alerts application.')
    next_env = replacement_env(old_env, client_id, client_secret, secrets.token_hex(32))
    validate_new_app(client_id, client_secret)
    image = docker('inspect', '--format', '{{.Image}}', 'robot-alerts')
    running = docker('inspect', '--format', '{{.State.Running}}', 'robot-alerts')
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image) or running != 'true':
        raise RuntimeError('The existing Robot Alerts container must be running.')
    old_name = 'robot-alerts-before-app-switch-' + time.strftime('%Y%m%d%H%M%S')
    renamed = False
    env_changed = False
    new_created = False
    stopped = False
    cleared = False
    try:
        docker('stop', 'robot-alerts')
        stopped = True
        docker('run', '--rm', '--pull=never', '--network=none',
               '--memory=192m', '--memory-swap=192m', '--cpus=0.5', '--log-driver=none',
               '--env-file', ENV_PATH,
               '--mount', 'type=bind,src=/srv/robot-alerts/data,dst=/data',
               image, 'node', '--input-type=module', '-e', maintenance_js)
        cleared = True
        docker('rename', 'robot-alerts', old_name)
        renamed = True
        env_changed = True
        atomic_env_write(next_env)
        docker('run', '-d', '--name', 'robot-alerts', '--pull=never',
               '--restart', 'unless-stopped', '--memory=192m', '--memory-swap=192m',
               '--cpus=0.5', '--log-driver=json-file', '--log-opt', 'max-size=5m',
               '--log-opt', 'max-file=2', '--publish', '127.0.0.1:8100:8080',
               '--mount', 'type=bind,src=/srv/robot-alerts/data,dst=/data',
               '--env-file', ENV_PATH, '--env', 'OPERATOR_TWITCH_ID=14824099',
               '--env', 'TWITCH_BOT_LOGIN=TrizzeBot', '--env', 'ANONYMOUS_ROBOT_SCOPE=channel', image)
        new_created = True
        if not healthy():
            raise RuntimeError('New configuration did not become healthy.')
    except Exception:
        try:
            # A failed docker run may still have created a stopped container.
            if renamed:
                exists = subprocess.run(['docker', 'inspect', '--format', '{{.Name}}', 'robot-alerts'],
                                        capture_output=True, timeout=10).returncode == 0
                if new_created or exists:
                    subprocess.run(['docker', 'stop', 'robot-alerts'], capture_output=True, timeout=30)
                    docker('rename', 'robot-alerts', old_name + '-failed')
            if env_changed:
                atomic_env_write(old_env)
            if renamed:
                docker('rename', old_name, 'robot-alerts')
            if stopped:
                docker('start', 'robot-alerts')
        except Exception:
            raise RuntimeError('Recovery needs owner help. No earned data was deleted; do not rerun blindly.') from None
        suffix = ' Reconnect accounts to restore alerts.' if cleared else ''
        raise RuntimeError('Switch failed; the previous app configuration was restored.' + suffix) from None
    print('Robot Alerts app switched. Service health: OK. Credentials: ***')
    print('Points, patterns, size, chest display and channel settings were preserved.')
    print('Old logins and authorizations were cleared. Reconnect every streamer, then TrizzeBot.')
    print('Previous stopped container retained as ' + old_name)


def main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise RuntimeError('Run this yourself in an interactive SSH terminal. Do not pipe credentials.')
    gate = subprocess.run(['universe-admin', 'status'], capture_output=True, text=True, timeout=10)
    if gate.returncode != 0 or 'UNLOCKED' not in gate.stdout:
        raise RuntimeError('Run universe-admin 1 yourself first, then run this script again.')
    print('ROBOT ALERTS — switch the hosted Twitch application')
    print('Register the new application under trizze at https://dev.twitch.tv/console/apps')
    print('Name: Robot Alerts | Confidential | Website Integration')
    print('Redirect: ' + CALLBACK)
    print('Only the hosted Robot Alerts service changes; other apps and the local .env are untouched.')
    print('Each streamer and the bot must reconnect. Points and patterns stay intact.')
    if input('Type SWITCH to continue: ').strip() != 'SWITCH':
        print('Cancelled. Nothing changed.')
        return
    warnings.simplefilter("error", getpass.GetPassWarning)
    client_id = valid_credential(getpass.getpass('New Client ID (hidden): '))
    client_secret = valid_credential(getpass.getpass('New Client Secret (hidden): '))
    source = Path(__file__).read_text(encoding='utf8')
    maintenance = Path(__file__).with_name('switch-app-maintenance.js').read_text(encoding='utf8')
    maintenance += '''\nconst { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(process.env.DATA_PATH || '/data/robot-alerts.sqlite');
try { resetAppAuthorizations(db, Buffer.from(process.env.DATA_ENCRYPTION_KEY || '', 'base64')); }
finally { db.close(); }\n'''
    # Non-secret source goes in the command. Secrets go only through encrypted stdin.
    remote = source.rsplit("\nif __name__ == '__main__':", 1)[0]
    remote += '\ntry:\n server_main(' + repr(maintenance) + ')\nexcept Exception as error:\n print(str(error) if isinstance(error, (ValueError, RuntimeError)) else "Setup failed safely; no credential values displayed.",file=sys.stderr)\n sys.exit(1)\n'
    import shlex
    command = 'sudo -n python3 -c ' + shlex.quote(remote)
    print("Switching the hosted app privately; keep this terminal open until it finishes.")
    result = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', 'universe', command],
                            input=json.dumps({'clientId': client_id, 'clientSecret': client_secret}),
                            text=True, capture_output=True, timeout=240)
    # Remote helper only emits fixed messages. Never forward arbitrary SSH stderr.
    if result.returncode:
        allowed = [line for line in result.stderr.splitlines() if line.startswith((
            'Twitch could not validate', 'That is the current app.', 'Switch failed;',
            'Recovery needs owner help.', 'Private configuration permissions',
            'The existing Robot Alerts', 'Missing or duplicate', 'Existing configuration'))]
        raise RuntimeError(allowed[-1] if allowed else 'Setup did not finish. Check universe-admin access; do not share secrets or raw logs.')
    for line in result.stdout.splitlines():
        if line.startswith(('Robot Alerts app switched.', 'Points, patterns,', 'Old logins and', 'Previous stopped container')):
            print(line)
    print('Next: https://trizze.tv/robot/start/ — reconnect trizze and itsTrizze.')
    print('Then run npm run setup:bot in this terminal and open its Twitch link as TrizzeBot.')
    print('Each streamer uses Connect TrizzeBot to enable announcements in their own channel.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled. No credential values displayed.', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(str(error) if isinstance(error, (ValueError, RuntimeError)) else
              'Setup could not finish; no credential values displayed.', file=sys.stderr)
        sys.exit(1)
