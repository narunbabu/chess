# Test Tutorial Backend
Write-Host "Testing Tutorial Backend API..." -ForegroundColor Green

# Test 1: Check if backend is running
Write-Host "`nTest 1: Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/tutorial/modules" -Method Get -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend is running" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        Write-Host "  Modules found: $($data.data.Count)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Backend is not running. Start it with: php artisan serve" -ForegroundColor Red
    exit 1
}

# Test 2: Verify database has data
Write-Host "`nTest 2: Verifying database content..." -ForegroundColor Yellow
cd chess-backend
$moduleCount = php artisan tinker --execute="echo App\Models\TutorialModule::count();"
$lessonCount = php artisan tinker --execute="echo App\Models\TutorialLesson::count();"
$stageCount = php artisan tinker --execute="echo App\Models\InteractiveLessonStage::count();"

Write-Host "✓ Tutorial Modules: $moduleCount" -ForegroundColor Green
Write-Host "✓ Tutorial Lessons: $lessonCount" -ForegroundColor Green
Write-Host "✓ Interactive Stages: $stageCount" -ForegroundColor Green

# Test 3: Verify specific FEN positions
Write-Host "`nTest 3: Verifying fixed FEN positions..." -ForegroundColor Yellow

# Check Knight Jumping FEN
$knightFen = sqlite3 database/database.sqlite "SELECT initial_fen FROM interactive_lesson_stages WHERE title = 'Knight Jumping';"
Write-Host "Knight Jumping FEN: $knightFen" -ForegroundColor Cyan
if ($knightFen -eq "4k3/8/4p3/8/3N4/3P4/8/4K3 w - - 0 1") {
    Write-Host "  ✓ Knight Jumping FEN is correct!" -ForegroundColor Green
} else {
    Write-Host "  ✗ Knight Jumping FEN is incorrect!" -ForegroundColor Red
}

# Check King Safety FEN
$kingFen = sqlite3 database/database.sqlite "SELECT initial_fen FROM interactive_lesson_stages WHERE title = 'King Safety';"
Write-Host "King Safety FEN: $kingFen" -ForegroundColor Cyan
if ($kingFen -eq "4r3/8/8/8/8/8/8/4K3 w - - 0 1") {
    Write-Host "  ✓ King Safety FEN is correct!" -ForegroundColor Green
} else {
    Write-Host "  ✗ King Safety FEN is incorrect!" -ForegroundColor Red
}

cd ..
Write-Host "`n✅ All backend tests completed!" -ForegroundColor Green
