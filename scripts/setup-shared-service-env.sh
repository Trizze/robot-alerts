#!/bin/bash
# Run interactively by the server owner; never run this through an AI terminal.
set -euo pipefail
if [[ "$EUID" != 0 || ! -t 0 ]]; then
  echo 'Run this yourself in an interactive terminal using sudo.' >&2
  exit 1
fi
if [[ -e /etc/robot-alerts/robot-alerts.env || -L /etc/robot-alerts/robot-alerts.env ]]; then
  echo 'Configuration already exists; refusing to overwrite it.' >&2
  exit 1
fi
read -r -s -p 'Twitch Client ID (hidden): ' ROBOT_SETUP_CLIENT_ID
printf '\n'
read -r -s -p 'Twitch Client Secret (hidden): ' ROBOT_SETUP_CLIENT_SECRET
printf '\n'
export ROBOT_SETUP_CLIENT_ID ROBOT_SETUP_CLIENT_SECRET
python3 - <<'PY'
import base64
import os
import re
import secrets

client_id = os.environ['ROBOT_SETUP_CLIENT_ID']
client_secret = os.environ['ROBOT_SETUP_CLIENT_SECRET']
if not all(re.fullmatch(r'[A-Za-z0-9_-]{1,256}', value) for value in (client_id, client_secret)):
    raise SystemExit('Invalid credential format; nothing written.')
values = {
    'PUBLIC_BASE_URL': 'https://trizze.tv/robot/api/',
    'FRONTEND_URL': 'https://trizze.tv/robot/',
    'TWITCH_CLIENT_ID': client_id,
    'TWITCH_CLIENT_SECRET': client_secret,
    'TWITCH_WEBHOOK_SECRET': secrets.token_hex(32),
    'DATA_ENCRYPTION_KEY': base64.b64encode(os.urandom(32)).decode('ascii'),
    'PATTERN_SEED': base64.b64encode(os.urandom(32)).decode('ascii'),
    'DATA_PATH': '/data/robot-alerts.sqlite',
    'PORT': '8080',
}
os.umask(0o077)
fd = os.open('/etc/robot-alerts/robot-alerts.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(''.join(f'{name}={value}\n' for name, value in values.items()))
print('Private configuration created. No credential values were displayed.')
PY
unset ROBOT_SETUP_CLIENT_ID ROBOT_SETUP_CLIENT_SECRET
