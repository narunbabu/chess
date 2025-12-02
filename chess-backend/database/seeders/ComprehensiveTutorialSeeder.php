<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\TutorialAchievement;
use App\Models\InteractiveLessonStage;
use Illuminate\Support\Facades\DB;

class ComprehensiveTutorialSeeder extends Seeder
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
        InteractiveLessonStage::truncate();
        $this->enableForeignKeyChecks();

        $this->createAchievements();
        $this->createPieceMovementModule();
        $this->createChessBasicsModule();
        $this->createBasicTacticsModule();
        $this->createBasicCheckmatesModule();
        $this->createOpeningPrinciplesModule();
        $this->createAdvancedEndgamesModule();

        echo "✅ Comprehensive tutorial system seeded successfully!\n";
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
                'name' => 'Piece Master',
                'slug' => 'piece-master',
                'description' => 'Learn how all chess pieces move',
                'icon' => '♟️',
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 6,
                'xp_reward' => 50,
            ],
            [
                'name' => 'Chess Novice',
                'slug' => 'chess-novice',
                'description' => 'Complete 10 lessons',
                'icon' => '🎓',
                'tier' => 'silver',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 10,
                'xp_reward' => 75,
            ],
            [
                'name' => 'Tactic Master',
                'slug' => 'tactic-master',
                'description' => 'Complete all basic tactics lessons',
                'icon' => '⚔️',
                'tier' => 'silver',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 15,
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
            [
                'name' => 'Chess Scholar',
                'slug' => 'chess-scholar',
                'description' => 'Complete 25 lessons',
                'icon' => '📚',
                'tier' => 'gold',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 25,
                'xp_reward' => 150,
            ],
            [
                'name' => 'Opening Expert',
                'slug' => 'opening-expert',
                'description' => 'Complete all opening theory lessons',
                'icon' => '📖',
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

        echo "✓ Created " . count($achievements) . " achievements\n";
    }

    private function createPieceMovementModule(): void
    {
        $module = TutorialModule::create([
            'name' => 'Introduction to Chess Pieces',
            'slug' => 'piece-movements',
            'skill_tier' => 'beginner',
            'description' => 'Learn how each chess piece moves - Pawn, Rook, Knight, Bishop, Queen, and King',
            'icon' => '♟️',
            'sort_order' => 1,
            'estimated_duration_minutes' => 60,
        ]);

        // Lesson 1: The Pawn
        $pawnLesson = $module->lessons()->create([
            'title' => 'The Pawn - Your First Piece',
            'slug' => 'pawn-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 1,
            'sort_order' => 1,
            'xp_reward' => 20,
        ]);

        $this->createPawnStages($pawnLesson);

        // Lesson 2: The Rook
        $rookLesson = $module->lessons()->create([
            'title' => 'The Rook - The Castle Tower',
            'slug' => 'rook-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 1,
            'sort_order' => 2,
            'xp_reward' => 20,
        ]);

        $this->createRookStages($rookLesson);

        // Lesson 3: The Knight
        $knightLesson = $module->lessons()->create([
            'title' => 'The Knight - The Jumping Horse',
            'slug' => 'knight-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 2,
            'sort_order' => 3,
            'xp_reward' => 25,
        ]);

        $this->createKnightStages($knightLesson);

        // Lesson 4: The Bishop
        $bishopLesson = $module->lessons()->create([
            'title' => 'The Bishop - The Diagonal Slider',
            'slug' => 'bishop-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 2,
            'sort_order' => 4,
            'xp_reward' => 25,
        ]);

        $this->createBishopStages($bishopLesson);

        // Lesson 5: The Queen
        $queenLesson = $module->lessons()->create([
            'title' => 'The Queen - The Most Powerful Piece',
            'slug' => 'queen-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 2,
            'sort_order' => 5,
            'xp_reward' => 30,
        ]);

        $this->createQueenStages($queenLesson);

        // Lesson 6: The King
        $kingLesson = $module->lessons()->create([
            'title' => 'The King - The Most Important Piece',
            'slug' => 'king-movement',
            'lesson_type' => 'interactive',
            'content_data' => ['type' => 'interactive'],
            'difficulty_rating' => 1,
            'sort_order' => 6,
            'xp_reward' => 20,
        ]);

        $this->createKingStages($kingLesson);

        echo "✓ Created Piece Movements module with 6 lessons\n";
    }

    private function createPawnStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'How the Pawn Moves',
                'instruction_text' => 'The pawn moves forward one square at a time. On its first move, it can move two squares! Try moving the white pawn.',
                'initial_fen' => '4k3/8/8/8/8/8/3P4/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the pawn forward']
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'Click on the pawn on d2',
                    'You can move it to d3 or d4 (first move special)',
                    'Pawns can only move forward, never backward'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'd2', 'to' => 'd3'], ['from' => 'd2', 'to' => 'd4']],
                    'highlights' => ['d2', 'd3', 'd4']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! Pawns move forward.',
                    'incorrect' => 'Try moving the pawn forward only.',
                    'hint' => 'Pawns move straight ahead.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'How the Pawn Captures',
                'instruction_text' => 'Pawns capture diagonally! Capture the black pawn using your white pawn.',
                'initial_fen' => '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture the black pawn']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'Pawns capture one square diagonally forward',
                    'Your e4 pawn can capture on d5',
                    'Pawns don\'t capture straight ahead'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e4', 'to' => 'd5']],
                    'highlights' => ['e4', 'd5']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! Pawns capture diagonally.',
                    'incorrect' => 'Remember: pawns capture diagonally.',
                    'hint' => 'Try moving e4 to d5.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 3,
                'title' => 'Pawn Quiz',
                'instruction_text' => 'Quick quiz: Which square can this pawn move to?',
                'initial_fen' => '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the pawn correctly']
                ],
                'success_criteria' => [
                    ['type' => 'correct_move', 'value' => 1]
                ],
                'hints' => [
                    'First move can be 1 or 2 squares',
                    'This pawn hasn\'t moved yet',
                    'Try e3 or e4'
                ],
                'visual_aids' => [
                    'arrows' => [],
                    'highlights' => ['e2']
                ],
                'feedback_messages' => [
                    'correct' => 'Great job! You understand pawn movement!',
                    'incorrect' => 'Review: pawns move forward 1-2 squares on first move.',
                    'hint' => 'This is the pawn\'s first move.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createRookStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'How the Rook Moves',
                'instruction_text' => 'The rook moves in straight lines - horizontally or vertically, any number of squares! Try moving the white rook.',
                'initial_fen' => '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the rook along a rank or file']
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'Rooks move horizontally or vertically',
                    'They can move any number of squares',
                    'Try moving along the 4th rank or d-file'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['from' => 'd4', 'to' => 'd8'],
                        ['from' => 'd4', 'to' => 'd1'],
                        ['from' => 'd4', 'to' => 'a4'],
                        ['from' => 'd4', 'to' => 'h4']
                    ],
                    'highlights' => ['d4', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4', 'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! Rooks move in straight lines.',
                    'incorrect' => 'Rooks can only move horizontally or vertically.',
                    'hint' => 'Think of a plus sign (+) pattern.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Rook Captures',
                'instruction_text' => 'Capture the black pawn with your rook!',
                'initial_fen' => '4k3/8/8/3p4/3R4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture the black pawn']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'The rook on d4 can capture on d5',
                    'Rooks capture by landing on the enemy piece',
                    'Move along the d-file'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'd4', 'to' => 'd5']],
                    'highlights' => ['d4', 'd5']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent capture!',
                    'incorrect' => 'Try moving the rook vertically to d5.',
                    'hint' => 'Rooks move in straight lines to capture.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createKnightStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'How the Knight Moves',
                'instruction_text' => 'The knight moves in an "L" shape - 2 squares in one direction and 1 square perpendicular. It can jump over other pieces! Try it.',
                'initial_fen' => '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the knight in an L-shape']
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'Knights move in an L-shape: 2+1 or 1+2',
                    'From d4, the knight can reach 8 squares',
                    'Try c2, e2, f3, f5, e6, c6, b5, or b3'
                ],
                'visual_aids' => [
                    'arrows' => $this->generateKnightLShapeArrows('d4', [
                        'c2', 'e2', 'f3', 'f5', 'e6', 'c6', 'b5', 'b3'
                    ]),
                    'highlights' => ['d4', 'c2', 'e2', 'f3', 'f5', 'e6', 'c6', 'b5', 'b3']
                ],
                'feedback_messages' => [
                    'correct' => 'Great! Knights move in an L-shape.',
                    'incorrect' => 'Knights must move in an L-shape (2+1).',
                    'hint' => 'Think of drawing an L on the board.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Knight Jumping',
                'instruction_text' => 'Knights can jump over pieces! Move the knight over the pawn to capture the black pawn on e6.',
                'initial_fen' => '4k3/8/4p3/8/3N4/3P4/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Jump over pieces to capture']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'Knights are the only piece that can jump',
                    'The white pawn on d3 doesn\'t block the knight',
                    'Move from d4 to e6 in an L-shape to capture'
                ],
                'visual_aids' => [
                    'arrows' => $this->generateKnightLShapeArrows('d4', ['e6'], 'rgba(239, 68, 68, 0.8)'),
                    'highlights' => ['d4', 'e6', 'd3']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! Knights can jump over pieces.',
                    'incorrect' => 'Use the knight\'s jumping ability.',
                    'hint' => 'Move to e6 in an L-shape.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createBishopStages($lesson): void
    {
        $stages = [
            // STAGE 1: Introduction & Demonstration (View-only, no action required)
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'Meet the Bishop! ♗',
                'instruction_text' => 'This is the BISHOP ♗. The bishop moves DIAGONALLY any number of squares! It slides along diagonal lines like this: ↗ ↖ ↘ ↙. Notice how all the arrows point diagonally from the bishop in an X pattern. Each bishop stays on its starting color forever!',
                'initial_fen' => '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'demonstration',
                        'description' => 'Observe how the bishop moves diagonally',
                        'auto_complete' => true
                    ]
                ],
                'success_criteria' => [
                    ['type' => 'observation', 'value' => 1]
                ],
                'hints' => [
                    'Look at the arrows - they all point diagonally!',
                    'Bishops move in 4 diagonal directions',
                    'Think of an X pattern from the bishop',
                    'This bishop is on a light square and stays on light squares forever'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['from' => 'd4', 'to' => 'a1', 'color' => 'rgba(34, 197, 94, 0.8)'],
                        ['from' => 'd4', 'to' => 'g1', 'color' => 'rgba(34, 197, 94, 0.8)'],
                        ['from' => 'd4', 'to' => 'a7', 'color' => 'rgba(34, 197, 94, 0.8)'],
                        ['from' => 'd4', 'to' => 'h8', 'color' => 'rgba(34, 197, 94, 0.8)']
                    ],
                    'highlights' => ['d4', 'a1', 'b2', 'c3', 'e5', 'f6', 'g7', 'h8', 'g1', 'f2', 'e3', 'c5', 'b6', 'a7']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! You moved the bishop diagonally! Bishops move in an X pattern.',
                    'incorrect' => 'Remember: bishops only move diagonally. Try following one of the arrows!',
                    'hint' => 'Bishops move diagonally - like an X from their position.'
                ]
            ],

            // STAGE 2: Guided Practice - Any Valid Diagonal Move
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Your Turn - Move the Bishop!',
                'instruction_text' => 'Now YOU try! Click the white bishop and move it to ANY diagonal square. The arrows show some example moves you can make. All diagonal moves are correct!',
                'initial_fen' => '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'move_piece',
                        'piece' => 'bishop',
                        'description' => 'Move the bishop to any diagonal square',
                        'feedback_success' => 'Excellent! You moved the bishop diagonally! ✨',
                        'feedback_fail' => 'Remember: bishops only move diagonally. Look at the arrows and try again!'
                    ]
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'Click on the bishop at d4',
                    'Bishops move diagonally only - no straight moves!',
                    'Try moving to any highlighted square',
                    'All diagonal moves are correct - pick any direction!'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['from' => 'd4', 'to' => 'a7', 'color' => 'rgba(59, 130, 246, 0.7)'],
                        ['from' => 'd4', 'to' => 'g1', 'color' => 'rgba(59, 130, 246, 0.7)'],
                        ['from' => 'd4', 'to' => 'h8', 'color' => 'rgba(59, 130, 246, 0.7)']
                    ],
                    'highlights' => ['d4', 'c3', 'e5', 'f6', 'g7', 'b2', 'f2']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! You moved the bishop diagonally! ✨',
                    'incorrect' => 'Remember: bishops only move diagonally. Look at the arrows and try again!',
                    'hint' => 'Think of an X pattern from the bishop - pick any diagonal direction.'
                ]
            ],

            // STAGE 3: Challenge - Capture the Pawn
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 3,
                'title' => 'Bishop Captures ⚔️',
                'instruction_text' => 'Great! Now let\'s learn how bishops capture. Bishops capture by landing on enemy pieces. Move your bishop to capture the black pawn!',
                'initial_fen' => '4k3/8/5p2/8/3B4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture the black pawn on f6']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'The pawn is on f6 - can the bishop reach it diagonally?',
                    'Follow the diagonal path: d4 → e5 → f6',
                    'Bishops capture by landing on the enemy piece',
                    'Move the bishop from d4 to f6 to capture!'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'd4', 'to' => 'f6', 'color' => 'rgba(239, 68, 68, 0.8)']],
                    'highlights' => ['d4', 'e5', 'f6']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect capture! 🎯 You understand how bishops move and capture! The bishop moved diagonally and captured the pawn.',
                    'incorrect' => 'Not quite. Move the bishop diagonally to f6 to capture the pawn.',
                    'hint' => 'Follow the red arrow - move diagonally from d4 to f6.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createQueenStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'How the Queen Moves',
                'instruction_text' => 'The queen is the most powerful piece! It combines the moves of the rook and bishop - moving horizontally, vertically, or diagonally, any number of squares.',
                'initial_fen' => '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the queen']
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'The queen moves like a rook + bishop combined',
                    'She can move in 8 directions',
                    'Try any horizontal, vertical, or diagonal move'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['from' => 'd4', 'to' => 'd8'],
                        ['from' => 'd4', 'to' => 'd1'],
                        ['from' => 'd4', 'to' => 'a4'],
                        ['from' => 'd4', 'to' => 'h4'],
                        ['from' => 'd4', 'to' => 'a1'],
                        ['from' => 'd4', 'to' => 'h8'],
                        ['from' => 'd4', 'to' => 'a7'],
                        ['from' => 'd4', 'to' => 'g1']
                    ],
                    'highlights' => ['d4']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! The queen is very powerful.',
                    'incorrect' => 'Queens move like rooks + bishops.',
                    'hint' => 'The queen can move in any straight line.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Queen Captures',
                'instruction_text' => 'Capture the black pawn with your queen!',
                'initial_fen' => '4k3/8/5p2/8/3Q4/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture the black pawn']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'The queen can capture diagonally like a bishop',
                    'Or horizontally/vertically like a rook',
                    'Find the path to f6'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'd4', 'to' => 'f6']],
                    'highlights' => ['d4', 'f6']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! The queen is a powerful attacker.',
                    'incorrect' => 'Use the queen\'s flexible movement.',
                    'hint' => 'Move diagonally to f6.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createKingStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'How the King Moves',
                'instruction_text' => 'The king is the most important piece! It moves one square in any direction. If your king is captured, you lose the game.',
                'initial_fen' => '4k3/8/8/8/3K4/8/8/8 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_piece', 'description' => 'Move the king one square']
                ],
                'success_criteria' => [
                    ['type' => 'piece_moved', 'value' => 1]
                ],
                'hints' => [
                    'The king moves one square at a time',
                    'It can move in any direction',
                    'Try moving to any adjacent square'
                ],
                'visual_aids' => [
                    'arrows' => [],
                    'highlights' => ['d4', 'c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5']
                ],
                'feedback_messages' => [
                    'correct' => 'Good! Remember to protect your king.',
                    'incorrect' => 'The king moves only one square.',
                    'hint' => 'Move to any adjacent square.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'King Safety',
                'instruction_text' => 'Your king is in check from the rook! You must move it to a safe square where it won\'t be attacked.',
                'initial_fen' => '4rk2/8/8/8/8/8/8/4K3 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'escape_check', 'description' => 'Move the king to safety']
                ],
                'success_criteria' => [
                    ['type' => 'king_safe', 'value' => 1]
                ],
                'hints' => [
                    'The rook on e8 attacks along the e-file',
                    'Find a square not on the e-file',
                    'Try d1, d2, f1, or f2'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e8', 'to' => 'e1']],
                    'highlights' => ['e1', 'd1', 'd2', 'f1', 'f2']
                ],
                'feedback_messages' => [
                    'correct' => 'Safe! Always protect your king.',
                    'incorrect' => 'That square is still under attack.',
                    'hint' => 'Move away from the e-file.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createChessBasicsModule(): void
    {
        $previousModule = TutorialModule::where('slug', 'piece-movements')->first();

        $module = TutorialModule::create([
            'name' => 'Chess Basics',
            'slug' => 'chess-basics',
            'skill_tier' => 'beginner',
            'description' => 'Learn the fundamentals - board setup, notation, castling, and special moves',
            'icon' => '♟️',
            'sort_order' => 2,
            'unlock_requirement_id' => $previousModule->id,
            'estimated_duration_minutes' => 45,
        ]);

        $lessons = [
            [
                'title' => 'The Chessboard & Setup',
                'slug' => 'chessboard-setup',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'Welcome to Chess!',
                            'content' => '<p>Chess is played on an 8x8 board with 64 squares alternating between light and dark colors.</p>',
                            'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        ],
                        [
                            'title' => 'Files and Ranks',
                            'content' => '<p>Columns are called "files" (a-h) and rows are called "ranks" (1-8). Each square has a unique name like "e4".</p>',
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
                                    'question' => 'What is the bottom-left square called?',
                                    'options' => ['a1', 'a8', 'h1', 'h8'],
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
                'title' => 'Castling - A Special Move',
                'slug' => 'castling',
                'lesson_type' => 'interactive',
                'content_data' => ['type' => 'interactive'],
                'difficulty_rating' => 3,
                'sort_order' => 2,
                'xp_reward' => 30,
            ],
            [
                'title' => 'En Passant - Special Pawn Capture',
                'slug' => 'en-passant',
                'lesson_type' => 'interactive',
                'content_data' => ['type' => 'interactive'],
                'difficulty_rating' => 3,
                'sort_order' => 3,
                'xp_reward' => 30,
            ],
        ];

        foreach ($lessons as $lessonData) {
            $lesson = $module->lessons()->create($lessonData);

            // Create stages for interactive lessons
            if ($lessonData['slug'] === 'castling') {
                $this->createCastlingStages($lesson);
            } elseif ($lessonData['slug'] === 'en-passant') {
                $this->createEnPassantStages($lesson);
            }
        }

        echo "✓ Created Chess Basics module with " . count($lessons) . " lessons\n";
    }

    private function createCastlingStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'Kingside Castling',
                'instruction_text' => 'Castling is a special move! To castle kingside, move your king two squares toward the rook on h1. The rook will automatically jump to the other side of the king.',
                'initial_fen' => '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'castle', 'description' => 'Castle kingside']
                ],
                'success_criteria' => [
                    ['type' => 'castled', 'value' => 1]
                ],
                'hints' => [
                    'The king must not have moved yet',
                    'The rook must not have moved yet',
                    'There must be no pieces between them',
                    'Drag your king two squares to the right (g1)'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e1', 'to' => 'g1']],
                    'highlights' => ['e1', 'g1', 'h1']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! You castled kingside. This protects your king and activates your rook.',
                    'incorrect' => 'Remember: move the king two squares toward the rook.',
                    'hint' => 'Drag the king from e1 to g1.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Queenside Castling',
                'instruction_text' => 'Now try castling queenside! Move your king two squares toward the rook on a1.',
                'initial_fen' => '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'castle', 'description' => 'Castle queenside']
                ],
                'success_criteria' => [
                    ['type' => 'castled', 'value' => 1]
                ],
                'hints' => [
                    'Castling queenside is longer',
                    'Move the king two squares to the left',
                    'The rook will jump over to d1',
                    'Drag your king from e1 to c1'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e1', 'to' => 'c1']],
                    'highlights' => ['e1', 'c1', 'a1']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! Queenside castling complete.',
                    'incorrect' => 'Move the king two squares toward the a-file rook.',
                    'hint' => 'Drag the king from e1 to c1.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 3,
                'title' => 'When You Cannot Castle',
                'instruction_text' => 'You cannot castle when your king is in check! Move your king to safety instead.',
                'initial_fen' => '4k3/8/8/8/8/4r3/8/4K2R w K - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'escape_check', 'description' => 'Move the king to safety']
                ],
                'success_criteria' => [
                    ['type' => 'king_safe', 'value' => 1]
                ],
                'hints' => [
                    'Your king is in check from the rook on e3',
                    'You cannot castle while in check',
                    'Move your king to a safe square',
                    'Try moving to d1, d2, f1, or f2'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e3', 'to' => 'e1']],
                    'highlights' => ['e1', 'd1', 'd2', 'f1', 'f2']
                ],
                'feedback_messages' => [
                    'correct' => 'Good! Remember: you cannot castle when in check.',
                    'incorrect' => 'You cannot castle while in check. Move to safety.',
                    'hint' => 'Get out of check first.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createEnPassantStages($lesson): void
    {
        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'En Passant Setup',
                'instruction_text' => 'En passant is a special pawn capture! When an enemy pawn moves two squares forward from its starting position and lands beside your pawn, you can capture it as if it only moved one square.',
                'initial_fen' => '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'demonstration', 'description' => 'Learn about en passant', 'auto_complete' => true]
                ],
                'success_criteria' => [
                    ['type' => 'observation', 'value' => 1]
                ],
                'hints' => [
                    'The black pawn just moved from d7 to d5',
                    'It landed beside your white pawn on e5',
                    'You can capture it en passant by moving to d6',
                    'This capture is only available immediately after the pawn\'s two-square move'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e5', 'to' => 'd6', 'color' => 'rgba(34, 197, 94, 0.8)']],
                    'highlights' => ['d5', 'e5', 'd6']
                ],
                'feedback_messages' => [
                    'correct' => 'Great! You understand the en passant setup.',
                    'incorrect' => '',
                    'hint' => 'Study the position - the black pawn just moved two squares.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Execute En Passant',
                'instruction_text' => 'Now try it! Capture the black pawn en passant.',
                'initial_fen' => '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture en passant']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'Move your e5 pawn diagonally to d6',
                    'This will capture the pawn on d5',
                    'Even though you move to d6, you capture the pawn on d5'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e5', 'to' => 'd6', 'color' => 'rgba(239, 68, 68, 0.8)']],
                    'highlights' => ['e5', 'd6', 'd5']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! You captured en passant! This is a unique pawn move.',
                    'incorrect' => 'Move your pawn from e5 to d6 to capture en passant.',
                    'hint' => 'Move diagonally to d6, even though the pawn is on d5.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 3,
                'title' => 'En Passant from the Other Side',
                'instruction_text' => 'En passant works from either side! The black pawn on f5 just moved two squares. Capture it!',
                'initial_fen' => '4k3/8/8/4Pp2/8/8/8/4K3 w - f6 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture', 'description' => 'Capture en passant']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'The pawn on f5 just moved from f7 to f5',
                    'Your e5 pawn can capture it en passant',
                    'Move from e5 to f6 to capture'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e5', 'to' => 'f6', 'color' => 'rgba(239, 68, 68, 0.8)']],
                    'highlights' => ['e5', 'f6', 'f5']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! You mastered en passant from both sides!',
                    'incorrect' => 'Capture the f5 pawn by moving to f6.',
                    'hint' => 'Move your e5 pawn to f6.'
                ]
            ]
        ];

        foreach ($stages as $stage) {
            InteractiveLessonStage::create($stage);
        }
    }

    private function createBasicTacticsModule(): void
    {
        $previousModule = TutorialModule::where('slug', 'chess-basics')->first();

        $module = TutorialModule::create([
            'name' => 'Basic Tactics',
            'slug' => 'basic-tactics',
            'skill_tier' => 'beginner',
            'description' => 'Learn fundamental tactical patterns like forks, pins, and skewers',
            'icon' => '⚔️',
            'sort_order' => 3,
            'unlock_requirement_id' => $previousModule->id,
            'estimated_duration_minutes' => 60,
        ]);

        $lessons = [
            [
                'title' => 'Understanding Forks',
                'slug' => 'understanding-forks',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'What is a Fork?',
                            'content' => '<p>A fork is when one piece attacks two or more enemy pieces at the same time.</p>',
                        ],
                        [
                            'title' => 'Knight Forks',
                            'content' => '<p>Knights are especially good at forks because of their unique L-shaped movement.</p>',
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
                            'fen' => 'r3k2r/8/8/8/4N3/8/8/8 w - - 0 1',
                            'objective' => 'Win material with a fork',
                            'solution' => ['Nf6+'],
                            'hints' => ['The knight can attack king and rook', 'Check all L-shaped moves'],
                        ],
                    ],
                ],
                'difficulty_rating' => 4,
                'sort_order' => 2,
                'xp_reward' => 35,
            ],
            [
                'title' => 'Understanding Pins',
                'slug' => 'understanding-pins',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'What is a Pin?',
                            'content' => '<p>A pin is when a piece cannot move without exposing a more valuable piece behind it.</p>',
                        ],
                    ],
                ],
                'difficulty_rating' => 3,
                'sort_order' => 3,
                'xp_reward' => 30,
            ],
        ];

        foreach ($lessons as $lessonData) {
            $module->lessons()->create($lessonData);
        }

        echo "✓ Created Basic Tactics module with " . count($lessons) . " lessons\n";
    }

    private function createBasicCheckmatesModule(): void
    {
        $previousModule = TutorialModule::where('slug', 'basic-tactics')->first();

        $module = TutorialModule::create([
            'name' => 'Basic Checkmates',
            'slug' => 'basic-checkmates',
            'skill_tier' => 'beginner',
            'description' => 'Master the fundamental checkmating patterns',
            'icon' => '♔',
            'sort_order' => 4,
            'unlock_requirement_id' => $previousModule->id,
            'estimated_duration_minutes' => 50,
        ]);

        $lessons = [
            [
                'title' => 'Queen and King Checkmate',
                'slug' => 'queen-king-checkmate',
                'lesson_type' => 'practice_game',
                'content_data' => [
                    'type' => 'practice_game',
                    'practice_config' => [
                        'starting_position' => '8/8/8/8/8/8/3k4/4K2Q w - - 0 1',
                        'objective' => 'Checkmate the lone king',
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
                        'objective' => 'Checkmate using two rooks',
                        'ai_difficulty' => 'easy',
                        'max_moves' => 15,
                    ],
                ],
                'difficulty_rating' => 4,
                'sort_order' => 2,
                'xp_reward' => 45,
            ],
        ];

        foreach ($lessons as $lessonData) {
            $module->lessons()->create($lessonData);
        }

        echo "✓ Created Basic Checkmates module with " . count($lessons) . " lessons\n";
    }

    private function createOpeningPrinciplesModule(): void
    {
        $module = TutorialModule::create([
            'name' => 'Opening Principles',
            'slug' => 'opening-principles',
            'skill_tier' => 'intermediate',
            'description' => 'Master the fundamental principles of chess openings',
            'icon' => '📖',
            'sort_order' => 5,
            'estimated_duration_minutes' => 75,
        ]);

        $lessons = [
            [
                'title' => 'Control the Center',
                'slug' => 'control-center',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'The Importance of the Center',
                            'content' => '<p>Controlling the center squares (d4, e4, d5, e5) is crucial.</p>',
                        ],
                        [
                            'title' => 'Opening Principles',
                            'content' => '<p>1. Control the center<br>2. Develop pieces<br>3. Castle early<br>4. Don\'t move the same piece twice</p>',
                        ],
                    ],
                ],
                'difficulty_rating' => 5,
                'sort_order' => 1,
                'xp_reward' => 50,
            ],
        ];

        foreach ($lessons as $lessonData) {
            $module->lessons()->create($lessonData);
        }

        echo "✓ Created Opening Principles module with " . count($lessons) . " lesson\n";
    }

    private function createAdvancedEndgamesModule(): void
    {
        $module = TutorialModule::create([
            'name' => 'Advanced Endgames',
            'slug' => 'advanced-endgames',
            'skill_tier' => 'advanced',
            'description' => 'Master complex endgame techniques',
            'icon' => '♕',
            'sort_order' => 6,
            'estimated_duration_minutes' => 90,
        ]);

        $lessons = [
            [
                'title' => 'Rook Endgames',
                'slug' => 'rook-endgames',
                'lesson_type' => 'theory',
                'content_data' => [
                    'type' => 'theory',
                    'slides' => [
                        [
                            'title' => 'Rook Endgame Fundamentals',
                            'content' => '<p>Rook endgames are the most common endgame type.</p>',
                        ],
                    ],
                ],
                'difficulty_rating' => 8,
                'sort_order' => 1,
                'xp_reward' => 60,
            ],
        ];

        foreach ($lessons as $lessonData) {
            $module->lessons()->create($lessonData);
        }

        echo "✓ Created Advanced Endgames module with " . count($lessons) . " lesson\n";
    }

    /**
     * Generate L-shaped arrows for knight moves
     *
     * @param string $from Starting square (e.g., 'd4')
     * @param array $destinations Array of destination squares (e.g., ['c2', 'e2'])
     * @param string $color Arrow color (default: green)
     * @return array Array of arrow segments showing L-shape
     */
    private function generateKnightLShapeArrows(string $from, array $destinations, string $color = 'rgba(34, 197, 94, 0.8)'): array
    {
        $arrows = [];

        // Convert chess notation to coordinates
        $fromFile = ord($from[0]) - ord('a'); // 0-7
        $fromRank = intval($from[1]) - 1; // 0-7

        foreach ($destinations as $to) {
            $toFile = ord($to[0]) - ord('a');
            $toRank = intval($to[1]) - 1;

            // Calculate the difference
            $fileDiff = $toFile - $fromFile;
            $rankDiff = $toRank - $fromRank;

            // Determine the L-shape path
            // Knight moves are always 2 squares in one direction and 1 in perpendicular direction
            if (abs($fileDiff) == 2 && abs($rankDiff) == 1) {
                // 2 horizontal, 1 vertical
                $midFile = $fromFile + $fileDiff;
                $midRank = $fromRank;
                $midSquare = chr(ord('a') + $midFile) . ($midRank + 1);

                $arrows[] = ['from' => $from, 'to' => $midSquare, 'color' => $color];
                $arrows[] = ['from' => $midSquare, 'to' => $to, 'color' => $color];
            } elseif (abs($fileDiff) == 1 && abs($rankDiff) == 2) {
                // 2 vertical, 1 horizontal
                $midFile = $fromFile;
                $midRank = $fromRank + $rankDiff;
                $midSquare = chr(ord('a') + $midFile) . ($midRank + 1);

                $arrows[] = ['from' => $from, 'to' => $midSquare, 'color' => $color];
                $arrows[] = ['from' => $midSquare, 'to' => $to, 'color' => $color];
            }
        }

        return $arrows;
    }

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
