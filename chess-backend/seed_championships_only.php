<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Seeding Championship Data Only ===\n\n";
echo "Preserving existing Google OAuth user: nalamara.arun@gmail.com\n\n";

// 1. Check admin user exists
echo "1. Checking admin user...\n";
$adminUser = App\Models\User::find(1);
if ($adminUser) {
    echo "✅ Admin user found: {$adminUser->name} ({$adminUser->email})\n";
    echo "   Provider: {$adminUser->provider}\n";
    echo "   Provider ID: {$adminUser->provider_id}\n\n";
} else {
    echo "❌ Admin user not found\n\n";
    exit(1);
}

// 2. Clear only championship data
echo "2. Clearing championship data...\n";
try {
    Illuminate\Support\Facades\DB::table('championship_participants')->truncate();
    Illuminate\Support\Facades\DB::table('championship_matches')->truncate();
    Illuminate\Support\Facades\DB::table('championship_standings')->truncate();
    Illuminate\Support\Facades\DB::table('championships')->truncate();
    echo "✅ Championship data cleared\n\n";
} catch (Exception $e) {
    echo "⚠️  Warning clearing data: " . $e->getMessage() . "\n\n";
}

// 3. Run Championship seeder
echo "3. Running ChampionshipSeeder...\n";
try {
    $champSeeder = new Database\Seeders\ChampionshipSeeder();
    $champSeeder->run();
    echo "✅ ChampionshipSeeder completed\n\n";
} catch (Exception $e) {
    echo "❌ ChampionshipSeeder error: " . $e->getMessage() . "\n\n";
}

// 4. Run AdminPermissionSeeder (roles only)
echo "4. Running AdminPermissionSeeder...\n";
try {
    $adminSeeder = new Database\Seeders\AdminPermissionSeeder();
    $adminSeeder->run();
    echo "✅ AdminPermissionSeeder completed\n\n";
} catch (Exception $e) {
    echo "❌ AdminPermissionSeeder error: " . $e->getMessage() . "\n\n";
}

// 5. Verification
echo "5. Verification:\n";
$userCount = App\Models\User::count();
$championshipCount = App\Models\Championship::count();

echo "   Users: {$userCount}\n";
echo "   Championships: {$championshipCount}\n\n";

// 6. Admin permissions check
echo "6. Checking admin permissions...\n";
$adminUser = App\Models\User::find(1);
if ($adminUser) {
    $roles = $adminUser->roles()->pluck('name')->toArray();
    $hasAdminRole = in_array('platform_admin', $roles);
    echo "   Admin role: " . ($hasAdminRole ? "✅ Assigned" : "❌ Not assigned") . "\n";
    echo "   User roles: " . implode(', ', $roles) . "\n";
}

echo "\n=== Championship Setup Complete! ===\n";
echo "Your Google OAuth login remains unchanged.\n";
echo "You can login with Google and should have admin privileges.\n\n";

// 7. List championships
echo "7. Available championships:\n";
$championships = App\Models\Championship::with('participants')->get();
foreach ($championships as $champ) {
    echo "   - {$champ->title} (ID: {$champ->id})\n";
    echo "     Status: {$champ->status}\n";
    echo "     Participants: {$champ->participants->count()}\n";
    echo "     Entry Fee: {$champ->entry_fee}\n\n";
}

echo "8. Tinker commands for testing:\n";
echo "   \$champ = App\\Models\\Championship::find(3);\n";
echo "   \$seeder = new Database\\Seeders\\ChampionshipTestSeeder();\n";
echo "   \$seeder->createTestChampionship();\n";