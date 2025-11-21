<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSkillAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'skill_tier',
        'assessment_type',
        'score',
        'rating_before',
        'rating_after',
        'completed_at',
        'assessment_data',
    ];

    protected $casts = [
        'score' => 'decimal:2',
        'rating_before' => 'integer',
        'rating_after' => 'integer',
        'completed_at' => 'datetime',
        'assessment_data' => 'array',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get assessment type display name
     */
    public function getAssessmentTypeDisplayAttribute(): string
    {
        return match($this->assessment_type) {
            'initial' => 'Initial Assessment',
            'module_completion' => 'Module Completion',
            'challenge' => 'Challenge Assessment',
            default => 'Assessment',
        };
    }

    /**
     * Get skill tier display name
     */
    public function getSkillTierDisplayAttribute(): string
    {
        return match($this->skill_tier) {
            'beginner' => 'Beginner',
            'intermediate' => 'Intermediate',
            'advanced' => 'Advanced',
            default => 'Unknown',
        };
    }

    /**
     * Get score grade
     */
    public function getGradeAttribute(): string
    {
        return match(true) {
            $this->score >= 95 => 'A+',
            $this->score >= 90 => 'A',
            $this->score >= 85 => 'A-',
            $this->score >= 80 => 'B+',
            $this->score >= 75 => 'B',
            $this->score >= 70 => 'B-',
            $this->score >= 65 => 'C+',
            $this->score >= 60 => 'C',
            $this->score >= 55 => 'C-',
            $this->score >= 50 => 'D',
            default => 'F',
        };
    }

    /**
     * Get grade color class
     */
    public function getGradeColorClassAttribute(): string
    {
        return match(true) {
            $this->score >= 90 => 'text-green-600 bg-green-100',
            $this->score >= 80 => 'text-blue-600 bg-blue-100',
            $this->score >= 70 => 'text-yellow-600 bg-yellow-100',
            $this->score >= 60 => 'text-orange-600 bg-orange-100',
            default => 'text-red-600 bg-red-100',
        };
    }

    /**
     * Check if assessment was passed
     */
    public function isPassed(): bool
    {
        return $this->score >= 70; // Standard passing score
    }

    /**
     * Check if assessment was excellent
     */
    public function isExcellent(): bool
    {
        return $this->score >= 90;
    }

    /**
     * Get rating change
     */
    public function getRatingChangeAttribute(): ?int
    {
        if ($this->rating_before && $this->rating_after) {
            return $this->rating_after - $this->rating_before;
        }

        return null;
    }

    /**
     * Get rating change with sign
     */
    public function getFormattedRatingChangeAttribute(): string
    {
        $change = $this->rating_change;

        if ($change === null) {
            return '';
        }

        $sign = $change >= 0 ? '+' : '';
        return "{$sign}{$change}";
    }

    /**
     * Get rating change color class
     */
    public function getRatingChangeColorClassAttribute(): string
    {
        $change = $this->rating_change;

        if ($change === null) {
            return 'text-gray-600';
        }

        return match(true) {
            $change > 0 => 'text-green-600',
            $change < 0 => 'text-red-600',
            default => 'text-gray-600',
        };
    }

    /**
     * Scope to get assessments by user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to get assessments by skill tier
     */
    public function scopeByTier($query, $tier)
    {
        return $query->where('skill_tier', $tier);
    }

    /**
     * Scope to get assessments by type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('assessment_type', $type);
    }

    /**
     * Scope to get passed assessments
     */
    public function scopePassed($query)
    {
        return $query->where('score', '>=', 70);
    }

    /**
     * Scope to get recent assessments
     */
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('completed_at', '>=', now()->subDays($days));
    }

    /**
     * Check if user can unlock next tier
     */
    public function canUnlockNextTier(): bool
    {
        if (!$this->isPassed()) {
            return false;
        }

        return match($this->skill_tier) {
            'beginner' => true, // Can unlock intermediate
            'intermediate' => true, // Can unlock advanced
            'advanced' => false, // No higher tier
            default => false,
        };
    }

    /**
     * Get next tier that can be unlocked
     */
    public function getNextTierAttribute(): ?string
    {
        return match($this->skill_tier) {
            'beginner' => 'intermediate',
            'intermediate' => 'advanced',
            default => null,
        };
    }
}