<?php

namespace Database\Factories;

use App\Models\TutorialModule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TutorialModule>
 */
class TutorialModuleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->words(3, true),
            'slug' => $this->faker->unique()->slug(3),
            'skill_tier' => $this->faker->randomElement(['beginner', 'intermediate', 'advanced']),
            'description' => $this->faker->paragraph(2),
            'icon' => $this->faker->randomElement(['♟️', '⚔️', '🎯', '🏆', '📖']),
            'sort_order' => $this->faker->numberBetween(1, 10),
            'unlock_requirement_id' => null,
            'estimated_duration_minutes' => $this->faker->numberBetween(30, 120),
            'is_active' => true,
        ];
    }

    /**
     * Indicate that the module is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Create a beginner tier module.
     */
    public function beginner(): static
    {
        return $this->state(fn (array $attributes) => [
            'skill_tier' => 'beginner',
        ]);
    }

    /**
     * Create an intermediate tier module.
     */
    public function intermediate(): static
    {
        return $this->state(fn (array $attributes) => [
            'skill_tier' => 'intermediate',
        ]);
    }

    /**
     * Create an advanced tier module.
     */
    public function advanced(): static
    {
        return $this->state(fn (array $attributes) => [
            'skill_tier' => 'advanced',
        ]);
    }
}