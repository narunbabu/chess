# Start Laravel Reverb WebSocket Server
# Run this script to start the WebSocket server for real-time features

Write-Host "🚀 Starting Laravel Reverb WebSocket Server..." -ForegroundColor Cyan
Write-Host ""

Set-Location -Path "C:\ArunApps\Chess-Web\chess-backend"

Write-Host "📍 Location: $PWD" -ForegroundColor Yellow
Write-Host "🌐 Server: http://localhost:8080" -ForegroundColor Green
Write-Host "🔑 App Key: anrdh24nppf3obfupvqw" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

php artisan reverb:start
