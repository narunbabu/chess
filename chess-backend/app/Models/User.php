
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'provider',
        'provider_id',
        'credits',
        'ref_code',
        'referred_by',
        'total_games',
        'wins',
        'losses',
        'draws',
        'current_streak',
        'best_streak',
        'last_game_at',
        'achievements'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'last_game_at' => 'datetime',
        'achievements' => 'array'
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($user) {
            if (!$user->ref_code) {
                $user->ref_code = strtoupper(Str::random(8));
            }
        });
    }

    public function gameHistories()
    {
        return $this->hasMany(GameHistory::class);
    }

    public function walletTransactions()
    {
        return $this->hasMany(WalletTransaction::class);
    }

    public function tournamentEntries()
    {
        return $this->hasMany(TournamentEntry::class);
    }

    public function addCredits($amount, $reason, $description = null, $gameId = null, $meta = null)
    {
        $this->increment('credits', $amount);
        
        return WalletTransaction::create([
            'user_id' => $this->id,
            'delta' => $amount,
            'reason' => $reason,
            'description' => $description,
            'source_game_id' => $gameId,
            'meta' => $meta,
            'balance_after' => $this->fresh()->credits
        ]);
    }

    public function deductCredits($amount, $reason, $description = null, $gameId = null, $meta = null)
    {
        if ($this->credits < $amount) {
            return false;
        }
        
        $this->decrement('credits', $amount);
        
        WalletTransaction::create([
            'user_id' => $this->id,
            'delta' => -$amount,
            'reason' => $reason,
            'description' => $description,
            'source_game_id' => $gameId,
            'meta' => $meta,
            'balance_after' => $this->fresh()->credits
        ]);

        return true;
    }

    public function updateGameStats($result)
    {
        $this->increment('total_games');
        $this->last_game_at = now();
        
        switch ($result) {
            case 'win':
                $this->increment('wins');
                $this->increment('current_streak');
                if ($this->current_streak > $this->best_streak) {
                    $this->best_streak = $this->current_streak;
                }
                break;
            case 'loss':
                $this->increment('losses');
                $this->current_streak = 0;
                break;
            case 'draw':
                $this->increment('draws');
                break;
        }
        
        $this->save();
    }

    public function getWinRateAttribute()
    {
        if ($this->total_games == 0) return 0;
        return round(($this->wins / $this->total_games) * 100, 1);
    }
}
