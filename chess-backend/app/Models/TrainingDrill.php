<?php

namespace App\Models;

use App\Enums\SubscriptionTier;
use App\Services\EntitlementService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingDrill extends Model
{
    protected $fillable = [
        'drill_set_id',
        'slug',
        'title',
        'description',
        'skill_band',
        'required_tier',
        'drill_type',
        'theme',
        'subtheme',
        'position_fen',
        'solution',
        'accepted_alternatives',
        'explanation',
        'hints',
        'thinking_steps',
        'time_target_seconds',
        'mastery_threshold',
        'source',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'solution' => 'array',
        'accepted_alternatives' => 'array',
        'hints' => 'array',
        'thinking_steps' => 'array',
        'time_target_seconds' => 'integer',
        'mastery_threshold' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function drillSet(): BelongsTo
    {
        return $this->belongsTo(TrainingDrillSet::class, 'drill_set_id');
    }

    public function progress(): HasMany
    {
        return $this->hasMany(UserTrainingDrillProgress::class, 'training_drill_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(UserTrainingDrillAttempt::class, 'training_drill_id');
    }

    public function isAccessibleForUser(User $user): bool
    {
        $capability = match ($this->required_tier) {
            SubscriptionTier::SILVER->value => EntitlementService::CAP_TRAINING_DRILLS_SILVER,
            SubscriptionTier::GOLD->value => EntitlementService::CAP_TRAINING_DRILLS_GOLD,
            default => EntitlementService::CAP_TRAINING_DRILLS_FREE,
        };

        return app(EntitlementService::class)->can($user, $capability);
    }

    public function acceptedSolutions(): array
    {
        $solutions = [$this->solution ?? []];

        foreach ($this->accepted_alternatives ?? [] as $alternative) {
            $solutions[] = is_array($alternative) ? $alternative : [$alternative];
        }

        return $solutions;
    }
}
