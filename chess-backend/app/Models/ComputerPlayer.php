<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComputerPlayer extends Model
{
    protected $fillable = [
        'name',
        'level',
        'rating',
        'avatar',
        'is_active'
    ];

    protected $casts = [
        'level' => 'integer',
        'rating' => 'integer',
        'is_active' => 'boolean'
    ];

    /**
     * Get or create a computer player for the specified level
     */
    public static function getByLevel(int $level): self
    {
        return self::firstOrCreate([
            'level' => $level
        ], [
            'name' => "Computer Level {$level}",
            'rating' => 800 + ($level * 100), // Base rating + level * 100
            'avatar' => '🤖',
            'is_active' => true
        ]);
    }

    /**
     * Get available computer levels
     */
    public static function getAvailableLevels(): array
    {
        return self::where('is_active', true)
            ->orderBy('level')
            ->pluck('level', 'name')
            ->toArray();
    }

    /**
     * Scope to get only active computer players
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
