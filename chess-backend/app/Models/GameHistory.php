
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GameHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pgn',
        'result',
        'moves',
        'duration',
        'metadata',
        'share_token',
        'gif_url',
        'video_url',
        'credits_wagered',
        'credits_won',
        'opponent_type',
        'opponent_name',
        'difficulty_level',
        'is_guest_game'
    ];

    protected $casts = [
        'metadata' => 'array'
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($game) {
            if (!$game->share_token) {
                $game->share_token = Str::random(32);
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function walletTransactions()
    {
        return $this->hasMany(WalletTransaction::class, 'source_game_id');
    }

    public function getShareUrlAttribute()
    {
        return config('app.frontend_url') . '/games/' . $this->share_token;
    }
}
