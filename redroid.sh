#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec pm2 start redroid.js --name redroid --log redroid.log
