<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use App\Models\UserStageProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class InteractiveLessonApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private TutorialModule $module;
    private TutorialLesson $lesson;
    private InteractiveLessonStage $stage;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->module = TutorialModule::factory()->create(['is_active' => true]);
        $this->lesson = TutorialLesson::factory()->create([
            'module_id' => $this->module->id,
            'lesson_type' => 'interactive',
            'interactive_type' => 'pawn_wars',
            'is_active' => true
        ]);
        $this->stage = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 1,
            'is_active' => true
        ]);
    }

    /** @test */
    public function it_can_get_interactive_lesson_with_stages()
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$this->lesson->id}/interactive");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id',
                    'title',
                    'slug',
                    'lesson_type',
                    'interactive_type',
                    'difficulty_rating',
                    'xp_reward',
                    'allow_invalid_fen',
                    'interactive_config',
                    'validation_rules',
                    'module' => [
                        'id',
                        'name',
                        'skill_tier'
                    ],
                    'interactive_stages' => [
                        '*' => [
                            'id',
                            'stage_order',
                            'title',
                            'instruction_text',
                            'initial_fen',
                            'orientation',
                            'goals',
                            'hints',
                            'visual_aids',
                            'auto_reset_on_success',
                            'auto_reset_delay_ms',
                            'feedback_messages',
                            'user_progress',
                            'is_completed'
                        ]
                    ]
                ]
            ]);

        $response->assertJson([
            'success' => true,
            'data' => [
                'id' => $this->lesson->id,
                'lesson_type' => 'interactive',
                'interactive_type' => 'pawn_wars'
            ]
        ]);
    }

    /** @test */
    public function it_returns_404_for_nonexistent_lesson()
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/99999/interactive");

        $response->assertStatus(404);
    }

    /** @test */
    public function it_returns_404_for_non_interactive_lesson()
    {
        $theoryLesson = TutorialLesson::factory()->create([
            'lesson_type' => 'theory',
            'is_active' => true
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$theoryLesson->id}/interactive");

        $response->assertStatus(404);
    }

    /** @test */
    public function it_requires_authentication_for_interactive_lesson_access()
    {
        $response = $this->getJson("/api/tutorial/lessons/{$this->lesson->id}/interactive");

        $response->assertStatus(401);
    }

    /** @test */
    public function it_can_validate_interactive_move()
    {
        // Create a stage with reach_square goal
        $testStage = InteractiveLessonStage::factory()->reachSquareGoal()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 2,
            'initial_fen' => '8/8/8/8/8/8/PPPPPPPP/8 w - - 0 1'
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                'stage_id' => $testStage->id,
                'move' => 'e2e4',
                'fen_after' => '8/8/8/8/8/4P3/PPPP1PPP/8 b - - 0 1'
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'success',
                    'feedback',
                    'feedback_type',
                    'score_change',
                    'goal_achieved'
                ]
            ]);
    }

    /** @test */
    public function it_validates_move_validation_request_structure()
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                'stage_id' => $this->stage->id,
                // Missing 'move' and 'fen_after' fields
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['move', 'fen_after']);
    }

    /** @test */
    public function it_returns_error_for_invalid_stage_id()
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                'stage_id' => 99999,
                'move' => 'e2e4',
                'fen_after' => '8/8/8/8/8/4P3/PPPP1PPP/8 b - - 0 1'
            ]);

        $response->assertStatus(404);
    }

    /** @test */
    public function it_can_get_interactive_hint()
    {
        // Create stage with hints
        $hintStage = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 3,
            'hints' => [
                'First hint: Look for center squares',
                'Second hint: Try pushing the e-pawn',
                'Third hint: e4 is the best move for center control'
            ]
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/hint", [
                'stage_id' => $hintStage->id,
                'hint_number' => 1
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'hint',
                    'hint_number',
                    'total_hints',
                    'points_deducted'
                ]
            ]);

        $response->assertJson([
            'success' => true,
            'data' => [
                'hint' => 'First hint: Look for center squares',
                'hint_number' => 1,
                'total_hints' => 3
            ]
        ]);
    }

    /** @test */
    public function it_validates_hint_request_parameters()
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/hint", [
                'stage_id' => $this->stage->id
                // Missing 'hint_number'
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['hint_number']);
    }

    /** @test */
    public function it_returns_error_for_hint_number_out_of_range()
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/hint", [
                'stage_id' => $this->stage->id,
                'hint_number' => 99
            ]);

        $response->assertStatus(400)
            ->assertJson([
                'success' => false,
                'message' => 'Hint number out of range'
            ]);
    }

    /** @test */
    public function it_can_reset_interactive_stage()
    {
        // Create some user progress first
        UserStageProgress::create([
            'user_id' => $this->user->id,
            'lesson_id' => $this->lesson->id,
            'stage_id' => $this->stage->id,
            'status' => 'in_progress',
            'attempts' => 3,
            'best_score' => 50
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/reset-stage", [
                'stage_id' => $this->stage->id
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Stage reset successfully'
            ]);

        // Verify progress was reset
        $progress = UserStageProgress::where('user_id', $this->user->id)
            ->where('stage_id', $this->stage->id)
            ->first();

        $this->assertEquals('not_started', $progress->status);
        $this->assertEquals(0, $progress->attempts);
        $this->assertEquals(0, $progress->best_score);
    }

    /** @test */
    public function it_can_get_interactive_progress()
    {
        // Create some progress data
        UserStageProgress::factory()->create([
            'user_id' => $this->user->id,
            'lesson_id' => $this->lesson->id,
            'stage_id' => $this->stage->id,
            'status' => 'completed',
            'attempts' => 2,
            'best_score' => 80,
            'total_time_seconds' => 120
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$this->lesson->id}/progress");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'lesson_id',
                    'total_stages',
                    'completed_stages',
                    'progress_percentage',
                    'total_attempts',
                    'best_scores',
                    'average_score',
                    'total_time_seconds',
                    'stages' => [
                        '*' => [
                            'stage_id',
                            'stage_order',
                            'status',
                            'attempts',
                            'best_score',
                            'total_time_seconds',
                            'completed_at'
                        ]
                    ]
                ]
            ]);
    }

    /** @test */
    public function it_filters_only_active_stages()
    {
        // Create inactive stage
        InteractiveLessonStage::factory()->inactive()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 2
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$this->lesson->id}/interactive");

        $response->assertStatus(200);

        // Should only return active stages
        $stages = $response->json('data.stages');
        $this->assertCount(1, $stages);
        $this->assertEquals(1, $stages[0]['stage_order']);
    }

    /** @test */
    public function it_orders_stages_correctly()
    {
        // Create additional stages in random order
        $stage3 = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 3
        ]);
        $stage2 = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 2
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$this->lesson->id}/interactive");

        $response->assertStatus(200);

        $stages = $response->json('data.stages');
        $this->assertCount(3, $stages);

        // Verify stages are ordered by stage_order
        $this->assertEquals(1, $stages[0]['stage_order']);
        $this->assertEquals(2, $stages[1]['stage_order']);
        $this->assertEquals(3, $stages[2]['stage_order']);
    }

    /** @test */
    public function it_handles_different_goal_types_in_move_validation()
    {
        // Test avoid_square goal type
        $avoidSquareStage = InteractiveLessonStage::factory()->avoidSquareGoal()->create([
            'lesson_id' => $this->lesson->id,
            'stage_order' => 4,
            'initial_fen' => '8/8/1r6/8/8/8/8/3N4k w - - 0 1'
        ]);

        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                'stage_id' => $avoidSquareStage->id,
                'move' => 'b1c3', // Safe move
                'fen_after' => '8/8/1r6/8/8/8/2N5/4k3 b - - 1 1'
            ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertArrayHasKey('goal_achieved', $data);
    }

    /** @test */
    public function it_validates_fen_format_in_move_validation()
    {
        $response = $this->actingAs($this->user)
            ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                'stage_id' => $this->stage->id,
                'move' => 'e2e4',
                'fen_after' => 'invalid-fen-string'
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['fen_after']);
    }

    /** @test */
    public function it_properly_formats_json_responses()
    {
        $response = $this->actingAs($this->user)
            ->getJson("/api/tutorial/lessons/{$this->lesson->id}/interactive");

        // Verify JSON structure and formatting
        $response->assertHeader('Content-Type', 'application/json');
        $this->assertTrue($response->json('success'));
        $this->assertIsArray($response->json('data'));
        $this->assertIsArray($response->json('data.stages'));
    }
}