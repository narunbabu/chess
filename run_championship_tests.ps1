# Comprehensive Championship Tournament Test Runner
# Tests all 3 phases of the championship match-making enhancement

param(
    [switch]$SkipUnit = $false,
    [switch]$SkipFeature = $false,
    [switch]$SkipIntegration = $false,
    [switch]$SkipWebSocket = $false,
    [switch]$Coverage = $false,
    [switch]$Verbose = $false
)

Write-Host "🎯 Championship Tournament Test Suite" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPath = Join-Path $ProjectRoot "chess-backend"
$FrontendPath = Join-Path $ProjectRoot "chess-frontend"

# Function to run tests in PowerShell
function Invoke-LaravelTests {
    param(
        [string]$TestType,
        [string]$TestPath,
        [hashtable]$Options = @{}
    )

    Write-Host "🧪 Running $TestType tests..." -ForegroundColor Yellow

    $TestCommand = "cd '$BackendPath'; php artisan test $TestPath --no-coverage"

    if ($Options.Verbose) {
        $TestCommand += " --verbose"
    }

    if ($Options.Coverage) {
        $TestCommand = "cd '$BackendPath'; php artisan test $TestPath --coverage --coverage-html=coverage"
    }

    try {
        $Result = powershell.exe -Command "$TestCommand"

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $TestType tests passed" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ $TestType tests failed" -ForegroundColor Red
            Write-Host $Result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "💥 Error running $TestType tests: $_" -ForegroundColor Red
        return $false
    }
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Blue

    # Check if backend directory exists
    if (-not (Test-Path $BackendPath)) {
        Write-Host "❌ Backend directory not found: $BackendPath" -ForegroundColor Red
        return $false
    }

    # Check if composer.json exists
    if (-not (Test-Path (Join-Path $BackendPath "composer.json"))) {
        Write-Host "❌ composer.json not found in backend" -ForegroundColor Red
        return $false
    }

    # Check if PHPUnit is available
    try {
        $null = & php -v 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ PHP not found or not working" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ PHP not found" -ForegroundColor Red
        return $false
    }

    Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
    return $true
}

# Function to setup test environment
function Initialize-TestEnvironment {
    Write-Host "🛠️  Setting up test environment..." -ForegroundColor Blue

    # Navigate to backend directory
    Set-Location $BackendPath

    # Install dependencies if needed
    if (-not (Test-Path "vendor")) {
        Write-Host "📦 Installing composer dependencies..." -ForegroundColor Yellow
        try {
            powershell.exe -Command "composer install --no-interaction --prefer-dist"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "❌ Error installing dependencies: $_" -ForegroundColor Red
            return $false
        }
    }

    # Clear caches
    Write-Host "🧹 Clearing caches..." -ForegroundColor Yellow
    try {
        powershell.exe -Command "php artisan config:clear"
        powershell.exe -Command "php artisan cache:clear"
        powershell.exe -Command "php artisan route:clear"
        powershell.exe -Command "php artisan view:clear"
    } catch {
        Write-Host "⚠️  Warning: Could not clear all caches" -ForegroundColor Yellow
    }

    Write-Host "✅ Test environment ready" -ForegroundColor Green
    return $true
}

