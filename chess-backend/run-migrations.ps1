# Quick Migration Script
Write-Host "Running database migrations..." -ForegroundColor Cyan

# Clear caches
php artisan config:clear | Out-Null
php artisan cache:clear | Out-Null

# Run migrations
php artisan migrate:fresh --seed --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starting Laravel server..." -ForegroundColor Yellow
    php artisan serve
} else {
    Write-Host ""
    Write-Host "✗ Migrations failed!" -ForegroundColor Red
    Write-Host "Check the errors above for details" -ForegroundColor Yellow
    exit 1
}
