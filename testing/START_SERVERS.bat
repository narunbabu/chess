@echo off
REM Chess-Web Testing - Start All Servers
REM This script starts Backend, Frontend, and WebSocket servers

echo ╔════════════════════════════════════════════════════════════╗
echo ║     Chess-Web Testing Environment Startup                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo [1/3] Starting Backend Server...
start "Chess-Web Backend" cmd /k "cd /d C:\ArunApps\Chess-Web\chess-backend && php artisan serve"
timeout /t 3 /nobreak >nul

echo [2/3] Starting WebSocket Server...
start "Chess-Web WebSocket" cmd /k "cd /d C:\ArunApps\Chess-Web\chess-backend && php artisan reverb:start"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Server...
start "Chess-Web Frontend" cmd /k "cd /d C:\ArunApps\Chess-Web\chess-frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ✅ All servers started!
echo.
echo Windows opened:
echo   - Backend:   http://localhost:8000
echo   - Frontend:  http://localhost:3000
echo   - WebSocket: ws://localhost:8080
echo.
echo Wait 10-15 seconds for all servers to initialize, then run:
echo   node testing/verify-environment.js
echo.
pause
