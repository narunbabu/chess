<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\TutorialAchievement;
use Illuminate\Support\Facades\DB;

class TutorialContentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->disableForeignKeyChecks();
        TutorialModule::truncate();
        TutorialLesson::truncate();
        TutorialAchievement::truncate();
        $this->enableForeignKeyChecks();

        $this->createAchievements();
        $this->createBeginnerModules();
        $this->createIntermediateModules();
        $this->createAdvancedModules();
    }

    private function createAchievements(): void
    {
        $achievements = [
            // Beginner Achievements
            [
                'name' => 'First Steps',
                'slug' => 'first-steps',
                'description' => 'Complete your first lesson',
                'icon' => '👶',
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 1,
                'xp_reward' => 25,
            ],
            [
                'name' => 'Chess Novice',
                'slug' => 'chess-novice',
                'description' => 'Complete 5 lessons',
                'icon' => '🎓',
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 5,
                'xp_reward' => 50,
            ],
            [
                'name' => 'Tactic Master',
                'slug' => 'tactic-master',
                'description' => 'Complete 10 tactical puzzles',
                'icon' => '⚔️',
                'tier' => 'silver',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 10,
                'xp_reward' => 100,
            ],
            [
                'name' => 'Week Warrior',
                'slug' => 'week-warrior',
                'description' => 'Maintain a 7-day streak',
                'icon' => '🔥',
                'tier' => 'silver',
                'requirement_type' => 'streak',
                'requirement_value' => 7,
                'xp_reward' => 75,
            ],
            [
                'name' => 'Perfectionist',
                'slug' => 'perfectionist',
                'description' => 'Score 95% or higher on any lesson',
                'icon' => '💯',
                'tier' => 'silver',
                'requirement_type' => 'score',
                'requirement_value' => 95,
                'xp_reward' => 60,
            ],

            // Intermediate Achievements
            [
                'name' => 'Chess Scholar',
                'slug' => 'chess-scholar',
                'description' => 'Complete 20 lessons',
                'icon' => '📚',
                'tier' => 'gold',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 20,
                'xp_reward' => 150,
            ],
            [
                'name' => 'Opening Expert',
                'slug' => 'opening-expert',
                'description' => 'Complete all opening theory lessons',
                'icon' => '♟️',
                'tier' => 'gold',
                'requirement_type' => 'special',
                'requirement_value' => 1,
                'xp_reward' => 125,
            ],
            [
                'name' => 'Month Champion',
                'slug' => 'month-champion',
                'description' => 'Maintain a 30-day streak',
                'icon' => '👑',
                'tier' => 'gold',
                'requirement_type' => 'streak',
                'requirement_value' => 30,
                'xp_reward' => 200,
            ],

            // Advanced Achievements
            [
                'name' => 'Chess Master',
                'slug' => 'chess-master',
                'description' => 'Complete 50 lessons',
                'icon' => '🏆',
                'tier' => 'platinum',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 50,
                'xp_reward' => 300,
            ],
            [
                'name' => 'Endgame Virtuoso',
                'slug' => 'endgame-virtuoso',
                'description' => 'Master all endgame techniques',
                'icon' => '♔',
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

    private function createBeginnerModules(): void
    {
        // Module 1: Chess Basics
        $basicsModule = TutorialModule::create([
            'name' => 'Chess Basics',
            'slug' => 'chess-basics',
            'skill_tier' => 'beginner',
            'description' => 'Learn the fundamentals of chess from piece movement to board setup',
            'icon' => '♟️',
            'sort_order' => 1,
            'estimated_duration_minutes' => 45,
        ]);

        $basicsLessons = [
            [
                'title' => 'The Chessboard',
                'slug' => 'chessboard-intro',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'Welcome to Chess!',
                            'content' => '<p>Chess is played on an 8x8 board with 64 squares. Each player starts with 16 pieces.</p>',
                            'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        ],
                        [
                            'title' => 'Files and Ranks',
                            'content' => '<p>The board has files (columns a-h) and ranks (rows 1-8). Each square has a unique name like "e4".</p>',
                        ],
                        [
                            'title' => 'Quick Quiz',
                            'content' => '<p>Test your knowledge!</p>',
                            'quiz' => [
                                [
                                    'question' => 'How many squares are on a chessboard?',
                                    'options' => ['32', '48', '64', '100'],
                                    'correct' => 2,
                                ],
                                [
                                    'question' => 'What color is the a1 square?',
                                    'options' => ['White', 'Black', 'Both', 'Neither'],
                                    'correct' => 0,
                                ],
                            ],
                        ],
                    ],
                ],
                'difficulty_rating' => 1,
                'sort_order' => 1,
                'xp_reward' => 15,
            ],
            [
                'title' => 'How the King Moves',
                'slug' => 'king-movement',
                'lesson_type' => 'interactive',
                'content_data' => [
                    'type' => 'interactive',
                    'slides' => [
                        [
                            'title' => 'The King',
                            'content' => '<p>The King is the most important piece. It moves one square in any direction.</p>',
                            'diagram' => '8/8/8/8/3K4/8/8/8 w - - 0 1',
                            'highlights' => ['d5'],
                        ],
                        [
                            'title' => 'Practice Moving the King',
                            'content' => '<p>Try moving the King to different squares!</p>',
                            'diagram' => '8/8/8/8/3K4/8/8/8 w - - 0 1',
                        ],
                    ],
                ],
                'difficulty_rating' => 1,
                'sort_order' => 2,
                'xp_reward' => 20,
            ],
            [
                'title' => 'Pawn Movement Basics',
                'slug' => 'pawn-movement',
                'lesson_type' => 'puzzle',
                'content_data' => [
                    'type' => 'puzzle',
                    'puzzles' => [
                        [
                            'fen' => '8/8/8/8/8/8/P7/8 w - - 0 1',
                            'objective' => 'Move the pawn forward',
                            'solution' => ['a3'],
                            'hints' => ['Pawns move forward one square', 'On their first move, they can move two squares'],
                        ],
                        [
                            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                            'objective' => 'Move the e2 pawn forward two squares',
                            'solution' => ['e4'],
                            'hints' => ['The e-pawn can move two squares on its first move', 'This is a popular opening move'],
                        ],
                    ],
                ],
                'difficulty_rating' => 2,
                'sort_order' => 3,
                'xp_reward' => 25,
            ],
        ];

        foreach ($basicsLessons as $lessonData) {
            $lesson = $basicsModule->lessons()->create($lessonData);
        }

        // Module 2: Basic Tactics
        $tacticsModule = TutorialModule::create([
            'name' => 'Basic Tactics',
            'slug' => 'basic-tactics',
            'skill_tier' => 'beginner',
            'description' => 'Learn fundamental tactical patterns like forks, pins, and skewers',
            'icon' => '⚔️',
            'sort_order' => 2,
            'unlock_requirement_id' => $basicsModule->id,
            'estimated_duration_minutes' => 60,
        ]);

        $tacticsLessons = [
            [
                'title' => 'Understanding Forks',
                'slug' => 'understanding-forks',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'What is a Fork?',
                            'content' => '<p>A fork is a tactic where one piece attacks two or more enemy pieces at the same time.</p>',
                        ],
                        [
                            'title' => 'Knight Forks',
                            'content' => '<p>Knights are especially good at forks because of their unique L-shaped movement.</p>',
                            'diagram' => '8/8/8/4N3/8/8/8/8 w - - 0 1',
                        ],
                    ],
                ],
                'difficulty_rating' => 3,
                'sort_order' => 1,
                'xp_reward' => 30,
            ],
            [
                'title' => 'Fork Puzzles',
                'slug' => 'fork-puzzles',
                'lesson_type' => 'puzzle',
                'content_data' => [
                    'type' => 'puzzle',
                    'puzzles' => [
                        [
                            'fen' => 'r3k2r/8/8/8/4N3/8/8/8 w KQkq - 0 1',
                            'objective' => 'Win material with a fork',
                            'solution' => ['Ne6+'],
                            'hints' => ['Look for a knight fork', 'The knight can attack the king and rook simultaneously'],
                        ],
                        [
                            'fen' => '8/8/8/3N4/8/8/8/8 w - - 0 1',
                            'objective' => 'Create a fork attack',
                            'solution' => ['Nc6+'],
                            'hints' => ['The knight on d4 can attack multiple pieces', 'Find the best square for the knight'],
                        ],
                    ],
                ],
                'difficulty_rating' => 4,
                'sort_order' => 2,
                'xp_reward' => 35,
            ],
        ];

        foreach ($tacticsLessons as $lessonData) {
            $tacticsModule->lessons()->create($lessonData);
        }

        // Module 3: Basic Checkmates
        $checkmatesModule = TutorialModule::create([
            'name' => 'Basic Checkmates',
            'slug' => 'basic-checkmates',
            'skill_tier' => 'beginner',
            'description' => 'Master the fundamental checkmating patterns',
            'icon' => '♔',
            'sort_order' => 3,
            'unlock_requirement_id' => $tacticsModule->id,
            'estimated_duration_minutes' => 50,
        ]);

        $checkmatesLessons = [
            [
                'title' => 'Queen and King Checkmate',
                'slug' => 'queen-king-checkmate',
                'lesson_type' => 'practice_game',
                'content_data' => [
                    'type' => 'practice_game',
                    'practice_config' => [
                        'starting_position' => '8/8/8/8/8/8/3k4/4K2Q w - - 0 1',
                        'objective' => 'Checkmate the lone king using queen and king',
                        'ai_difficulty' => 'easy',
                        'max_moves' => 20,
                    ],
                ],
                'difficulty_rating' => 3,
                'sort_order' => 1,
                'xp_reward' => 40,
            ],
            [
                'title' => 'Two Rook Checkmate',
                'slug' => 'two-rook-checkmate',
                'lesson_type' => 'practice_game',
                'content_data' => [
                    'type' => 'practice_game',
                    'practice_config' => [
                        'starting_position' => '8/8/8/8/8/8/3k4/2KR3R w - - 0 1',
                        'objective' => 'Checkmate using the method of two rooks',
                        'ai_difficulty' => 'easy',
                        'max_moves' => 15,
                    ],
                ],
                'difficulty_rating' => 4,
                'sort_order' => 2,
                'xp_reward' => 45,
            ],
        ];

        foreach ($checkmatesLessons as $lessonData) {
            $checkmatesModule->lessons()->create($lessonData);
        }
    }

    private function createIntermediateModules(): void
    {
        // Module 4: Opening Principles
        $openingModule = TutorialModule::create([
            'name' => 'Opening Principles',
            'slug' => 'opening-principles',
            'skill_tier' => 'intermediate',
            'description' => 'Master the fundamental principles of chess openings',
            'icon' => '📖',
            'sort_order' => 4,
            'estimated_duration_minutes' => 75,
        ]);

        $openingLessons = [
            [
                'title' => 'Control the Center',
                'slug' => 'control-center',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'The Importance of the Center',
                            'content' => '<p>Controlling the center squares (d4, e4, d5, e5) is crucial in chess openings.</p>',
                        ],
                        [
                            'title' => 'Classical Opening Principles',
                            'content' => '<p>1. Control the center<br>2. Develop your pieces<br>3. Castle early<br>4. Don\'t move the same piece twice</p>',
                        ],
                    ],
                ],
                'difficulty_rating' => 5,
                'sort_order' => 1,
                'xp_reward' => 50,
            ],
        ];

        foreach ($openingLessons as $lessonData) {
            $openingModule->lessons()->create($lessonData);
        }
    }

    private function createAdvancedModules(): void
    {
        // Module 5: Advanced Endgames
        $endgameModule = TutorialModule::create([
            'name' => 'Advanced Endgames',
            'slug' => 'advanced-endgames',
            'skill_tier' => 'advanced',
            'description' => 'Master complex endgame techniques and theoretical positions',
            'icon' => '♕',
            'sort_order' => 5,
            'estimated_duration_minutes' => 90,
        ]);

        $endgameLessons = [
            [
                'title' => 'Rook Endgames',
                'slug' => 'rook-endgames',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'Rook Endgame Fundamentals',
                            'content' => '<p>Rook endgames are the most common type of endgame in chess.</p>',
                        ],
                        [
                            'title' => 'Lucena Position',
                            'content' => '<p>The Lucena position is a fundamental winning technique in rook endgames.</p>',
                        ],
                    ],
                ],
                'difficulty_rating' => 8,
                'sort_order' => 1,
                'xp_reward' => 60,
            ],
        ];

        foreach ($endgameLessons as $lessonData) {
            $endgameModule->lessons()->create($lessonData);
        }
    }

    /**
     * Disable foreign key checks in a database-agnostic way
     */
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

    /**
     * Enable foreign key checks in a database-agnostic way
     */
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