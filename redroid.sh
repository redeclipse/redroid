#!/bin/sh
cd "$(dirname "$0")" || exit 1
# Rotate pm2 logs (once per machine): 10MB files, keep 10, compressed
if ! pm2 describe pm2-logrotate >/dev/null 2>&1; then
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 10
    pm2 set pm2-logrotate:compress true
fi
mkdir -p logs
exec pm2 start redroid.js --name redroid --log logs/redroid.log
