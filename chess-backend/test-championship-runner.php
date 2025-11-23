<?php

/**
 * Championship Test Runner
 *
 * Usage: php test-championship-runner.php [action] [parameters]
 *
 * Actions:
 * - create: Create new test championship
 * - stage [stage]: Create championship at specific stage
 * - analyze [id]: Analyze championship state
 * - reset [id]: Reset championship
 * - simulate [id] [round]: Simulate round completion
 * - list: List all test championships
 */

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Contracts\Console\Kernel;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$action = $argv[1] ?? 'help';
$param1 = $argv[2] ?? null;
$param2 = $argv[3] ?? null;

function println($message) {
    echo $message . PHP_EOL;
}

function printlnSuccess($message) {
    echo "\033[32m" . $message . "\033[0m" . PHP_EOL;
}

function printlnInfo($message) {
    echo "\033[36m" . $message . "\033[0m" . PHP_EOL;
}

function printlnError($message) {
    echo "\033[31m" . $message . "\033[0m" . PHP_EOL;
}

function showHelp() {
    println("Championship Test Runner");
    println("=======================");
    println("");
    println("Usage: php test-championship-runner.php [action] [parameters]");
    println("");
    println("Actions:");
    println("  help                    - Show this help message");
    println("  create                  - Create a new test championship");
    println("  stage [stage]           - Create championship at specific stage");
    println("  analyze [id]            - Analyze championship state");
    println("  reset [id]              - Reset championship to initial state");
    println("  simulate [id] [round]   - Simulate round completion");
    println("  list                    - List all test championships");
    println("");
    println("Stages:");
    println("  registration            - Championship in registration phase");
    println("  round1_pending          - Round 1 matches generated but not completed");
    println("  round1_completed        - Round 1 completed, Round 2 generated");
    println("  round2_completed        - Round 2 completed, Round 3 generated");
    println("  completed               - All rounds completed");
    println("");
    println("Examples:");
    println("  php test-championship-runner.php create");
    println("  php test-championship-runner.php stage round1_completed");
    println("  php test-championship-runner.php analyze 5");
    println("  php test-championship-runner.php simulate 5 1");
    println("  php test-championship-runner.php reset 5");
}

try {
    $seeder = new Database\Seeders\ChampionshipTestSeeder();

    switch (strtolower($action)) {
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;

        case 'create':
            printlnInfo("Creating new test championship...");
            $champ = $seeder->createTestChampionship();
            printlnSuccess("✓ Created Championship ID: {$champ->id}");
            printlnSuccess("✓ Title: {$champ->title}");
            break;

        case 'stage':
            if (!$param1) {
                printlnError("Error: Stage parameter is required");
                println("Available stages: registration, round1_pending, round1_completed, round2_completed, completed");
                exit(1);
            }
            printlnInfo("Creating championship at stage: {$param1}");
            $champ = $seeder->createChampionshipAtStage($param1);
            printlnSuccess("✓ Created Championship ID: {$champ->id}");
            printlnSuccess("✓ Stage: {$param1}");
            break;

        case 'analyze':
            if (!$param1) {
                printlnError("Error: Championship ID is required");
                exit(1);
            }
            $seeder->analyzeChampionship((int)$param1);
            break;

        case 'reset':
            if (!$param1) {
                printlnError("Error: Championship ID is required");
                exit(1);
            }
            printlnInfo("Resetting championship ID: {$param1}");
            $seeder->resetChampionship((int)$param1);
            printlnSuccess("✓ Championship reset successfully");
            break;

        case 'simulate':
            if (!$param1 || !$param2) {
                printlnError("Error: Championship ID and round number are required");
                exit(1);
            }
            printlnInfo("Simulating Round {$param2} for championship ID: {$param1}");
            $seeder->simulateRoundProgress((int)$param1, (int)$param2);
            printlnSuccess("✓ Round {$param2} simulated successfully");
            break;

        case 'list':
            printlnInfo("Listing test championships...");
            $seeder->listTestChampionships();
            break;

        case 'seed':
            printlnInfo("Running championship test seeder...");
            $seeder->run();
            printlnSuccess("✓ Seeder completed successfully");
            break;

        default:
            printlnError("Error: Unknown action '{$action}'");
            println("");
            showHelp();
            exit(1);
    }

} catch (Exception $e) {
    printlnError("Error: " . $e->getMessage());
    printlnError("File: " . $e->getFile());
    printlnError("Line: " . $e->getLine());
    exit(1);
}