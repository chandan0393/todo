@echo off
title Dayline (Development Mode)
cd /d "%~dp0"
echo ==============================================
echo   Starting Dayline in Development Mode
echo   Client: http://localhost:5173
echo   API:    http://localhost:3001
echo ==============================================
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
npm run dev
pause

