@echo off
title Dayline
cd /d "%~dp0"
echo ==============================================
echo   Starting Dayline Personal Task & Workspace
echo   URL: http://localhost:3001
echo ==============================================
echo.
timeout /t 1 /nobreak >nul
start http://localhost:3001
node server/index.js
pause

