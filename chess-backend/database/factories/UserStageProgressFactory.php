<?php

namespace Database\Factories;

use App\Models\UserStageProgress;
use App\Models\User;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserStageProgress>
 */
class UserStageProgressFactory extends Factory
{
    protected $model = UserStageProgress::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'lesson_id' => TutorialLesson::factory(),
            'stage_id' => InteractiveLessonStage::factory(),
            'status' => 'not_started',
            'attempts' => 0,
            'best_score' => 0,
            'total_time_seconds' => 0,
        ];
    }
}
