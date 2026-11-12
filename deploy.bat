@ECHO OFF
cd /d "%~dp0" || exit /b 1
node deploy.js
pause
