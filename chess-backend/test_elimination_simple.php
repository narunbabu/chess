<?php

/**
 * Simple test to verify elimination round type mapping
 */

require __DIR__ . '/vendor/autoload.php';

use App\Enums\ChampionshipRoundType;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🧪 Testing Round Type Enum Conversion\n";
echo str_repeat("=", 60) . "\n\n";

$testTypes = [
    'swiss',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'final',
    'third_place',
];

foreach ($testTypes as $type) {
    try {
        $enum = ChampionshipRoundType::from($type);
        $id = $enum->getId();
        $label = $enum->label();
        $expectedMatches = $enum->expectedMatches();

        echo "✅ Type: '{$type}'\n";
        echo "   Enum: {$enum->value}\n";
        echo "   ID: {$id}\n";
        echo "   Label: {$label}\n";
        echo "   Expected Matches: " . ($expectedMatches ?? 'Variable') . "\n";
        echo "   Is Elimination: " . ($enum->isElimination() ? 'Yes' : 'No') . "\n";
        echo "\n";
    } catch (\Exception $e) {
        echo "❌ Error for type '{$type}': {$e->getMessage()}\n\n";
    }
}

echo "✅ All round types converted successfully!\n";
