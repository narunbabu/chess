<?php

namespace App\Models;

use App\Enums\SubscriptionTier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingDrillSet extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'description',
        'skill_band',
        'required_tier',
        'theme',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function drills(): HasMany
    {
        return $this->hasMany(TrainingDrill::class, 'drill_set_id');
    }

    public function isAccessibleForUser(User $user): bool
    {
        return $user->hasSubscriptionTier(SubscriptionTier::from($this->required_tier));
    }
}
