<?php

namespace Database\Factories;

use App\Models\InteractiveLessonStage;
use App\Models\TutorialLesson;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\InteractiveLessonStage>
 */
class InteractiveLessonStageFactory extends Factory
{
    protected $model = InteractiveLessonStage::class;

    public function definition(): array
    {
        return [
            'lesson_id' => TutorialLesson::factory()->create(['lesson_type' => 'interactive']),
            'stage_order' => $this->faker->numberBetween(1, 10),
            'title' => $this->faker->sentence(4),
            'instruction_text' => $this->faker->sentence(10),
            'initial_fen' => $this->faker->randomElement([
                '8/8/8/8/8/8/PPPPPPPP/8 w - - 0 1',
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
            ]),
            'orientation' => $this->faker->randomElement(['white', 'black']),
            'goals' => [
                [
                    'type' => $this->faker->randomElement(['reach_square', 'make_move', 'avoid_square']),
                    'target_squares' => [$this->faker->randomElement(['e4', 'd4', 'f4', 'c4'])],
                    'feedback_success' => 'Excellent move!',
                    'feedback_fail' => 'Try again!',
                    'score_reward' => $this->faker->numberBetween(10, 25)
                ]
            ],
            'hints' => [
                $this->faker->sentence(6),
                $this->faker->sentence(8)
            ],
            'visual_aids' => [
                'arrows' => [
                    [
                        'start' => $this->faker->randomElement(['e2', 'd2', 'f2']),
                        'end' => $this->faker->randomElement(['e4', 'd4', 'f4']),
                        'color' => $this->faker->randomElement(['green', 'blue', 'red'])
                    ]
                ],
                'highlights' => [
                    $this->faker->randomElement(['e4', 'd4', 'f4']),
                    $this->faker->randomElement(['e5', 'd5', 'f5'])
                ]
            ],
            'auto_reset_on_success' => $this->faker->boolean(80), // 80% chance of true
            'auto_reset_delay_ms' => $this->faker->randomElement([1000, 1500, 2000]),
            'feedback_messages' => [
                'success' => $this->faker->sentence(5),
                'partial' => $this->faker->sentence(4),
                'fail' => $this->faker->sentence(4)
            ],
            'is_active' => true
        ];
    }

    /**
     * Create a stage with reach_square goal type
     */
    public function reachSquareGoal(): static
    {
        return $this->state(fn (array $attributes) => [
            'goals' => [
                [
                    'type' => 'reach_square',
                    'piece' => 'wP',
                    'from' => 'e2',
                    'to_squares' => ['e4', 'd4'],
                    'feedback_success' => 'Perfect pawn push!',
                    'feedback_partial' => 'Good move, but center is better',
                    'feedback_fail' => 'Try pushing to the center',
                    'score_reward' => 15
                ]
            ]
        ]);
    }

    /**
     * Create a stage with make_move goal type
     */
    public function makeMoveGoal(): static
    {
        return $this->state(fn (array $attributes) => [
            'goals' => [
                [
                    'type' => 'make_move',
                    'valid_moves' => ['e2e4', 'd2d4', 'g1f3'],
                    'feedback_success' => 'Excellent opening move!',
                    'feedback_fail' => 'Consider a different move',
                    'score_reward' => 20
                ]
            ]
        ]);
    }

    /**
     * Create a stage with avoid_square goal type
     */
    public function avoidSquareGoal(): static
    {
        return $this->state(fn (array $attributes) => [
            'goals' => [
                [
                    'type' => 'avoid_square',
                    'forbidden_squares' => ['a5', 'b5', 'c5'],
                    'feedback_success' => 'Safe square chosen!',
                    'feedback_fail' => 'That square is dangerous',
                    'score_reward' => 10
                ]
            ]
        ]);
    }

    /**
     * Create a stage with no auto-reset
     */
    public function noAutoReset(): static
    {
        return $this->state(fn (array $attributes) => [
            'auto_reset_on_success' => false,
            'auto_reset_delay_ms' => 0
        ]);
    }

    /**
     * Create an inactive stage
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false
        ]);
    }

    /**
     * Create a stage with complex visual aids
     */
    public function complexVisualAids(): static
    {
        return $this->state(fn (array $attributes) => [
            'visual_aids' => [
                'arrows' => [
                    ['start' => 'e2', 'end' => 'e4', 'color' => 'green', 'style' => 'dashed'],
                    ['start' => 'g1', 'end' => 'f3', 'color' => 'blue']
                ],
                'highlights' => [
                    'e4' => 'rgba(0, 255, 0, 0.5)',
                    'f3' => 'rgba(0, 0, 255, 0.5)'
                ],
                'ghost_pieces' => [
                    ['square' => 'e4', 'piece' => 'wP', 'opacity' => 0.7]
                ],
                'coordinate_labels' => ['e4', 'f3']
            ]
        ]);
    }
}