<?php

// Usage in tinker: include this file or copy these commands

echo "=== Championship Test Helper ===\n\n";

// 1. Create a test championship
echo "Creating test championship...\n";
$seeder = new Database\Seeders\ChampionshipTestSeeder();

// Add mock command for the seeder
$mockCommand = new class {
    public function info($message) { echo "[INFO] $message\n"; }
    public function error($message) { echo "[ERROR] $message\n"; }
    public function warn($message) { echo "[WARN] $message\n"; }
};
$seeder->setCommand($mockCommand);

// Create a new test championship
$champ = $seeder->createTestChampionship();
echo "✅ Test championship created with ID: {$champ->id}\n\n";

// 2. Simulate round 1
echo "Simulating Round 1...\n";
$seeder->simulateRoundProgress($champ->id, 1);
echo "✅ Round 1 completed\n\n";

// 3. Analyze current state
echo "Analyzing championship state...\n";
$seeder->analyzeChampionship($champ->id);

echo "\n=== Championship Management Commands ===\n";
echo "In tinker, you can:\n";
echo "1. \$champ = App\\Models\\Championship::find({$champ->id});\n";
echo "2. \$champ->participants()->with('user')->get();\n";
echo "3. \$champ->matches()->with('whitePlayer', 'blackPlayer')->get();\n";
echo "4. \$champ->standings()->with('user')->orderBy('rank')->get();\n\n";

echo "Your admin account details:\n";
$adminUser = App\Models\User::find(1);
echo "Email: {$adminUser->email}\n";
echo "Name: {$adminUser->name}\n";
echo "Roles: " . implode(', ', $adminUser->roles->pluck('name')->toArray()) . "\n";