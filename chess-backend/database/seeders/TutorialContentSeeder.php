<?php

namespace Database\Seeders;

use Database\Seeders\Tutorial\BeginnerModuleSeeder;
use Database\Seeders\Tutorial\IntermediateModuleSeeder;
use Database\Seeders\Tutorial\AdvancedModuleSeeder;
use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\TutorialAchievement;
use Illuminate\Support\Facades\DB;

class TutorialContentSeeder extends Seeder
{
    /**
     * Seed 16 modules, 80 lessons, 10 achievements.
     *
     * Tier mapping:
     *   - Beginner (modules 1-5)  → required_tier = free
     *   - Intermediate (modules 6-11) → required_tier = silver
     *   - Advanced (modules 12-16) → required_tier = gold
     */
    public function run(): void
    {
        $this->disableForeignKeyChecks();
        TutorialModule::truncate();
        TutorialLesson::truncate();
        TutorialAchievement::truncate();
        $this->enableForeignKeyChecks();

        $this->createAchievements();

        (new BeginnerModuleSeeder())->run();
        (new IntermediateModuleSeeder())->run();
        (new AdvancedModuleSeeder())->run();

        $this->command->info("✅ Seeded {$this->countModules()} modules, {$this->countLessons()} lessons, {$this->countAchievements()} achievements.");
    }

    private function countModules(): int
    {
        return TutorialModule::count();
    }

    private function countLessons(): int
    {
        return TutorialLesson::count();
    }

    private function countAchievements(): int
    {
        return TutorialAchievement::count();
    }

    private function createAchievements(): void
    {
        $achievements = [
            [
                'name' => 'First Steps',
                'slug' => 'first-steps',
                'description' => 'Complete your first lesson',
                'icon' => "\u{1F476}",
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 1,
                'xp_reward' => 25,
            ],
            [
                'name' => 'Chess Novice',
                'slug' => 'chess-novice',
                'description' => 'Complete 5 lessons',
                'icon' => "\u{1F393}",
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 5,
                'xp_reward' => 50,
            ],
            [
                'name' => 'Tactic Master',
                'slug' => 'tactic-master',
                'description' => 'Complete 10 tactical puzzles',
                'icon' => "\u{2694}\u{FE0F}",
                'tier' => 'silver',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 10,
                'xp_reward' => 100,
            ],
            [
                'name' => 'Week Warrior',
                'slug' => 'week-warrior',
                'description' => 'Maintain a 7-day streak',
                'icon' => "\u{1F525}",
                'tier' => 'silver',
                'requirement_type' => 'streak',
                'requirement_value' => 7,
                'xp_reward' => 75,
            ],
            [
                'name' => 'Perfectionist',
                'slug' => 'perfectionist',
                'description' => 'Score 95% or higher on any lesson',
                'icon' => "\u{1F4AF}",
                'tier' => 'silver',
                'requirement_type' => 'score',
                'requirement_value' => 95,
                'xp_reward' => 60,
            ],
            [
                'name' => 'Chess Scholar',
                'slug' => 'chess-scholar',
                'description' => 'Complete 20 lessons',
                'icon' => "\u{1F4DA}",
                'tier' => 'gold',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 20,
                'xp_reward' => 150,
            ],
            [
                'name' => 'Opening Expert',
                'slug' => 'opening-expert',
                'description' => 'Complete all opening theory lessons',
                'icon' => "\u{265F}\u{FE0F}",
                'tier' => 'gold',
                'requirement_type' => 'special',
                'requirement_value' => 1,
                'xp_reward' => 125,
            ],
            [
                'name' => 'Month Champion',
                'slug' => 'month-champion',
                'description' => 'Maintain a 30-day streak',
                'icon' => "\u{1F451}",
                'tier' => 'gold',
                'requirement_type' => 'streak',
                'requirement_value' => 30,
                'xp_reward' => 200,
            ],
            [
                'name' => 'Chess Master',
                'slug' => 'chess-master',
                'description' => 'Complete 50 lessons',
                'icon' => "\u{1F3C6}",
                'tier' => 'platinum',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 50,
                'xp_reward' => 300,
            ],
            [
                'name' => 'Endgame Virtuoso',
                'slug' => 'endgame-virtuoso',
                'description' => 'Master all endgame techniques',
                'icon' => "\u{2654}",
                'tier' => 'platinum',
                'requirement_type' => 'special',
                'requirement_value' => 1,
                'xp_reward' => 250,
            ],
        ];

        foreach ($achievements as $achievement) {
            TutorialAchievement::create($achievement);
        }
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private function disableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL DEFERRED;');
        }
    }

    private function enableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL IMMEDIATE;');
        }
    }
}
