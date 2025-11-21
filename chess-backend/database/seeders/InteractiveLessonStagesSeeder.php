<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use Illuminate\Support\Facades\DB;

class InteractiveLessonStagesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clear existing stages (SQLite compatible)
        InteractiveLessonStage::query()->delete();

        $this->createKingMovementStages();
        $this->createPawnMovementStages();

        echo "Interactive lesson stages seeded successfully!\n";
    }

    private function createKingMovementStages(): void
    {
        // Lesson 2: How the King Moves
        $lesson = TutorialLesson::find(2);
        if (!$lesson) {
            echo "Lesson 2 not found, skipping king movement stages\n";
            return;
        }

        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'King Movement Basics',
                'instruction_text' => 'The King can move one square in any direction - horizontally, vertically, or diagonally. Try moving the white King!',
                'initial_fen' => '8/8/8/8/3K4/8/8/k7 w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_king', 'description' => 'Move the white King to any adjacent square']
                ],
                'success_criteria' => [
                    ['type' => 'king_moved', 'value' => 1]
                ],
                'hints' => [
                    'The King can move like a plus sign (+) or an X sign',
                    'Try moving the King to e4, d4, e5, or d5',
                    'The King is the most important piece - protect it!'
                ],
                'visual_aids' => [
                    'arrows' => [],
                    'highlights' => ['d4', 'e4', 'd5', 'e5']
                ],
                'feedback_messages' => [
                    'correct' => 'Great! You moved the King correctly.',
                    'incorrect' => 'The King can only move one square at a time.',
                    'hint' => 'Try clicking on one of the highlighted squares.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'King in Check',
                'instruction_text' => 'Your King is in check! You must move it to safety. Find a square where the King won\'t be attacked.',
                'initial_fen' => 'r7/8/8/8/8/8/8/4K2k w - - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'escape_check', 'description' => 'Move the King out of check']
                ],
                'success_criteria' => [
                    ['type' => 'king_safe', 'value' => 1]
                ],
                'hints' => [
                    'The rook on a7 is attacking your King',
                    'Look for squares that aren\'t controlled by the rook',
                    'The King can move to c1, c2, or e2'
                ],
                'visual_aids' => [
                    'arrows' => [],
                    'highlights' => ['c1', 'c2', 'e2']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent! You escaped the check.',
                    'incorrect' => 'That square is still under attack. Try again!',
                    'hint' => 'The rook attacks along the 7th rank and c-file.'
                ]
            ]
        ];

        foreach ($stages as $stageData) {
            InteractiveLessonStage::create($stageData);
        }

        echo "Created " . count($stages) . " stages for King Movement lesson\n";
    }

    private function createPawnMovementStages(): void
    {
        // Lesson 3: Pawn Movement Basics
        $lesson = TutorialLesson::find(3);
        if (!$lesson) {
            echo "Lesson 3 not found, skipping pawn movement stages\n";
            return;
        }

        $stages = [
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 1,
                'title' => 'Pawn Forward Movement',
                'instruction_text' => 'Pawns move straight forward, one square at a time. On their first move, they can move two squares!',
                'initial_fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'move_pawn', 'description' => 'Move the white pawn on e2']
                ],
                'success_criteria' => [
                    ['type' => 'pawn_moved', 'value' => 1]
                ],
                'hints' => [
                    'Click on the white pawn on e2',
                    'You can move it to e3 or e4 (2 squares on first move)',
                    'Pawns capture diagonally, not straight ahead'
                ],
                'visual_aids' => [
                    'arrows' => [],
                    'highlights' => ['e2', 'e3', 'e4']
                ],
                'feedback_messages' => [
                    'correct' => 'Perfect! That\'s how pawns move forward.',
                    'incorrect' => 'Pawns only move forward, not backward or sideways.',
                    'hint' => 'Try moving the e2 pawn forward.'
                ]
            ],
            [
                'lesson_id' => $lesson->id,
                'stage_order' => 2,
                'title' => 'Pawn Capture',
                'instruction_text' => 'Pawns capture diagonally! Capture the black pawn on d5 by moving your e-pawn diagonally.',
                'initial_fen' => 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
                'orientation' => 'white',
                'goals' => [
                    ['type' => 'capture_pawn', 'description' => 'Capture the black pawn on d5']
                ],
                'success_criteria' => [
                    ['type' => 'capture_made', 'value' => 1]
                ],
                'hints' => [
                    'Your pawn on e4 can capture diagonally to d5',
                    'Pawns can only capture diagonally, not straight forward',
                    'Look for the X-shaped capture pattern'
                ],
                'visual_aids' => [
                    'arrows' => [['from' => 'e4', 'to' => 'd5']],
                    'highlights' => ['e4', 'd5']
                ],
                'feedback_messages' => [
                    'correct' => 'Excellent capture! Pawns capture diagonally.',
                    'incorrect' => 'That\'s not a valid pawn move. Think diagonally!',
                    'hint' => 'The e4 pawn can capture the d5 pawn diagonally.'
                ]
            ]
        ];

        foreach ($stages as $stageData) {
            InteractiveLessonStage::create($stageData);
        }

        echo "Created " . count($stages) . " stages for Pawn Movement lesson\n";
    }
}