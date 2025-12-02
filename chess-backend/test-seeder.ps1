# Test GeneratedChallengesSeeder
# Run from chess-backend directory: powershell.exe -File test-seeder.ps1

Write-Host "🧪 Testing GeneratedChallengesSeeder..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "artisan")) {
    Write-Host "❌ Error: Must be run from chess-backend directory" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Current lesson count:" -ForegroundColor Yellow
php artisan tinker --execute="echo 'Total Lessons: ' . App\Models\TutorialLesson::count() . PHP_EOL;"

Write-Host ""
Write-Host "🚀 Running GeneratedChallengesSeeder..." -ForegroundColor Green
php artisan db:seed --class=GeneratedChallengesSeeder

Write-Host ""
Write-Host "📊 New lesson count:" -ForegroundColor Yellow
php artisan tinker --execute="echo 'Total Lessons: ' . App\Models\TutorialLesson::count() . PHP_EOL;"

Write-Host ""
Write-Host "🔍 Checking new lessons:" -ForegroundColor Yellow
php artisan tinker --execute="`$newLessons = App\Models\TutorialLesson::whereIn('slug', ['knight-fork-royal-family', 'bishop-movement-fundamentals'])->get(['id', 'title', 'lesson_type', 'xp_reward']); foreach (`$newLessons as `$lesson) { echo '✅ ' . `$lesson->title . ' (' . `$lesson->lesson_type . ') - ' . `$lesson->xp_reward . ' XP' . PHP_EOL; }"

Write-Host ""
Write-Host "🎉 Test complete! Navigate to /tutorial in your browser to see the new challenges." -ForegroundColor Green
