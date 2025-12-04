<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Fixing Admin User & Seeding Data ===\n\n";

// 1. Fix admin password
echo "1. Setting admin password...\n";
$adminUser = App\Models\User::find(1);
if ($adminUser) {
    $adminUser->password = Hash::make('password');
    $adminUser->email_verified_at = now();
    $adminUser->save();
    echo "✅ Admin password set successfully\n";
    echo "   Email: {$adminUser->email}\n";
    echo "   Password: password\n\n";
} else {
    echo "❌ Admin user not found\n\n";
}

// 2. Clear data and run individual seeders
echo "2. Clearing existing data...\n";
try {
    Illuminate\Support\Facades\DB::table('championship_participants')->truncate();
    Illuminate\Support\Facades\DB::table('championship_matches')->truncate();
    Illuminate\Support\Facades\DB::table('championship_standings')->truncate();
    Illuminate\Support\Facades\DB::table('championships')->truncate();
    echo "✅ Data cleared successfully\n";
} catch (Exception $e) {
    echo "⚠️  Warning clearing data: " . $e->getMessage() . "\n";
}

echo "3. Running seeders individually...\n";

// User seeder
try {
    $userSeeder = new Database\Seeders\UserSeeder();
    $userSeeder->run();
    echo "✅ UserSeeder completed\n";
} catch (Exception $e) {
    echo "❌ UserSeeder error: " . $e->getMessage() . "\n";
}

// Championship seeder
try {
    $champSeeder = new Database\Seeders\ChampionshipSeeder();
    $champSeeder->run();
    echo "✅ ChampionshipSeeder completed\n";
} catch (Exception $e) {
    echo "❌ ChampionshipSeeder error: " . $e->getMessage() . "\n";
}

// Admin permission seeder
try {
    $adminSeeder = new Database\Seeders\AdminPermissionSeeder();
    $adminSeeder->run();
    echo "✅ AdminPermissionSeeder completed\n";
} catch (Exception $e) {
    echo "❌ AdminPermissionSeeder error: " . $e->getMessage() . "\n";
}

// 4. Check results
echo "\n4. Verification:\n";
$userCount = App\Models\User::count();
$championshipCount = App\Models\Championship::count();
$participantCount = App\Models\ChampionshipParticipant::count();

echo "   Users: {$userCount}\n";
echo "   Championships: {$championshipCount}\n";
echo "   Participants: {$participantCount}\n\n";

// 5. Admin permissions check
echo "5. Checking admin permissions...\n";
$adminUser = App\Models\User::find(1);
if ($adminUser) {
    $roles = $adminUser->roles()->pluck('name')->toArray();
    $hasAdminRole = in_array('platform_admin', $roles);
    echo "   Admin role: " . ($hasAdminRole ? "✅ Assigned" : "❌ Not assigned") . "\n";
    echo "   User roles: " . implode(', ', $roles) . "\n";
}

echo "\n=== Setup Complete! ===\n";
echo "You can now login with:\n";
echo "Email: nalamara.arun@gmail.com\n";
echo "Password: password\n\n";

// 6. Championship list
echo "6. Available championships:\n";
$championships = App\Models\Championship::with('participants')->get();
foreach ($championships as $champ) {
    echo "   - {$champ->title} (ID: {$champ->id})\n";
    echo "     Status: {$champ->status}\n";
    echo "     Participants: {$champ->participants->count()}\n\n";
}