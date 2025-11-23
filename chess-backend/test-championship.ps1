# Championship Testing Script
# Use this script to create and manipulate championship states for testing

param(
    [string]$Action = "help",
    [int]$ChampionshipId = 0,
    [int]$Round = 1,
    [string]$Stage = "",
    [string]$Results = ""
)

$ErrorActionPreference = "Stop"

function Write-Output {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Invoke-Tinker {
    param([string]$Command)

    $escapedCommand = $Command -replace '"', '""' -replace '`', '``'
    $tinkerCommand = "cd 'C:\ArunApps\Chess-Web\chess-backend'; php artisan tinker --execute=`"`$escapedCommand`""
    Write-Info "Executing: $Command"
    try {
        cmd /c $tinkerCommand
    } catch {
        Write-Error "Error executing tinker command: $_"
    }
}

function Show-Help {
    Write-Output "Championship Testing Script"
    Write-Output "==========================="
    Write-Output ""
    Write-Output "Usage:"
    Write-Output "  .\test-championship.ps1 [Action] [Parameters]"
    Write-Output ""
    Write-Output "Actions:"
    Write-Output "  help                    - Show this help message"
    Write-Output "  list                    - List all test championships"
    Write-Output "  create                  - Create a new test championship"
    Write-Output "  stage [stage]           - Create championship at specific stage"
    Write-Output "  analyze [id]            - Analyze championship state"
    Write-Output "  reset [id]              - Reset championship to initial state"
    Write-Output "  simulate [id] [round]   - Simulate round completion"
    Write-Output "  seed                    - Run the test seeder"
    Write-Output ""
    Write-Output "Stages for 'stage' action:"
    Write-Output "  registration            - Championship in registration phase"
    Write-Output "  round1_pending          - Round 1 matches generated but not completed"
    Write-Output "  round1_completed        - Round 1 completed, Round 2 generated"
    Write-Output "  round2_completed        - Round 2 completed, Round 3 generated"
    Write-Output "  completed               - All rounds completed"
    Write-Output ""
    Write-Output "Examples:"
    Write-Output "  .\test-championship.ps1 create"
    Write-Output "  .\test-championship.ps1 stage round1_completed"
    Write-Output "  .\test-championship.ps1 analyze 5"
    Write-Output "  .\test-championship.ps1 simulate 5 1"
    Write-Output "  .\test-championship.ps1 reset 5"
}

function Create-TestChampionship {
    Write-Output "Creating new test championship..."

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$champ = `$seeder->createTestChampionship();
echo 'Created Championship ID: ' . `$champ->id . PHP_EOL;
echo 'Title: ' . `$champ->title . PHP_EOL;
"@

    Invoke-Tinker -Command $command
}

function Create-ChampionshipAtStage {
    param([string]$Stage)

    if (-not $Stage) {
        Write-Error "Stage parameter is required"
        Write-Output "Available stages: registration, round1_pending, round1_completed, round2_completed, completed"
        return
    }

    Write-Output "Creating championship at stage: $Stage"

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$champ = `$seeder->createChampionshipAtStage('$Stage');
echo 'Created Championship ID: ' . `$champ->id . PHP_EOL;
echo 'Stage: $Stage' . PHP_EOL;
"@

    Invoke-Tinker -Command $command
}

function Analyze-Championship {
    param([int]$Id)

    if ($Id -eq 0) {
        Write-Error "Championship ID is required"
        return
    }

    Write-Output "Analyzing championship ID: $Id"

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$seeder->analyzeChampionship($Id);
"@

    Invoke-Tinker -Command $command
}

function Reset-Championship {
    param([int]$Id)

    if ($Id -eq 0) {
        Write-Error "Championship ID is required"
        return
    }

    Write-Output "Resetting championship ID: $Id"

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$seeder->resetChampionship($Id);
"@

    Invoke-Tinker -Command $command
}

function Simulate-Round {
    param([int]$Id, [int]$Round)

    if ($Id -eq 0) {
        Write-Error "Championship ID is required"
        return
    }

    Write-Output "Simulating Round $Round for championship ID: $Id"

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$seeder->simulateRoundProgress($Id, $Round);
"@

    Invoke-Tinker -Command $command
}

function List-TestChampionships {
    Write-Output "Listing test championships..."

    $command = @"
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$seeder->listTestChampionships();
"@

    Invoke-Tinker -Command $command
}

function Run-Seeder {
    Write-Output "Running championship test seeder..."

    $command = @"
require_once 'database/seeders/ChampionshipTestSeeder.php';
`$seeder = new Database\Seeders\ChampionshipTestSeeder();
`$seeder->run();
"@

    Invoke-Tinker -Command $command
}

# Main execution logic
switch ($Action.ToLower()) {
    "help" {
        Show-Help
    }
    "create" {
        Create-TestChampionship
    }
    "stage" {
        Create-ChampionshipAtStage -Stage $Stage
    }
    "analyze" {
        Analyze-Championship -Id $ChampionshipId
    }
    "reset" {
        Reset-Championship -Id $ChampionshipId
    }
    "simulate" {
        Simulate-Round -Id $ChampionshipId -Round $Round
    }
    "list" {
        List-TestChampionships
    }
    "seed" {
        Run-Seeder
    }
    default {
        Write-Error "Unknown action: $Action"
        Show-Help
    }
}