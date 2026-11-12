@ECHO OFF
REM Rotate pm2 logs (once per machine): 10MB files, keep 10, compressed
call pm2 describe pm2-logrotate >NUL 2>&1
IF ERRORLEVEL 1 (
    call pm2 install pm2-logrotate
    call pm2 set pm2-logrotate:max_size 10M
    call pm2 set pm2-logrotate:retain 10
    call pm2 set pm2-logrotate:compress true
)
IF NOT EXIST logs mkdir logs
pm2 start redroid.js --name redroid --log logs\redroid.log
