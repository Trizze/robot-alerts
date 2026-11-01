#!/usr/bin/env python3
"""Owner-run only. The authorization URL is shown in the owner's terminal, not AI logs."""
import json
import subprocess
import sys
import urllib.parse


def server(request):
    result = subprocess.run([
        'ssh', '-T', '-o', 'BatchMode=yes', 'universe',
        'sudo -n docker exec -i robot-alerts node shared-service/src/bot-setup-cli.js',
    ], input=json.dumps(request), text=True, capture_output=True, timeout=20)
    if result.returncode:
        raise RuntimeError('Cannot reach bot setup. Check universe-admin access and the service version.')
    try:
        return json.loads(result.stdout)
    except Exception:
        raise RuntimeError('Unexpected setup response; no credential values displayed.') from None


def main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise RuntimeError('Run npm run setup:bot yourself in an interactive terminal.')
    gate = subprocess.run(['universe-admin', 'status'], text=True, capture_output=True, timeout=10)
    if gate.returncode or 'UNLOCKED' not in gate.stdout:
        raise RuntimeError('Run universe-admin 1, then npm run setup:bot again.')
    setup = server({'action': 'start'})
    url = urllib.parse.urlsplit(setup.get('url', ''))
    if url.scheme != 'https' or url.netloc != 'id.twitch.tv' or url.path != '/oauth2/authorize':
        raise RuntimeError('Unexpected authorization address; nothing opened.')
    print('\nAuthorize TrizzeBot for Robot Alerts\n')
    print('Open this Twitch link while logged in as TrizzeBot:')
    print(setup['url'])
    print('\nAny browser or private window works. No Robot Alerts website login is needed.')
    print('Approve the chat permission. This link expires in 10 minutes and works once.')
    print('No client secret, access token or refresh token is requested or displayed.')
    while True:
        input('\nAfter clicking Authorize, press Enter here to confirm (Ctrl+C to stop): ')
        status = server({'action': 'status', 'hash': setup['hash']}).get('status')
        if status == 'complete':
            print('TrizzeBot authorized successfully. Trizze\'s enabled announcements are ready.')
            return
        if status in ('failed', 'expired'):
            raise RuntimeError('Authorization failed or expired. Check that Twitch is signed in as TrizzeBot, then rerun npm run setup:bot.')
        print('Still waiting for Twitch authorization. Finish in your browser, then press Enter again.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nStopped. The setup link expires automatically; existing bot authorization is unchanged.')
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Setup failed; no credential values displayed.', file=sys.stderr)
        sys.exit(1)
