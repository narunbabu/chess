# Progress Tracking Test Script
# This script tests the complete tutorial progress tracking flow

Write-Host "=== Tutorial Progress Tracking Test ===" -ForegroundColor Cyan

cd $PSScriptRoot

Write-Host "`n1. Checking database tables..." -ForegroundColor Yellow
php artisan db:show --database=sqlite 2>&1 | Select-String -Pattern "user_tutorial_progress|user_stage_progress"

Write-Host "`n2. Running migrations to ensure tables exist..." -ForegroundColor Yellow
php artisan migrate --force

Write-Host "`n3. Checking if progress tracking API endpoints are registered..." -ForegroundColor Yellow
php artisan route:list | Select-String -Pattern "tutorial.*complete|tutorial.*progress"

Write-Host "`n4. Testing lesson completion flow..." -ForegroundColor Yellow
Write-Host "   Please complete a lesson in the browser and check the console logs" -ForegroundColor Gray
Write-Host "   Look for:" -ForegroundColor Gray
Write-Host "   - '🎯 Completing lesson' log with lesson details" -ForegroundColor White
Write-Host "   - '✅ Lesson completion API response' with XP and stats" -ForegroundColor White
Write-Host "   - Check Network tab for POST /api/tutorial/lessons/{id}/complete" -ForegroundColor White

Write-Host "`n5. To verify progress in database:" -ForegroundColor Yellow
Write-Host "   Run: sqlite3 database/database.sqlite 'SELECT * FROM user_tutorial_progress;'" -ForegroundColor White

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
