# Start All Chess-Web Servers
# This script starts all required servers for the Chess-Web application

Write-Host "🚀 Starting Chess-Web Servers..." -ForegroundColor Cyan
Write-Host ""

# Start Laravel Backend (Port 8000)
Write-Host "1️⃣  Starting Laravel Backend Server (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\ArunApps\Chess-Web\chess-backend'; Write-Host '🟢 Laravel Backend Running on http://localhost:8000' -ForegroundColor Green; php artisan serve --host=0.0.0.0 --port=8000"
)

Start-Sleep -Seconds 2

# Start Reverb WebSocket Server (Port 8080)
Write-Host "2️⃣  Starting Reverb WebSocket Server (Port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\ArunApps\Chess-Web\chess-backend'; Write-Host '🔌 Reverb WebSocket Running on http://localhost:8080' -ForegroundColor Green; php artisan reverb:start"
)

Start-Sleep -Seconds 2

# Start React Frontend (Port 3000)
Write-Host "3️⃣  Starting React Frontend (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\ArunApps\Chess-Web\chess-frontend'; Write-Host '⚛️  React Frontend Running on http://localhost:3000' -ForegroundColor Green; pnpm start"
)

Write-Host ""
Write-Host "✅ All servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Server URLs:" -ForegroundColor Cyan
Write-Host "   Backend:    http://localhost:8000" -ForegroundColor White
Write-Host "   WebSocket:  http://localhost:8080" -ForegroundColor White
Write-Host "   Frontend:   http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Close all PowerShell windows to stop all servers" -ForegroundColor Magenta
