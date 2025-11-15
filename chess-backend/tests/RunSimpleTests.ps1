# Simple test runner for tournament generation system

Write-Host "Starting Tournament Generation Test Suite..." -ForegroundColor Cyan

# Set project root
$projectRoot = Get-Location
Set-Location $projectRoot

Write-Host "Project root: $projectRoot" -ForegroundColor Green

# Check if we're in Laravel directory
if (-not (Test-Path "artisan")) {
    Write-Host "Error: artisan file not found. Please run from Laravel root directory." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Laravel project detected" -ForegroundColor Green

# Run database setup
Write-Host "Setting up test database..." -ForegroundColor Yellow
try {
    php tests/Setup/CreateTestDatabase.php setup
    Write-Host "✅ Database setup completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Database setup failed: $_" -ForegroundColor Red
    exit 1
}

# Run unit tests
Write-Host "`nRunning Unit Tests..." -ForegroundColor Yellow

$unitTests = @(
    "tests/Unit/Services/TournamentGenerationServiceTest.php",
    "tests/Unit/ValueObjects/TournamentConfigTest.php",
    "tests/Unit/Services/TournamentTransactionTest.php"
)

foreach ($testFile in $unitTests) {
    Write-Host "Running: $testFile" -ForegroundColor Cyan
    try {
        $result = php artisan test $testFile --verbose
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PASSED: $testFile" -ForegroundColor Green
        } else {
            Write-Host "❌ FAILED: $testFile" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ ERROR: $testFile - $_" -ForegroundColor Red
    }
}

# Run feature tests
Write-Host "`nRunning Feature Tests..." -ForegroundColor Yellow

$featureTests = @(
    "tests/Feature/Controllers/ChampionshipMatchControllerTest.php"
)

foreach ($testFile in $featureTests) {
    Write-Host "Running: $testFile" -ForegroundColor Cyan
    try {
        $result = php artisan test $testFile --verbose
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PASSED: $testFile" -ForegroundColor Green
        } else {
            Write-Host "❌ FAILED: $testFile" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ ERROR: $testFile - $_" -ForegroundColor Red
    }
}

# Generate coverage report
Write-Host "`nGenerating Coverage Report..." -ForegroundColor Yellow
try {
    php artisan test --coverage-html reports/coverage
    Write-Host "✅ Coverage report generated in reports/coverage" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Coverage generation failed, but tests may have passed" -ForegroundColor Yellow
}

Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "Test Execution Complete!" -ForegroundColor Green
Write-Host "="*60 -ForegroundColor Cyan