<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use Illuminate\Support\Facades\DB;

class InteractiveLessonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get or create the Interactive module
        $interactiveModule = TutorialModule::firstOrCreate(
            ['slug' => 'interactive-basics'],
            [
                'name' => 'Interactive Chess Basics',
                'description' => 'Learn chess fundamentals through interactive exercises',
                'skill_tier' => 'beginner',
                'sort_order' => 1,
                'estimated_duration_minutes' => 180,
                'is_active' => true,
            ]
        );

        // Create sample interactive lessons
        $this->createPawnWarsLesson($interactiveModule);
        $this->createKingActivityLesson($interactiveModule);
        $this->createSafeSquaresLesson($interactiveModule);
        $this->createKnightMovementLesson($interactiveModule);
        $this->createCheckThreatsLesson($interactiveModule);
    }

    /**
     * Create Pawn Wars lesson
     */
    private function createPawnWarsLesson(TutorialModule $module): void
    {
        $lesson = TutorialLesson::firstOrCreate(
            ['slug' => 'pawn-wars-breakthrough'],
            [
                'module_id' => $module->id,
                'title' => 'Pawn Wars: The Breakthrough',
                'lesson_type' => 'interactive',
                'difficulty_rating' => 2,
                'sort_order' => 1,
                'estimated_duration_minutes' => 15,
                'xp_reward' => 50,
                'is_active' => true,
                'content_data' => [
                    'description' => 'Learn pawn breakthrough strategies in this exciting minigame!',
                    'learning_objectives' => [
                        'Understand pawn structure and breakthrough concepts',
                        'Identify passed pawns and promotion threats',
                        'Practice pawn breakthrough techniques'
                    ]
                ],
                'interactive_config' => [
                    'allow_all_moves' => true,
                    'show_coordinates' => true,
                    'blindfold_mode' => false,
                    'auto_reset_on_success' => true,
                    'reset_delay_ms' => 2000,
                    'show_feedback' => true,
                    'enable_hints' => true,
                    'max_hints_per_stage' => 3,
                ],
                'allow_invalid_fen' => true, // Allow FEN without Kings
                'validation_rules' => [
                    'validate_fen' => false,
                    'allow_illegal_positions' => true,
                    'check_piece_moves' => true,
                    'enforce_turn_order' => false,
                    'require_kings' => false,
                ],
                'interactive_type' => 'pawn_wars'
            ]
        );

        // Create stages for Pawn Wars
        $this->createPawnWarsStages($lesson);
    }

    /**
     * Create King Activity lesson
     */
    private function createKingActivityLesson(TutorialModule $module): void
    {
        $lesson = TutorialLesson::firstOrCreate(
            ['slug' => 'king-activity-centralization'],
            [
                'module_id' => $module->id,
                'title' => 'King Activity: Master Centralization',
                'lesson_type' => 'interactive',
                'difficulty_rating' => 3,
                'sort_order' => 2,
                'estimated_duration_minutes' => 20,
                'xp_reward' => 75,
                'is_active' => true,
                'content_data' => [
                    'description' => 'Master king activity and centralization in the endgame!',
                    'learning_objectives' => [
                        'Understand king activity principles',
                        'Practice king centralization',
                        'Learn active king vs passive king concepts'
                    ]
                ],
                'interactive_config' => [
                    'allow_all_moves' => true,
                    'show_coordinates' => true,
                    'blindfold_mode' => false,
                    'auto_reset_on_success' => true,
                    'reset_delay_ms' => 1500,
                    'show_feedback' => true,
                    'enable_hints' => true,
                    'max_hints_per_stage' => 2,
                ],
                'allow_invalid_fen' => false,
                'validation_rules' => [
                    'validate_fen' => true,
                    'allow_illegal_positions' => false,
                    'check_piece_moves' => true,
                    'enforce_turn_order' => false,
                    'require_kings' => true,
                ],
                'interactive_type' => 'king_activity'
            ]
        );

        $this->createKingActivityStages($lesson);
    }

    /**
     * Create Safe Squares lesson
     */
    private function createSafeSquaresLesson(TutorialModule $module): void
    {
        $lesson = TutorialLesson::firstOrCreate(
            ['slug' => 'safe-squares-navigation'],
            [
                'module_id' => $module->id,
                'title' => 'Safe Squares: Navigate the Minefield',
                'lesson_type' => 'interactive',
                'difficulty_rating' => 4,
                'sort_order' => 3,
                'estimated_duration_minutes' => 25,
                'xp_reward' => 100,
                'is_active' => true,
                'content_data' => [
                    'description' => 'Navigate your pieces safely through the minefield!',
                    'learning_objectives' => [
                        'Develop board vision and pattern recognition',
                        'Practice identifying safe squares',
                        'Understand piece safety and protection'
                    ]
                ],
                'interactive_config' => [
                    'allow_all_moves' => true,
                    'show_coordinates' => true,
                    'blindfold_mode' => false,
                    'auto_reset_on_success' => false,
                    'reset_delay_ms' => 1000,
                    'show_feedback' => true,
                    'enable_hints' => true,
                    'max_hints_per_stage' => 3,
                ],
                'allow_invalid_fen' => false,
                'validation_rules' => [
                    'validate_fen' => true,
                    'allow_illegal_positions' => false,
                    'check_piece_moves' => true,
                    'enforce_turn_order' => false,
                    'require_kings' => false,
                ],
                'interactive_type' => 'safe_squares'
            ]
        );

        $this->createSafeSquaresStages($lesson);
    }

    /**
     * Create Pawn Wars stages
     */
    private function createPawnWarsStages(TutorialLesson $lesson): void
    {
        $stages = [
            [
                'stage_order' => 1,
                'title' => 'Create Your First Passed Pawn',
                'instruction_text' => 'Create a passed pawn by breaking through the enemy structure. Click on the pawn that can become a passed pawn!',
                'initial_fen' => '8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1', // No Kings, only pawns
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'reach_square',
                        'target_squares' => ['a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6'],
                        'feedback_success' => '✅ Excellent! You identified a pawn that can breakthrough!',
                        'feedback_fail' => '❌ Not quite. Look for a pawn with no enemy pawns blocking its path.',
                        'score_reward' => 15
                    ]
                ],
                'hints' => [
                    'Look for pawns that have no enemy pawns in front of them or on adjacent files.',
                    'A passed pawn has a clear path to promotion without enemy pawn interference.',
                    'Focus on the structure: find gaps in the enemy pawn formation.'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'd2', 'end' => 'd6', 'color' => 'green']
                    ],
                    'highlights' => ['d2', 'e2', 'f2']
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 2000,
                'feedback_messages' => [
                    'success' => '🎯 Perfect! You understand pawn breakthrough concepts!',
                    'partial' => '👍 Getting closer! Consider the enemy pawn structure.',
                    'fail' => '🎯 Think about which pawn has the clearest path forward.'
                ],
                'is_active' => true
            ],
            [
                'stage_order' => 2,
                'title' => 'Blockade the Enemy Pawn',
                'instruction_text' => 'Move a piece to blockade the enemy passed pawn before it promotes!',
                'initial_fen' => '8/3P4/8/8/8/8/8/3p4 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'reach_square',
                        'target_squares' => ['c6', 'd6', 'e6'],
                        'feedback_success' => '✅ Perfect blockading! The enemy pawn is stopped.',
                        'feedback_fail' => '❌ That doesn\'t stop the pawn. Think about which square controls its path.',
                        'score_reward' => 20
                    ]
                ],
                'hints' => [
                    'Place your piece directly in front of the enemy pawn.',
                    'The best blockade is right on the square the pawn wants to reach.',
                    'Consider which piece can safely reach the blocking square.'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'd7', 'end' => 'd1', 'color' => 'red']
                    ],
                    'highlights' => ['d7', 'd6', 'd5']
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1500,
                'feedback_messages' => [
                    'success' => '🛡️ Excellent blockade! You stopped the threat.',
                    'partial' => '🔄 Almost there! Get right in front of that pawn.',
                    'fail' => '⚠️ The enemy pawn will promote if not stopped!'
                ],
                'is_active' => true
            ],
            [
                'stage_order' => 3,
                'title' => 'Race to Promotion',
                'instruction_text' => 'Race your pawn to promotion before the enemy can stop it!',
                'initial_fen' => '8/8/8/6P1/8/8/8/7p w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'make_move',
                        'valid_moves' => ['g5g6', 'g5g7', 'g5g8q', 'g5g8r', 'g5g8b', 'g5g8n'],
                        'feedback_success' => '🏁 Race won! Your pawn is promoting!',
                        'feedback_fail' => '❌ Wrong move. Push your pawn forward quickly!',
                        'score_reward' => 25
                    ]
                ],
                'alternative_solutions' => [
                    'g5g6' => 'A solid push forward',
                    'g5g7' => 'Even better, getting closer to promotion',
                    'g5g8q' => 'Immediate promotion! Excellent choice!'
                ],
                'hints' => [
                    'Push your pawn forward as fast as possible!',
                    'You can promote to Queen, Rook, Bishop, or Knight.',
                    'Promoting immediately wins the race.',
                    'Think about which promotion piece is strongest in this position.'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'g5', 'end' => 'g8', 'color' => 'gold'],
                        ['start' => 'h2', 'end' => 'h8', 'color' => 'red']
                    ]
                ],
                'auto_reset_on_success' => false, // This is the final stage
                'auto_reset_delay_ms' => 3000,
                'feedback_messages' => [
                    'success' => '👑 Congratulations! You\'ve mastered pawn breakthroughs!',
                    'partial' => '⚡ Good move, but can you do better?',
                    'fail' => '🏃 Faster! Push that pawn to promotion!'
                ],
                'is_active' => true
            ]
        ];

        foreach ($stages as $stageData) {
            InteractiveLessonStage::firstOrCreate(
                [
                    'lesson_id' => $lesson->id,
                    'stage_order' => $stageData['stage_order']
                ],
                $stageData
            );
        }
    }

    /**
     * Create King Activity stages
     */
    private function createKingActivityStages(TutorialLesson $lesson): void
    {
        $stages = [
            [
                'stage_order' => 1,
                'title' => 'Centralize Your King',
                'instruction_text' => 'Move your king to the center of the board. Central kings are more active!',
                'initial_fen' => '8/8/8/8/3k4/8/4K3/8 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'reach_square',
                        'target_squares' => ['d4', 'e4', 'd5', 'e5'],
                        'feedback_success' => '✅ Perfect! Centralization is a key endgame principle.',
                        'feedback_fail' => '❌ Too passive. Move your king toward the center squares.',
                        'score_reward' => 10
                    ]
                ],
                'hints' => [
                    'The center squares (d4, e4, d5, e5) provide maximum king activity.',
                    'Central kings control more squares and support both wings.',
                    'Endgames are all about king activity - be proactive!'
                ],
                'visual_aids' => [
                    'highlights' => ['d4', 'e4', 'd5', 'e5'],
                    'arrows' => [
                        ['start' => 'e3', 'end' => 'e4', 'color' => 'green']
                    ]
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1500,
                'feedback_messages' => [
                    'success' => '👑 King in the center - excellent strategic thinking!',
                    'fail' => '⚠️ Passive kings lose endgames. Be more aggressive!'
                ],
                'is_active' => true
            ],
            [
                'stage_order' => 2,
                'title' => 'Shoulder the Enemy King',
                'instruction_text' => 'Use your king to push the enemy king away and gain space!',
                'initial_fen' => '8/8/3k4/8/4K3/8/8/8 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'reach_square',
                        'target_squares' => ['c5', 'd5', 'e5'],
                        'feedback_success' => '✅ Excellent! You\'re shouldering the enemy king effectively.',
                        'feedback_fail' => '❌ You need to approach more aggressively to shoulder the enemy king.',
                        'score_reward' => 15
                    ]
                ],
                'hints' => [
                    'Shouldering means using your king to limit the enemy king\'s movement.',
                    'Get close to the enemy king but maintain the opposition when possible.',
                    'Active king play often wins endgames by itself!'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'd4', 'end' => 'd5', 'color' => 'blue']
                    ],
                    'highlights' => ['c6', 'd6', 'e6']
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1500,
                'feedback_messages' => [
                    'success' => '💪 Strong king play! You understand opposition and shoulder.',
                    'fail' => '🎯 Think about opposition - keep the enemy king boxed in.'
                ],
                'is_active' => true
            ],
            [
                'stage_order' => 3,
                'title' => 'King and Pawn Cooperation',
                'instruction_text' => 'Coordinate your king and pawn to create unstoppable threats!',
                'initial_fen' => '8/8/8/3k1P2/8/4K3/8/8 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'make_move',
                        'valid_moves' => ['f5f6', 'e4f5', 'f5f6', 'e4d5'],
                        'feedback_success' => '✅ Perfect coordination! King and pawn working together.',
                        'feedback_fail' => '❌ Think about how your king can support the pawn advance.',
                        'score_reward' => 20
                    ]
                ],
                'hints' => [
                    'The king should support the pawn from behind or the side.',
                    'King-pawn cooperation creates unstoppable passed pawns.',
                    'Think about which piece should move first for maximum effect.'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'f5', 'end' => 'f8', 'color' => 'gold'],
                        ['start' => 'e4', 'end' => 'f5', 'color' => 'green']
                    ]
                ],
                'auto_reset_on_success' => false,
                'auto_reset_delay_ms' => 2000,
                'feedback_messages' => [
                    'success' => '🤝 Beautiful teamwork! King and pawn are perfectly coordinated.',
                    'fail' => '🔄 Consider which piece should lead the attack.'
                ],
                'is_active' => true
            ]
        ];

        foreach ($stages as $stageData) {
            InteractiveLessonStage::firstOrCreate(
                [
                    'lesson_id' => $lesson->id,
                    'stage_order' => $stageData['stage_order']
                ],
                $stageData
            );
        }
    }

    /**
     * Create Safe Squares stages
     */
    private function createSafeSquaresStages(TutorialLesson $lesson): void
    {
        $stages = [
            [
                'stage_order' => 1,
                'title' => 'Knight Navigation',
                'instruction_text' => 'Navigate your knight to a safe square where it cannot be captured!',
                'initial_fen' => '8/8/1r6/8/8/8/8/3N4k w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'avoid_square',
                        'forbidden_squares' => ['a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6', 'a8', 'c8', 'e8', 'g8'],
                        'feedback_success' => '✅ Safe square! Your knight is protected from the rook.',
                        'feedback_fail' => '❌ Dangerous! That square is attacked by the enemy rook.',
                        'score_reward' => 12
                    ]
                ],
                'hints' => [
                    'Knights move in an L-shape: 2 squares in one direction, 1 in perpendicular.',
                    'Avoid squares on the same rank or file as the enemy rook.',
                    'The knight\'s unique movement can help it escape attacks.'
                ],
                'visual_aids' => [
                    'highlights' => ['a6', 'c6', 'e6', 'g6'],
                    'arrows' => [
                        ['start' => 'b7', 'end' => 'a7', 'color' => 'red'],
                        ['start' => 'b7', 'end' => 'c7', 'color' => 'red'],
                        ['start' => 'b7', 'end' => 'b6', 'color' => 'red'],
                        ['start' => 'b7', 'end' => 'b8', 'color' => 'red']
                    ]
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1500,
                'feedback_messages' => [
                    'success' => '🛡️ Excellent positioning! Your knight is safe.',
                    'fail' => '⚠️ That square is attacked. Think about the rook\'s movement.'
                ],
                'is_active' => true
            ],
            [
                'stage_order' => 2,
                'title' => 'Bishop Safety Net',
                'instruction_text' => 'Move your bishop to a safe diagonal away from enemy pieces!',
                'initial_fen' => '8/2r5/8/3B4/8/8/8/7k w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    [
                        'type' => 'avoid_square',
                        'forbidden_squares' => ['c5', 'c6', 'c7', 'c8', 'b4', 'a3', 'e2', 'f1', 'g2', 'h3'],
                        'feedback_success' => '✅ Safe diagonal! Your bishop controls important squares.',
                        'feedback_fail' => '❌ Dangerous! That bishop can be captured next move.',
                        'score_reward' => 15
                    ]
                ],
                'hints' => [
                    'Bishops move diagonally and control entire diagonals.',
                    'Look for squares that maintain bishop activity while staying safe.',
                    'Good bishops control key diagonals in the position.'
                ],
                'visual_aids' => [
                    'arrows' => [
                        ['start' => 'c7', 'end' => 'd5', 'color' => 'red'],
                        ['start' => 'c7', 'end' => 'e5', 'color' => 'red'],
                        ['start' => 'c7', 'end' => 'f4', 'color' => 'red']
                    ]
                ],
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1500,
                'feedback_messages' => [
                    'success' => '📐 Perfect diagonal control with safety!',
                    'fail' => '⚔️ That bishop is hanging - it will be captured!'
                ],
                'is_active' => true
            ]
        ];

        foreach ($stages as $stageData) {
            InteractiveLessonStage::firstOrCreate(
                [
                    'lesson_id' => $lesson->id,
                    'stage_order' => $stageData['stage_order']
                ],
                $stageData
            );
        }
    }

    /**
     * Create additional lessons for Knight movement and Check threats
     */
    private function createKnightMovementLesson(TutorialModule $module): void
    {
        $lesson = TutorialLesson::firstOrCreate(
            ['slug' => 'knight-mastery-dance'],
            [
                'module_id' => $module->id,
                'title' => 'Knight Mastery: The Dance',
                'lesson_type' => 'interactive',
                'difficulty_rating' => 3,
                'sort_order' => 4,
                'estimated_duration_minutes' => 20,
                'xp_reward' => 85,
                'is_active' => true,
                'content_data' => [
                    'description' => 'Master the unique movement patterns of the knight!',
                    'learning_objectives' => [
                        'Master knight movement patterns',
                        'Understand knight outposts',
                        'Practice knight attacks and forks'
                    ]
                ],
                'interactive_config' => [
                    'allow_all_moves' => true,
                    'show_coordinates' => true,
                    'blindfold_mode' => false,
                    'auto_reset_on_success' => true,
                    'reset_delay_ms' => 1500,
                    'show_feedback' => true,
                    'enable_hints' => true,
                    'max_hints_per_stage' => 2,
                ],
                'allow_invalid_fen' => false,
                'validation_rules' => [
                    'validate_fen' => true,
                    'allow_illegal_positions' => false,
                    'check_piece_moves' => true,
                    'enforce_turn_order' => false,
                    'require_kings' => false,
                ],
                'interactive_type' => 'knight_movement'
            ]
        );

        // Knight Movement stages would be similar to above
    }

    private function createCheckThreatsLesson(TutorialModule $module): void
    {
        $lesson = TutorialLesson::firstOrCreate(
            ['slug' => 'check-threats-mastery'],
            [
                'module_id' => $module->id,
                'title' => 'Check Threats: Attack and Defense',
                'lesson_type' => 'interactive',
                'difficulty_rating' => 5,
                'sort_order' => 5,
                'estimated_duration_minutes' => 25,
                'xp_reward' => 125,
                'is_active' => true,
                'content_data' => [
                    'description' => 'Master checking patterns and defensive techniques!',
                    'learning_objectives' => [
                        'Identify checking patterns',
                        'Practice defensive moves against checks',
                        'Understand checkmate threats'
                    ]
                ],
                'interactive_config' => [
                    'allow_all_moves' => false, // Standard chess rules apply
                    'show_coordinates' => true,
                    'blindfold_mode' => false,
                    'auto_reset_on_success' => true,
                    'reset_delay_ms' => 2000,
                    'show_feedback' => true,
                    'enable_hints' => true,
                    'max_hints_per_stage' => 2,
                ],
                'allow_invalid_fen' => false,
                'validation_rules' => [
                    'validate_fen' => true,
                    'allow_illegal_positions' => false,
                    'check_piece_moves' => true,
                    'enforce_turn_order' => true,
                    'require_kings' => true,
                ],
                'interactive_type' => 'check_threats'
            ]
        );

        // Check Threats stages would implement actual chess validation
    }
}