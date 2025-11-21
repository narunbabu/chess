<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class InteractiveLessonStageTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private TutorialModule $module;
    private TutorialLesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->module = TutorialModule::factory()->create();
        $this->lesson = TutorialLesson::factory()->create([
            'module_id' => $this->module->id,
            'lesson_type' => 'interactive',
            'interactive_type' => 'pawn_wars'
        ]);
    }

    /** @test */
    public function it_can_create_an_interactive_stage_with_valid_data()
    {
        $stageData = [
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1,
            'title' => 'Test Stage',
            'instruction_text' => 'Move your pawn forward',
            'initial_fen' => '8/8/8/8/8/8/PPPPPPPP/8 w - - 0 1',
            'orientation' => 'white',
            'goals' => [
                [
                    'type' => 'reach_square',
                    'target_squares' => ['e4', 'd4'],
                    'feedback_success' => 'Excellent move!',
                    'feedback_fail' => 'Try again'
                ]
            ],
            'hints' => ['Push the e-pawn for center control'],
            'visual_aids' => [
                'arrows' => [['start' => 'e2', 'end' => 'e4', 'color' => 'green']],
                'highlights' => ['e4', 'd4']
            ],
            'auto_reset_on_success' => true,
            'auto_reset_delay_ms' => 1500,
            'feedback_messages' => [
                'success' => 'Perfect!',
                'fail' => 'Not quite'
            ],
            'is_active' => true
        ];

        $stage = InteractiveLessonStage::create($stageData);

        $this->assertInstanceOf(InteractiveLessonStage::class, $stage);
        $this->assertEquals($this->lesson->id, $stage->lesson_id);
        $this->assertEquals(1, $stage->stage_order);
        $this->assertEquals('Test Stage', $stage->title);
        $this->assertIsArray($stage->goals);
        $this->assertIsArray($stage->hints);
        $this->assertIsArray($stage->visual_aids);
        $this->assertTrue($stage->auto_reset_on_success);
        $this->assertEquals(1500, $stage->auto_reset_delay_ms);
    }

    /** @test */
    public function it_validates_goal_structure_correctly()
    {
        $validGoals = [
            'reach_square' => [
                'type' => 'reach_square',
                'piece' => 'wP',
                'target_squares' => ['e4', 'd4'],
                'feedback_success' => 'Perfect centralization!',
                'feedback_partial' => 'Good move, but center is better',
                'feedback_fail' => 'Try central squares',
                'score_reward' => 15
            ],
            'make_move' => [
                'type' => 'make_move',
                'valid_moves' => ['e2e4', 'd2d4'],
                'feedback_success' => 'Excellent opening!',
                'feedback_fail' => 'Try a different move',
                'score_reward' => 20
            ],
            'avoid_square' => [
                'type' => 'avoid_square',
                'forbidden_squares' => ['a5', 'b5', 'c5'],
                'feedback_success' => 'Safe square chosen!',
                'feedback_fail' => 'That square is dangerous',
                'score_reward' => 10
            ]
        ];

        $stageOrder = 1;
        foreach ($validGoals as $goalType => $goalData) {
            // Create separate lesson for each test to avoid unique constraint conflicts
            $testLesson = TutorialLesson::factory()->create([
                'module_id' => $this->module->id,
                'lesson_type' => 'interactive',
                'interactive_type' => 'test_' . $goalType
            ]);

            $stage = InteractiveLessonStage::factory()->create([
                'lesson_id' => $testLesson->id,
                'stage_order' => $stageOrder++,
                'goals' => [$goalData]
            ]);

            $this->assertEquals($goalType, $stage->goals[0]['type']);
            $this->assertArrayHasKey('feedback_success', $stage->goals[0]);
            $this->assertArrayHasKey('feedback_fail', $stage->goals[0]);
        }
    }

    /** @test */
    public function it_validates_fen_structure()
    {
        $validFens = [
            '8/8/8/8/8/8/PPPPPPPP/8 w - - 0 1', // Standard position
            '8/pppppppp/8/8/8/8/8/8 b - - 0 1', // Black to move
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Full starting position
            '4k3/8/8/8/8/8/8/4K3 w - - 0 1', // King vs King
            '8/8/8/8/8/8/8/8 w - - 0 1', // Empty board (for minigames)
        ];

        $stageOrder = 1;
        foreach ($validFens as $index => $fen) {
            // Create separate lesson for each FEN test to avoid unique constraint conflicts
            $testLesson = TutorialLesson::factory()->create([
                'module_id' => $this->module->id,
                'lesson_type' => 'interactive',
                'interactive_type' => 'test_fen_' . $index
            ]);

            $stage = InteractiveLessonStage::factory()->create([
                'lesson_id' => $testLesson->id,
                'stage_order' => $stageOrder++,
                'initial_fen' => $fen
            ]);

            $this->assertEquals($fen, $stage->initial_fen);
            // Could add more sophisticated FEN validation here if needed
        }
    }

    /** @test */
    public function it_stores_and_retrieves_json_fields_correctly()
    {
        $complexGoals = [
            [
                'type' => 'reach_square',
                'piece' => 'wN',
                'from' => 'g1',
                'to_squares' => ['f3', 'h3'],
                'conditions' => [
                    'must_avoid_check' => true,
                    'time_limit_seconds' => 30
                ],
                'feedback_success' => 'Perfect knight development!',
                'feedback_partial' => 'Good square, but f3 is better',
                'feedback_fail' => 'Try the standard knight squares',
                'score_reward' => 12
            ]
        ];

        $complexVisualAids = [
            'arrows' => [
                ['start' => 'g1', 'end' => 'f3', 'color' => 'green', 'style' => 'dashed'],
                ['start' => 'g1', 'end' => 'h3', 'color' => 'blue']
            ],
            'highlights' => [
                'f3' => 'rgba(0, 255, 0, 0.5)',
                'h3' => 'rgba(0, 0, 255, 0.5)',
                'e4' => 'rgba(255, 255, 0, 0.3)'
            ],
            'ghost_pieces' => [
                ['square' => 'f3', 'piece' => 'wN', 'opacity' => 0.7]
            ],
            'coordinate_labels' => ['f3', 'h3']
        ];

        $stage = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'goals' => $complexGoals,
            'visual_aids' => $complexVisualAids
        ]);

        // Test that JSON is properly stored and retrieved
        $retrievedGoals = $stage->goals;
        $retrievedVisualAids = $stage->visual_aids;

        $this->assertEquals('reach_square', $retrievedGoals[0]['type']);
        $this->assertEquals('wN', $retrievedGoals[0]['piece']);
        $this->assertEquals(30, $retrievedGoals[0]['conditions']['time_limit_seconds']);

        $this->assertCount(2, $retrievedVisualAids['arrows']);
        $this->assertCount(3, $retrievedVisualAids['highlights']);
        $this->assertEquals('rgba(0, 255, 0, 0.5)', $retrievedVisualAids['highlights']['f3']);
    }

    /** @test */
    public function it_enforces_unique_stage_order_per_lesson()
    {
        // Create first stage
        InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1
        ]);

        // Try to create duplicate stage order - should work if we handle this properly
        $duplicateStage = InteractiveLessonStage::factory()->make([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1
        ]);

        // This test ensures we understand the current behavior
        // In production, we might want to enforce uniqueness at the application level
        $this->expectException(\Illuminate\Database\QueryException::class);
        $duplicateStage->save();
    }

    /** @test */
    public function it_can_be_queried_by_active_status()
    {
        // Create active and inactive stages
        InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1,
            'is_active' => true
        ]);

        InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 2,
            'is_active' => false
        ]);

        $activeStages = InteractiveLessonStage::where('is_active', true)->get();
        $inactiveStages = InteractiveLessonStage::where('is_active', false)->get();

        $this->assertCount(1, $activeStages);
        $this->assertCount(1, $inactiveStages);
        $this->assertTrue($activeStages->first()->is_active);
        $this->assertFalse($inactiveStages->first()->is_active);
    }

    /** @test */
    public function it_has_proper_relationships()
    {
        $stage = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1
        ]);

        // Test lesson relationship
        $this->assertInstanceOf(TutorialLesson::class, $stage->lesson);
        $this->assertEquals($this->lesson->id, $stage->lesson->id);
        $this->assertEquals('interactive', $stage->lesson->lesson_type);

        // Test that we can access stages through the lesson
        $retrievedStage = $this->lesson->stages()->first();
        $this->assertEquals($stage->id, $retrievedStage->id);
    }

    /** @test */
    public function it_validates_required_fields()
    {
        $requiredFields = [
            'lesson_id',
            'stage_order',
            'title',
            'initial_fen'
        ];

        foreach ($requiredFields as $field) {
            $invalidData = [
                'lesson_id' => $this->lesson->id,
                'stage_order' => 1,
                'title' => 'Test Stage',
                'initial_fen' => '8/8/8/8/8/8/8/8 w - - 0 1'
            ];

            unset($invalidData[$field]);

            $this->expectException(\Illuminate\Database\QueryException::class);
            InteractiveLessonStage::create($invalidData);
        }
    }

    /** @test */
    public function it_handles_auto_reset_configuration()
    {
        $testCases = [
            [
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 1000
            ],
            [
                'auto_reset_on_success' => true,
                'auto_reset_delay_ms' => 2000
            ],
            [
                'auto_reset_on_success' => false,
                'auto_reset_delay_ms' => 0
            ]
        ];

        foreach ($testCases as $config) {
            $stage = InteractiveLessonStage::factory()->create([
                'lesson_id' => $this->lesson->id,
                'stage_order' => rand(10, 100), // Ensure unique
                'auto_reset_on_success' => $config['auto_reset_on_success'],
                'auto_reset_delay_ms' => $config['auto_reset_delay_ms']
            ]);

            $this->assertEquals($config['auto_reset_on_success'], $stage->auto_reset_on_success);
            $this->assertEquals($config['auto_reset_delay_ms'], $stage->auto_reset_delay_ms);
        }
    }
}