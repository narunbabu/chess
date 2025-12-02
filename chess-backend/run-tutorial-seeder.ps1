# ===================================================================
# Tutorial Seeder Runner Script
# ===================================================================
# This script runs all tutorial-related seeders in the correct order
#
# Available Seeders:
# 1. ComprehensiveTutorialSeeder - Main seeder with all modules and lessons
# 2. TutorialContentSeeder - Original tutorial content (alternative)
# 3. InteractiveLessonSeeder - Interactive lessons with stages
# 4. GeneratedChallengesSeeder - Additional challenge content
#
# Usage:
#   .\run-tutorial-seeder.ps1              # Run comprehensive seeder (recommended)
#   .\run-tutorial-seeder.ps1 -All         # Run all seeders
#   .\run-tutorial-seeder.ps1 -Custom      # Choose which seeders to run
# ===================================================================

param(
    [switch]$All,
    [switch]$Custom
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Tutorial Database Seeder Runner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to the correct directory
Set-Location "C:\ArunApps\Chess-Web\chess-backend"

# Check if we're in the correct directory
if (-not (Test-Path ".\artisan")) {
    Write-Host "ERROR: artisan file not found!" -ForegroundColor Red
    Write-Host "Please run this script from the chess-backend directory" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Function to run a seeder
function Run-Seeder {
    param(
        [string]$SeederName,
        [string]$Description
    )

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Running: $Description" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""

    $command = "php artisan db:seed --class=$SeederName --force"
    Write-Host "Command: $command" -ForegroundColor Gray
    Write-Host ""

    # Execute the seeder
    Invoke-Expression $command

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: $Description completed!" -ForegroundColor Green
        return $true
    } else {
        Write-Host ""
        Write-Host "ERROR: Failed to run $SeederName" -ForegroundColor Red
        return $false
    }
}

# Main execution logic
if ($All) {
    Write-Host "Running ALL tutorial seeders..." -ForegroundColor Yellow
    Write-Host "This will TRUNCATE existing tutorial data and reseed everything!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to continue or Ctrl+C to cancel..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    $seeders = @(
        @{ Name = "ComprehensiveTutorialSeeder"; Desc = "Comprehensive Tutorial System (Main Seeder)" },
        @{ Name = "InteractiveLessonSeeder"; Desc = "Interactive Lessons with Stages" },
        @{ Name = "GeneratedChallengesSeeder"; Desc = "Additional Challenge Content" }
    )

    $success = $true
    foreach ($seeder in $seeders) {
        $result = Run-Seeder -SeederName $seeder.Name -Description $seeder.Desc
        if (-not $result) {
            $success = $false
            break
        }
    }

    if ($success) {
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "  ALL SEEDERS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
    }

} elseif ($Custom) {
    Write-Host "Choose which seeders to run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. ComprehensiveTutorialSeeder (Recommended - Full system)" -ForegroundColor Cyan
    Write-Host "2. TutorialContentSeeder (Original content)" -ForegroundColor Cyan
    Write-Host "3. InteractiveLessonSeeder (Interactive lessons only)" -ForegroundColor Cyan
    Write-Host "4. GeneratedChallengesSeeder (Additional challenges)" -ForegroundColor Cyan
    Write-Host "5. Run Multiple (select from list)" -ForegroundColor Cyan
    Write-Host ""

    $choice = Read-Host "Enter your choice (1-5)"

    switch ($choice) {
        "1" {
            Run-Seeder -SeederName "ComprehensiveTutorialSeeder" -Description "Comprehensive Tutorial System"
        }
        "2" {
            Run-Seeder -SeederName "TutorialContentSeeder" -Description "Tutorial Content Seeder"
        }
        "3" {
            Run-Seeder -SeederName "InteractiveLessonSeeder" -Description "Interactive Lessons"
        }
        "4" {
            Run-Seeder -SeederName "GeneratedChallengesSeeder" -Description "Generated Challenges"
        }
        "5" {
            Write-Host ""
            Write-Host "Run each seeder? (Y/N for each)" -ForegroundColor Yellow

            $seeders = @(
                @{ Name = "ComprehensiveTutorialSeeder"; Desc = "Comprehensive Tutorial System" },
                @{ Name = "InteractiveLessonSeeder"; Desc = "Interactive Lessons" },
                @{ Name = "GeneratedChallengesSeeder"; Desc = "Generated Challenges" }
            )

            foreach ($seeder in $seeders) {
                Write-Host ""
                $run = Read-Host "Run $($seeder.Desc)? (Y/N)"
                if ($run -eq "Y" -or $run -eq "y") {
                    Run-Seeder -SeederName $seeder.Name -Description $seeder.Desc
                }
            }
        }
        default {
            Write-Host "Invalid choice!" -ForegroundColor Red
            exit 1
        }
    }

} else {
    # Default: Run comprehensive seeder (recommended)
    Write-Host "Running COMPREHENSIVE TUTORIAL SEEDER (Recommended)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This seeder includes:" -ForegroundColor Cyan
    Write-Host "  ✓ 6 Tutorial Modules" -ForegroundColor Gray
    Write-Host "  ✓ Multiple Lessons per Module" -ForegroundColor Gray
    Write-Host "  ✓ Interactive Stages for Lessons" -ForegroundColor Gray
    Write-Host "  ✓ Tutorial Achievements System" -ForegroundColor Gray
    Write-Host "  ✓ Piece Movement Training (Pawn, Rook, Knight, Bishop, Queen, King)" -ForegroundColor Gray
    Write-Host "  ✓ Chess Basics (Castling, En Passant)" -ForegroundColor Gray
    Write-Host "  ✓ Tactical Training (Forks, Pins)" -ForegroundColor Gray
    Write-Host "  ✓ Checkmate Patterns" -ForegroundColor Gray
    Write-Host ""
    Write-Host "WARNING: This will TRUNCATE existing tutorial data!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to continue or Ctrl+C to cancel..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    $result = Run-Seeder -SeederName "ComprehensiveTutorialSeeder" -Description "Comprehensive Tutorial System"

    if ($result) {
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host "  Next Steps:" -ForegroundColor Cyan
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Navigate to the frontend Tutorial Hub" -ForegroundColor Gray
        Write-Host "2. You should see all tutorial modules and lessons" -ForegroundColor Gray
        Write-Host "3. Try completing a lesson to test progress tracking!" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Optional: Run additional seeders" -ForegroundColor Yellow
        Write-Host "  .\run-tutorial-seeder.ps1 -Custom" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Seeder Runner Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