# Function to run specific test phases
function Invoke-PhaseTests {
    $TestResults = @{}

    # Phase 1: Swiss Pairings & Elimination Brackets (Unit Tests)
    if (-not $SkipUnit) {
        Write-Host "`n🏆 Phase 1: Swiss Pairings & Elimination Brackets" -ForegroundColor Cyan
        Write-Host "-------------------------------------------------" -ForegroundColor Cyan

        $TestResults.UnitTests = Invoke-LaravelTests -TestType "Unit" -TestPath "tests/Unit/ChampionshipServicesTest.php" -Options @{
            Verbose = $Verbose
            Coverage = $Coverage
        }
    } else {
        Write-Host "`n⏭️  Skipping Unit tests" -ForegroundColor Yellow
        $TestResults.UnitTests = $true
    }

    # Phase 2: Match Scheduling & Invitations (Feature Tests)
    if (-not $SkipFeature) {
        Write-Host "`n📅 Phase 2: Match Scheduling & Invitations" -ForegroundColor Cyan
        Write-Host "-------------------------------------------" -ForegroundColor Cyan

        $TestResults.FeatureTests = Invoke-LaravelTests -TestType "Feature" -TestPath "tests/Feature/ChampionshipTournamentTest.php" -Options @{
            Verbose = $Verbose
            Coverage = $Coverage
        }
    } else {
        Write-Host "`n⏭️  Skipping Feature tests" -ForegroundColor Yellow
        $TestResults.FeatureTests = $true
    }

    # Phase 3: WebSocket Events & Frontend Integration (Integration + WebSocket Tests)
    if (-not $SkipIntegration) {
        Write-Host "`n🔄 Phase 3a: Tournament Workflow Integration" -ForegroundColor Cyan
        Write-Host "--------------------------------------------" -ForegroundColor Cyan

        $TestResults.IntegrationTests = Invoke-LaravelTests -TestType "Integration" -TestPath "tests/Integration/TournamentWorkflowTest.php" -Options @{
            Verbose = $Verbose
            Coverage = $Coverage
        }
    } else {
        Write-Host "`n⏭️  Skipping Integration tests" -ForegroundColor Yellow
        $TestResults.IntegrationTests = $true
    }

    if (-not $SkipWebSocket) {
        Write-Host "`n🌐 Phase 3b: WebSocket Events" -ForegroundColor Cyan
        Write-Host "-------------------------------" -ForegroundColor Cyan

        $TestResults.WebSocketTests = Invoke-LaravelTests -TestType "WebSocket" -TestPath "tests/Feature/WebSocketEventsTest.php" -Options @{
            Verbose = $Verbose
            Coverage = $Coverage
        }
    } else {
        Write-Host "`n⏭️  Skipping WebSocket tests" -ForegroundColor Yellow
        $TestResults.WebSocketTests = $true
    }

    return $TestResults
}

# Function to run database migrations for testing
function Initialize-TestDatabase {
    Write-Host "🗄️  Setting up test database..." -ForegroundColor Blue

    try {
        # Run test migrations
        powershell.exe -Command "php artisan migrate:fresh --database=testing --seed"

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Test database initialized" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to initialize test database" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error initializing test database: $_" -ForegroundColor Red
        return $false
    }
}

# Function to generate test report
function New-TestReport {
    param([hashtable]$Results)

    $TotalTests = $Results.Count
    $PassedTests = ($Results.Values | Where-Object { $_ -eq $true }).Count
    $FailedTests = $TotalTests - $PassedTests

    Write-Host "`n📊 Test Summary" -ForegroundColor Cyan
    Write-Host "==============" -ForegroundColor Cyan
    Write-Host "Total Test Suites: $TotalTests" -ForegroundColor White
    Write-Host "Passed: $PassedTests ✅" -ForegroundColor Green
    Write-Host "Failed: $FailedTests ❌" -ForegroundColor Red

    if ($FailedTests -eq 0) {
        Write-Host "`n🎉 All tests passed! Championship enhancement is ready for production!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Some tests failed. Please review and fix issues before deployment." -ForegroundColor Yellow
    }

    # Generate detailed report
    $Report = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        TotalTests = $TotalTests
        PassedTests = $PassedTests
        FailedTests = $FailedTests
        Results = $Results
    }

    $ReportPath = Join-Path $ProjectRoot "test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $Report | ConvertTo-Json -Depth 3 | Out-File -FilePath $ReportPath

    Write-Host "📄 Detailed report saved to: $ReportPath" -ForegroundColor Blue
}

# Main execution
try {
    Write-Host "🚀 Starting Championship Tournament Test Suite" -ForegroundColor Cyan
    Write-Host "Phase 1: Swiss Pairings & Elimination Brackets" -ForegroundColor White
    Write-Host "Phase 2: Match Scheduling & Invitations" -ForegroundColor White
    Write-Host "Phase 3: WebSocket Events & Frontend Integration" -ForegroundColor White
    Write-Host ""

    # Check prerequisites
    if (-not (Test-Prerequisites)) {
        Write-Host "❌ Prerequisites check failed. Exiting." -ForegroundColor Red
        exit 1
    }

    # Setup test environment
    if (-not (Initialize-TestEnvironment)) {
        Write-Host "❌ Failed to setup test environment. Exiting." -ForegroundColor Red
        exit 1
    }

    # Setup test database
    if (-not (Initialize-TestDatabase)) {
        Write-Host "❌ Failed to setup test database. Exiting." -ForegroundColor Red
        exit 1
    }

    # Run all test phases
    $TestResults = Invoke-PhaseTests

    # Generate report
    New-TestReport -Results $TestResults

    # Exit with appropriate code
    $FailedTests = ($TestResults.Values | Where-Object { $_ -eq $false }).Count
    if ($FailedTests -eq 0) {
        Write-Host "`n✅ Test suite completed successfully!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n❌ Test suite failed with $FailedTests errors." -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "💥 Unexpected error: $_" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}