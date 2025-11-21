<?php

namespace Database\Factories;

use App\Models\TutorialLesson;
use App\Models\TutorialModule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TutorialLesson>
 */
class TutorialLessonFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'module_id' => TutorialModule::factory(),
            'title' => $this->faker->sentence(4),
            'slug' => $this->faker->unique()->slug(4),
            'lesson_type' => $this->faker->randomElement(['theory', 'interactive', 'puzzle', 'practice_game']),
            'content_data' => $this->generateContentData(),
            'difficulty_rating' => $this->faker->numberBetween(1, 10),
            'sort_order' => $this->faker->numberBetween(1, 10),
            'estimated_duration_minutes' => $this->faker->numberBetween(10, 60),
            'xp_reward' => $this->faker->numberBetween(10, 50),
            'unlock_requirement_lesson_id' => null,
            'is_active' => true,
        ];
    }

    /**
     * Generate random content data based on lesson type.
     */
    private function generateContentData(): array
    {
        $type = $this->faker->randomElement(['theory', 'puzzle', 'practice_game']);

        return match($type) {
            'theory' => [
                'type' => 'theory',
                'slides' => [
                    [
                        'title' => $this->faker->sentence(3),
                        'content' => '<p>' . $this->faker->paragraph(3) . '</p>',
                    ],
                    [
                        'title' => $this->faker->sentence(3),
                        'content' => '<p>' . $this->faker->paragraph(2) . '</p>',
                    ],
                ],
            ],
            'puzzle' => [
                'type' => 'puzzle',
                'puzzles' => [
                    [
                        'fen' => $this->faker->randomElement([
                            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                            '8/8/8/3N4/8/8/8/8 w - - 0 1',
                            '8/8/8/8/4N3/8/8/8 w - - 0 1',
                        ]),
                        'objective' => $this->faker->sentence(4),
                        'solution' => [$this->faker->randomElement(['e4', 'Nf3', 'Nc6', 'e5'])],
                        'hints' => [
                            $this->faker->sentence(5),
                            $this->faker->sentence(5),
                        ],
                    ],
                ],
            ],
            'practice_game' => [
                'type' => 'practice_game',
                'practice_config' => [
                    'starting_position' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    'objective' => $this->faker->sentence(6),
                    'ai_difficulty' => $this->faker->randomElement(['easy', 'medium', 'hard']),
                    'max_moves' => $this->faker->numberBetween(20, 50),
                ],
            ],
            default => [],
        };
    }

    /**
     * Create a theory lesson.
     */
    public function theory(): static
    {
        return $this->state(fn (array $attributes) => [
            'lesson_type' => 'theory',
            'content_data' => [
                'type' => 'theory',
                'slides' => [
                    [
                        'title' => $this->faker->sentence(3),
                        'content' => '<p>' . $this->faker->paragraph(3) . '</p>',
                    ],
                ],
            ],
        ]);
    }

    /**
     * Create a puzzle lesson.
     */
    public function puzzle(): static
    {
        return $this->state(fn (array $attributes) => [
            'lesson_type' => 'puzzle',
            'content_data' => [
                'type' => 'puzzle',
                'puzzles' => [
                    [
                        'fen' => '8/8/8/3N4/8/8/8/8 w - - 0 1',
                        'objective' => $this->faker->sentence(4),
                        'solution' => ['Ne6+'],
                        'hints' => [
                            $this->faker->sentence(5),
                        ],
                    ],
                ],
            ],
        ]);
    }

    /**
     * Create a practice game lesson.
     */
    public function practiceGame(): static
    {
        return $this->state(fn (array $attributes) => [
            'lesson_type' => 'practice_game',
            'content_data' => [
                'type' => 'practice_game',
                'practice_config' => [
                    'starting_position' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    'objective' => $this->faker->sentence(6),
                    'ai_difficulty' => 'easy',
                    'max_moves' => 30,
                ],
            ],
        ]);
    }

    /**
     * Create an easy lesson.
     */
    public function easy(): static
    {
        return $this->state(fn (array $attributes) => [
            'difficulty_rating' => $this->faker->numberBetween(1, 3),
        ]);
    }

    /**
     * Create a medium lesson.
     */
    public function medium(): static
    {
        return $this->state(fn (array $attributes) => [
            'difficulty_rating' => $this->faker->numberBetween(4, 7),
        ]);
    }

    /**
     * Create a hard lesson.
     */
    public function hard(): static
    {
        return $this->state(fn (array $attributes) => [
            'difficulty_rating' => $this->faker->numberBetween(8, 10),
        ]);
    }
}