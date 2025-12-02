<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use Illuminate\Support\Facades\DB;

/**
 * Generated Challenges Seeder
 *
 * This seeder adds new chess tutorial challenges to existing modules.
 * Run with: php artisan db:seed --class=GeneratedChallengesSeeder
 *
 * Examples included:
 * 1. Puzzle Challenge - Knight Fork (tactical puzzle)
 * 2. Theory Challenge - Bishop Power (theory with quiz)
 */
class GeneratedChallengesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('🚀 Starting Generated Challenges Seeder...');

        // Example 1: Add Knight Fork Puzzle to Basic Tactics Module
        $this->addKnightForkPuzzle();

        // Example 2: Add Bishop Theory to Chess Basics Module
        $this->addBishopTheory();

        $this->command->info('✅ Generated Challenges Seeder completed successfully!');
        $this->command->info('📊 Added 2 new lessons');
        $this->command->info('🎮 Navigate to /tutorial to see the new challenges!');
    }

    /**
     * Example 1: Knight Fork Puzzle Challenge
     *
     * This is a PUZZLE type lesson with tactical challenges
     * Module: basic-tactics
     */
    private function addKnightForkPuzzle(): void
    {
        $this->command->info('📦 Adding Knight Fork Puzzle...');

        // Get the Basic Tactics module
        $tacticsModule = TutorialModule::where('slug', 'basic-tactics')->first();

        if (!$tacticsModule) {
            $this->command->error('❌ Module "basic-tactics" not found! Run TutorialContentSeeder first.');
            return;
        }

        // Check if lesson already exists
        $existingLesson = TutorialLesson::where('slug', 'knight-fork-royal-family')->first();
        if ($existingLesson) {
            $this->command->warn('⚠️  Lesson "knight-fork-royal-family" already exists, skipping...');
            return;
        }

        // Get the highest sort_order for this module
        $maxSortOrder = TutorialLesson::where('module_id', $tacticsModule->id)->max('sort_order') ?? 0;

        // Create the puzzle lesson
        TutorialLesson::create([
            'module_id' => $tacticsModule->id,
            'title' => 'Knight Fork: Royal Family',
            'slug' => 'knight-fork-royal-family',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 4,
            'sort_order' => $maxSortOrder + 1,
            'estimated_duration_minutes' => 5,
            'xp_reward' => 35,
            'is_active' => true,
            'content_data' => [
                'type' => 'puzzle',
                'puzzles' => [
                    [
                        'fen' => 'r3k2r/8/8/8/4N3/8/8/8 w KQkq - 0 1',
                        'objective' => 'Win material with a knight fork',
                        'solution' => ['Nf6+'],
                        'hints' => [
                            'The knight can attack both the king and rook',
                            'Look for a check that also attacks the rook on h8',
                            'Remember: Knights move in an L-shape pattern'
                        ],
                    ],
                    [
                        'fen' => 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
                        'objective' => 'Execute a powerful knight fork',
                        'solution' => ['Ng5'],
                        'hints' => [
                            'The knight on f3 can reach a powerful square',
                            'Look for a fork that attacks f7',
                            'This is a common tactical pattern in the Italian Game'
                        ],
                    ],
                ],
            ],
        ]);

        $this->command->info('✅ Knight Fork Puzzle added successfully!');
    }

    /**
     * Example 2: Bishop Theory with Quiz
     *
     * This is a THEORY type lesson with educational content and quiz
     * Module: chess-basics
     */
    private function addBishopTheory(): void
    {
        $this->command->info('📦 Adding Bishop Movement Theory...');

        // Get the Chess Basics module
        $basicsModule = TutorialModule::where('slug', 'chess-basics')->first();

        if (!$basicsModule) {
            $this->command->error('❌ Module "chess-basics" not found! Run TutorialContentSeeder first.');
            return;
        }

        // Check if lesson already exists
        $existingLesson = TutorialLesson::where('slug', 'bishop-movement-fundamentals')->first();
        if ($existingLesson) {
            $this->command->warn('⚠️  Lesson "bishop-movement-fundamentals" already exists, skipping...');
            return;
        }

        // Get the highest sort_order for this module
        $maxSortOrder = TutorialLesson::where('module_id', $basicsModule->id)->max('sort_order') ?? 0;

        // Create the theory lesson
        TutorialLesson::create([
            'module_id' => $basicsModule->id,
            'title' => 'Bishop Movement Fundamentals',
            'slug' => 'bishop-movement-fundamentals',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => $maxSortOrder + 1,
            'estimated_duration_minutes' => 8,
            'xp_reward' => 20,
            'is_active' => true,
            'content_data' => [
                'type' => 'theory',
                'slides' => [
                    [
                        'title' => 'The Bishop\'s Path',
                        'content' => '<p><strong>Bishops are powerful long-range pieces!</strong></p>
                                     <p>Bishops move diagonally any number of squares. Each bishop stays on its starting color (light or dark) for the entire game.</p>
                                     <ul>
                                         <li>Light-squared bishops move on light squares only</li>
                                         <li>Dark-squared bishops move on dark squares only</li>
                                         <li>Bishops can control long diagonals across the board</li>
                                         <li>Two bishops working together are very powerful!</li>
                                     </ul>',
                        'diagram' => '8/8/8/8/3B4/8/8/8 w - - 0 1',
                        'highlights' => ['a1', 'h8', 'a7', 'g1'],
                    ],
                    [
                        'title' => 'Bishop vs Knight',
                        'content' => '<p><strong>Understanding the difference:</strong></p>
                                     <p><strong>Bishops:</strong></p>
                                     <ul>
                                         <li>Better in open positions</li>
                                         <li>Can control both sides of the board</li>
                                         <li>Strongest on long diagonals</li>
                                     </ul>
                                     <p><strong>Knights:</strong></p>
                                     <ul>
                                         <li>Better in closed positions</li>
                                         <li>Can jump over pieces</li>
                                         <li>Can reach all squares (both colors)</li>
                                     </ul>',
                    ],
                    [
                        'title' => 'Quick Quiz',
                        'content' => '<p>Test your knowledge of bishop movement!</p>',
                        'quiz' => [
                            [
                                'question' => 'How many squares can a bishop control from the center of an empty board?',
                                'options' => ['7 squares', '13 squares', '15 squares', '27 squares'],
                                'correct' => 1, // Index 1 = "13 squares"
                            ],
                            [
                                'question' => 'Can a light-squared bishop ever capture on a dark square?',
                                'options' => ['Yes', 'No', 'Only with promotion', 'Only in endgames'],
                                'correct' => 1, // Index 1 = "No"
                            ],
                            [
                                'question' => 'Which is typically stronger in an open position?',
                                'options' => ['Knight', 'Bishop', 'They are equal', 'Depends on the pawn structure'],
                                'correct' => 1, // Index 1 = "Bishop"
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $this->command->info('✅ Bishop Movement Theory added successfully!');
    }
}
