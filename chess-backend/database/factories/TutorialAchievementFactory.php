<?php

namespace Database\Factories;

use App\Models\TutorialAchievement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\TutorialAchievement>
 */
class TutorialAchievementFactory extends Factory
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
            'description' => $this->faker->sentence(6),
            'icon' => $this->faker->randomElement(['🏆', '🎖️', '🥇', '🥈', '🥉', '💎', '⭐']),
            'tier' => $this->faker->randomElement(['bronze', 'silver', 'gold', 'platinum']),
            'requirement_type' => $this->faker->randomElement(['lessons_completed', 'streak', 'score', 'speed', 'special']),
            'requirement_value' => $this->faker->numberBetween(1, 50),
            'xp_reward' => $this->faker->numberBetween(25, 300),
            'is_active' => true,
        ];
    }

    /**
     * Create a bronze tier achievement.
     */
    public function bronze(): static
    {
        return $this->state(fn (array $attributes) => [
            'tier' => 'bronze',
            'xp_reward' => $this->faker->numberBetween(25, 50),
        ]);
    }

    /**
     * Create a silver tier achievement.
     */
    public function silver(): static
    {
        return $this->state(fn (array $attributes) => [
            'tier' => 'silver',
            'xp_reward' => $this->faker->numberBetween(50, 100),
        ]);
    }

    /**
     * Create a gold tier achievement.
     */
    public function gold(): static
    {
        return $this->state(fn (array $attributes) => [
            'tier' => 'gold',
            'xp_reward' => $this->faker->numberBetween(100, 200),
        ]);
    }

    /**
     * Create a platinum tier achievement.
     */
    public function platinum(): static
    {
        return $this->state(fn (array $attributes) => [
            'tier' => 'platinum',
            'xp_reward' => $this->faker->numberBetween(200, 300),
        ]);
    }

    /**
     * Create a lessons completed achievement.
     */
    public function lessonsCompleted(int $count = 5): static
    {
        return $this->state(fn (array $attributes) => [
            'requirement_type' => 'lessons_completed',
            'requirement_value' => $count,
            'name' => "Complete {$count} Lessons",
            'description' => "Complete {$count} tutorial lessons to earn this achievement.",
        ]);
    }

    /**
     * Create a streak achievement.
     */
    public function streak(int $days = 7): static
    {
        return $this->state(fn (array $attributes) => [
            'requirement_type' => 'streak',
            'requirement_value' => $days,
            'name' => "{$days} Day Streak",
            'description' => "Maintain a {$days}-day learning streak to earn this achievement.",
        ]);
    }

    /**
     * Create a score achievement.
     */
    public function score(int $percentage = 95): static
    {
        return $this->state(fn (array $attributes) => [
            'requirement_type' => 'score',
            'requirement_value' => $percentage,
            'name' => "Perfect Score",
            'description' => "Achieve a score of {$percentage}% or higher on any lesson.",
        ]);
    }
}