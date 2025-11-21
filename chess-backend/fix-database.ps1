# Fix Database and Setup Script
# Run this from chess-backend directory

Write-Host "===== Chess Backend Database Fix =====" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running servers
Write-Host "Step 1: Cleaning up..." -ForegroundColor Yellow
try {
    Stop-Process -Name "php" -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Stopped running PHP processes" -ForegroundColor Green
} catch {
    Write-Host "ℹ No PHP processes to stop" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Step 2: Remove old database
Write-Host ""
Write-Host "Step 2: Removing old database..." -ForegroundColor Yellow
if (Test-Path "database\database.sqlite") {
    Remove-Item "database\database.sqlite" -Force
    Write-Host "✓ Removed old database" -ForegroundColor Green
} else {
    Write-Host "ℹ No old database found" -ForegroundColor Gray
}

# Step 3: Create fresh database
Write-Host ""
Write-Host "Step 3: Creating fresh SQLite database..." -ForegroundColor Yellow
New-Item -Path "database\database.sqlite" -ItemType File -Force | Out-Null
Write-Host "✓ Created database file" -ForegroundColor Green

# Step 4: Clear all caches
Write-Host ""
Write-Host "Step 4: Clearing Laravel caches..." -ForegroundColor Yellow
php artisan config:clear 2>&1 | Out-Null
php artisan cache:clear 2>&1 | Out-Null
php artisan route:clear 2>&1 | Out-Null
php artisan view:clear 2>&1 | Out-Null
Write-Host "✓ Cleared all caches" -ForegroundColor Green

# Step 5: Run migrations
Write-Host ""
Write-Host "Step 5: Running migrations and seeders..." -ForegroundColor Yellow
Write-Host "This may take a minute..." -ForegroundColor Gray
php artisan migrate:fresh --seed --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Migrations completed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Migrations failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
    exit 1
}

# Step 6: Verify tables
Write-Host ""
Write-Host "Step 6: Verifying database tables..." -ForegroundColor Yellow
$tables = sqlite3 database\database.sqlite ".tables" 2>&1
if ($tables -match "personal_access_tokens") {
    Write-Host "✓ Database tables created successfully" -ForegroundColor Green
    Write-Host "Tables: $tables" -ForegroundColor Gray
} else {
    Write-Host "⚠ Warning: Could not verify tables" -ForegroundColor Yellow
}

# Step 7: Success message
Write-Host ""
Write-Host "===== Setup Complete! =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: php artisan serve" -ForegroundColor White
Write-Host "2. In a new terminal, run: php artisan reverb:start" -ForegroundColor White
Write-Host "3. In a new terminal, run: npm start (from chess-frontend)" -ForegroundColor White
Write-Host ""
Write-Host "Would you like to start the Laravel server now? (Y/N)" -ForegroundColor Cyan
$response = Read-Host

if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Host "Starting Laravel server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    php artisan serve
}
