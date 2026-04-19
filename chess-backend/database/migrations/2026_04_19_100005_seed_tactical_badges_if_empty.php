<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the tactical_badges catalog if empty.
 *
 * Idempotent: production deploys run `php artisan migrate --force` and this
 * populates the catalog automatically without a separate seed step. If rows
 * already exist it is a no-op.
 *
 * Criteria JSON shape: { "type": "<rule>", "value": <int> }
 *   - solves_total       — lifetime puzzles solved
 *   - streak             — consecutive solves
 *   - perfect_solves     — solves with wrong_count = 0
 *   - perfect_cct        — puzzles with cct_quality = 100
 *   - rating             — peak rating reached
 *   - stage_complete     — stage_id completed (all puzzles solved)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('tactical_badges')->count() > 0) {
            return;
        }

        $now = now();

        $rows = [
            // ── Milestone ────────────────────────────────────────────
            [
                'slug' => 'first_solve',
                'name' => 'First Blood',
                'description' => 'Solve your first tactical puzzle.',
                'category' => 'milestone',
                'tier' => 'bronze',
                'icon' => '🎯',
                'criteria' => ['type' => 'solves_total', 'value' => 1],
                'sort_order' => 10,
            ],

            // ── Volume ───────────────────────────────────────────────
            [
                'slug' => 'centurion',
                'name' => 'Centurion',
                'description' => 'Solve 100 tactical puzzles.',
                'category' => 'volume',
                'tier' => 'silver',
                'icon' => '💯',
                'criteria' => ['type' => 'solves_total', 'value' => 100],
                'sort_order' => 20,
            ],
            [
                'slug' => 'tactical_veteran',
                'name' => 'Tactical Veteran',
                'description' => 'Solve 500 tactical puzzles.',
                'category' => 'volume',
                'tier' => 'gold',
                'icon' => '🏅',
                'criteria' => ['type' => 'solves_total', 'value' => 500],
                'sort_order' => 30,
            ],

            // ── Streak ───────────────────────────────────────────────
            [
                'slug' => 'streak_5',
                'name' => 'Streak Starter',
                'description' => 'Solve 5 puzzles in a row.',
                'category' => 'streak',
                'tier' => 'bronze',
                'icon' => '🔥',
                'criteria' => ['type' => 'streak', 'value' => 5],
                'sort_order' => 40,
            ],
            [
                'slug' => 'streak_25',
                'name' => 'On Fire',
                'description' => 'Solve 25 puzzles in a row.',
                'category' => 'streak',
                'tier' => 'gold',
                'icon' => '⚡',
                'criteria' => ['type' => 'streak', 'value' => 25],
                'sort_order' => 50,
            ],

            // ── Quality ──────────────────────────────────────────────
            [
                'slug' => 'perfectionist_20',
                'name' => 'Perfectionist',
                'description' => 'Solve 20 puzzles with zero wrong moves.',
                'category' => 'quality',
                'tier' => 'silver',
                'icon' => '✨',
                'criteria' => ['type' => 'perfect_solves', 'value' => 20],
                'sort_order' => 60,
            ],
            [
                'slug' => 'threat_spotter_10',
                'name' => 'Threat Spotter',
                'description' => 'Score 100% CCT on 10 puzzles.',
                'category' => 'quality',
                'tier' => 'silver',
                'icon' => '🛡️',
                'criteria' => ['type' => 'perfect_cct', 'value' => 10],
                'sort_order' => 70,
            ],

            // ── Rating ───────────────────────────────────────────────
            [
                'slug' => 'rating_1500',
                'name' => 'Rising Tactician',
                'description' => 'Reach a tactical rating of 1500.',
                'category' => 'rating',
                'tier' => 'silver',
                'icon' => '📈',
                'criteria' => ['type' => 'rating', 'value' => 1500],
                'sort_order' => 80,
            ],
            [
                'slug' => 'rating_2000',
                'name' => 'Master Tactician',
                'description' => 'Reach a tactical rating of 2000.',
                'category' => 'rating',
                'tier' => 'platinum',
                'icon' => '👑',
                'criteria' => ['type' => 'rating', 'value' => 2000],
                'sort_order' => 90,
            ],

            // ── Stage completion ─────────────────────────────────────
            [
                'slug' => 'stage_0_complete',
                'name' => 'Beginner Graduate',
                'description' => 'Complete every puzzle in Beginner Tactics.',
                'category' => 'stage',
                'tier' => 'bronze',
                'icon' => '♟',
                'criteria' => ['type' => 'stage_complete', 'value' => 0],
                'sort_order' => 100,
            ],
            [
                'slug' => 'stage_1_complete',
                'name' => 'Sharpshooter',
                'description' => 'Complete every puzzle in Tactical Sharpness.',
                'category' => 'stage',
                'tier' => 'silver',
                'icon' => '⚔️',
                'criteria' => ['type' => 'stage_complete', 'value' => 1],
                'sort_order' => 110,
            ],
            [
                'slug' => 'stage_2_complete',
                'name' => 'Deep Calculator',
                'description' => 'Complete every puzzle in Calculation Depth.',
                'category' => 'stage',
                'tier' => 'gold',
                'icon' => '🧠',
                'criteria' => ['type' => 'stage_complete', 'value' => 2],
                'sort_order' => 120,
            ],
        ];

        $insert = array_map(function ($row) use ($now) {
            return [
                'slug' => $row['slug'],
                'name' => $row['name'],
                'description' => $row['description'],
                'category' => $row['category'],
                'tier' => $row['tier'],
                'icon' => $row['icon'],
                'criteria' => json_encode($row['criteria']),
                'sort_order' => $row['sort_order'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $rows);

        DB::table('tactical_badges')->insert($insert);
    }

    public function down(): void
    {
        DB::table('tactical_badges')
            ->whereIn('slug', [
                'first_solve', 'centurion', 'tactical_veteran',
                'streak_5', 'streak_25',
                'perfectionist_20', 'threat_spotter_10',
                'rating_1500', 'rating_2000',
                'stage_0_complete', 'stage_1_complete', 'stage_2_complete',
            ])
            ->delete();
    }
};
