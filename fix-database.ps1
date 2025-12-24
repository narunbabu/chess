# Database Fix Script
# Run this with: powershell.exe -ExecutionPolicy Bypass -File fix-database.ps1

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Chess-Web Database Fix Script" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all PHP processes
Write-Host "Step 1: Stopping all PHP processes..." -ForegroundColor Yellow
$phpProcesses = Get-Process | Where-Object { $_.ProcessName -eq 'php' }
if ($phpProcesses) {
    Write-Host "  Found $($phpProcesses.Count) PHP process(es). Stopping..." -ForegroundColor Yellow
    $phpProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  OK PHP processes stopped" -ForegroundColor Green
} else {
    Write-Host "  OK No PHP processes running" -ForegroundColor Green
}

# Step 2: Navigate to backend directory
Write-Host ""
Write-Host "Step 2: Navigating to backend directory..." -ForegroundColor Yellow
$backendPath = "C:\ArunApps\Chess-Web\chess-backend"
if (Test-Path $backendPath) {
    Set-Location $backendPath
    Write-Host "  OK Changed to: $backendPath" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Backend directory not found!" -ForegroundColor Red
    exit 1
}

# Step 3: Delete lock files
Write-Host ""
Write-Host "Step 3: Removing SQLite lock files..." -ForegroundColor Yellow
$lockFiles = @(
    "database\database.sqlite-shm",
    "database\database.sqlite-wal"
)

foreach ($file in $lockFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force -ErrorAction SilentlyContinue
        Write-Host "  OK Deleted: $file" -ForegroundColor Green
    } else {
        Write-Host "  - Not found: $file (OK)" -ForegroundColor Gray
    }
}

# Step 4: Backup existing database (if it exists)
Write-Host ""
Write-Host "Step 4: Backing up existing database..." -ForegroundColor Yellow
$dbFile = "database\database.sqlite"
$backupFile = "database\database.sqlite.backup." + (Get-Date -Format "yyyyMMdd_HHmmss")

if (Test-Path $dbFile) {
    try {
        Copy-Item $dbFile $backupFile -ErrorAction Stop
        Write-Host "  OK Backup created: $backupFile" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Could not create backup (file may be locked)" -ForegroundColor Yellow
    }
}

# Step 5: Remove corrupted database
Write-Host ""
Write-Host "Step 5: Removing corrupted database..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

if (Test-Path $dbFile) {
    try {
        Remove-Item $dbFile -Force -ErrorAction Stop
        Write-Host "  OK Deleted corrupted database" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Cannot delete database (still locked)" -ForegroundColor Red
        Write-Host "  Please close all applications that might be using the database:" -ForegroundColor Red
        Write-Host "    - DB Browser for SQLite" -ForegroundColor Red
        Write-Host "    - VS Code" -ForegroundColor Red
        Write-Host "    - Any other database tools" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Then run this script again." -ForegroundColor Red
        exit 1
    }
}

# Step 6: Create fresh database
Write-Host ""
Write-Host "Step 6: Creating fresh database..." -ForegroundColor Yellow
try {
    New-Item $dbFile -ItemType File -Force | Out-Null
    Write-Host "  OK Fresh database created" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Could not create database file" -ForegroundColor Red
    exit 1
}

# Step 7: Run migrations
Write-Host ""
Write-Host "Step 7: Running database migrations..." -ForegroundColor Yellow
Write-Host "  This may take a minute..." -ForegroundColor Gray
try {
    $output = & php artisan migrate --force 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Migrations completed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Migration failed:" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERROR: Error running migrations: $_" -ForegroundColor Red
    exit 1
}

# Step 8: Test database connection
Write-Host ""
Write-Host "Step 8: Testing database connection..." -ForegroundColor Yellow
try {
    $testOutput = & php artisan tinker --execute="echo 'DB Test: ' . DB::connection()->getPdo()->getAttribute(PDO::ATTR_SERVER_VERSION);" 2>&1
    if ($testOutput -match "DB Test:") {
        Write-Host "  OK Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Could not verify database connection" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  WARNING: Could not test connection" -ForegroundColor Yellow
}

# Step 9: Summary
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Fix Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start Laravel server:" -ForegroundColor White
Write-Host "     cd $backendPath" -ForegroundColor Gray
Write-Host "     php artisan serve" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Test your application:" -ForegroundColor White
Write-Host "     http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. You will need to:" -ForegroundColor White
Write-Host "     - Register a new account (data was reset)" -ForegroundColor Gray
Write-Host "     - Or seed test data with: php artisan db:seed" -ForegroundColor Gray
Write-Host ""

if (Test-Path $backupFile) {
    Write-Host "Note: Your old database was backed up to:" -ForegroundColor Cyan
    Write-Host "  $backupFile" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Press any key to start Laravel server..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Start Laravel server
Write-Host ""
Write-Host "Starting Laravel server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

& php artisan serve
