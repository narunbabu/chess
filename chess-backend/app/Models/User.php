<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'provider',
        'provider_id',
        'provider_token',
        'avatar_url',
        'rating',
        'is_provisional',
        'games_played',
        'peak_rating',
        'rating_last_updated',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'provider_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_provisional' => 'boolean',
        'rating_last_updated' => 'datetime',
    ];

    /**
     * Get the avatar URL with fallback
     * Ensures backward compatibility and provides a default avatar
     */
    public function getAvatarUrlAttribute($value)
    {
        // If avatar_url is set, use it
        if ($value) {
            return $value;
        }

        // Fallback to a dynamic avatar based on email or ID
        if ($this->email) {
            return 'https://i.pravatar.cc/150?u=' . urlencode($this->email);
        }

        // Final fallback using user ID if email is not available
        return 'https://i.pravatar.cc/150?u=user' . $this->id;
    }

    /**
     * Get avatar attribute for backward compatibility
     * Some frontend components might still use 'avatar'
     */
    public function getAvatarAttribute()
    {
        return $this->avatar_url;
    }

    /**
     * Calculate K-factor for Elo rating calculation
     * Higher K-factor means faster rating changes
     *
     * @return int K-factor value
     */
    public function getKFactorAttribute()
    {
        // Provisional period: first 20 games use high K-factor for fast convergence
        if ($this->is_provisional || $this->games_played < 20) {
            return 64;
        }

        // Established players: K-factor based on rating level
        if ($this->rating >= 2400) {
            return 10; // Expert/Master level: very stable ratings
        } elseif ($this->rating >= 2000) {
            return 16; // Strong players: moderately stable
        } else {
            return 32; // Active players: normal adjustment
        }
    }

    /**
     * Update user rating after a game
     *
     * @param int $opponentRating Opponent's rating
     * @param float $actualScore Player's score (1.0 = win, 0.5 = draw, 0.0 = loss)
     * @return array Updated rating data
     */
    public function updateRating($opponentRating, $actualScore)
    {
        // Calculate expected score using Elo formula
        $expectedScore = 1 / (1 + pow(10, ($opponentRating - $this->rating) / 400));

        // Calculate rating change
        $ratingChange = $this->k_factor * ($actualScore - $expectedScore);

        // Update rating
        $oldRating = $this->rating;
        $newRating = round($oldRating + $ratingChange);

        // Update peak rating if new high
        $newPeakRating = max($this->peak_rating, $newRating);

        // Increment games played
        $newGamesPlayed = $this->games_played + 1;

        // Exit provisional period after 20 games
        $isProvisional = $newGamesPlayed < 20;

        // Update model
        $this->update([
            'rating' => $newRating,
            'games_played' => $newGamesPlayed,
            'peak_rating' => $newPeakRating,
            'is_provisional' => $isProvisional,
            'rating_last_updated' => now(),
        ]);

        return [
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => round($ratingChange),
            'expected_score' => round($expectedScore, 3),
            'k_factor' => $this->k_factor,
            'is_provisional' => $isProvisional,
        ];
    }

    /**
     * Friends relationship - many-to-many
     */
    public function friends()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'user_id', 'friend_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'accepted');
    }

    /**
     * Pending friend requests sent by this user
     */
    public function sentFriendRequests()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'user_id', 'friend_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'pending');
    }

    /**
     * Pending friend requests received by this user
     */
    public function receivedFriendRequests()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'friend_id', 'user_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'pending');
    }
}
