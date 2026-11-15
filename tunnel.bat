@echo off
title Dayline iPhone Tunnel
cd /d "%~dp0"
echo =======================================================
echo   Creating Secure HTTPS Link for iPhone / Mobile
echo =======================================================
echo.
echo Make sure Dayline is running (via start.bat or npm start)
echo.
echo Opening public HTTPS tunnel...
echo.
npx --yes localtunnel --port 3001
pause

