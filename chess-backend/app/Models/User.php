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
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'provider_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
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

        // Fallback to a dynamic avatar based on email
        return 'https://i.pravatar.cc/150?u=' . urlencode($this->email);
    }

    /**
     * Get avatar attribute for backward compatibility
     * Some frontend components might still use 'avatar'
     */
    public function getAvatarAttribute()
    {
        return $this->avatar_url;
    }
}
