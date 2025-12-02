# Navigate to chess-backend directory
cd $PSScriptRoot

Write-Host "Running database migrations..." -ForegroundColor Cyan

# Run migrations
php artisan migrate --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Migrations completed successfully!" -ForegroundColor Green

    Write-Host "`nVerifying progress tables..." -ForegroundColor Cyan
    php artisan db:show

    Write-Host "`nProgress tracking tables should now be available:" -ForegroundColor Yellow
    Write-Host "  - user_tutorial_progress" -ForegroundColor White
    Write-Host "  - user_stage_progress" -ForegroundColor White
} else {
    Write-Host "`n❌ Migration failed! Please check the error messages above." -ForegroundColor Red
    exit 1
}
