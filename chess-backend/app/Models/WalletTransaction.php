
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'delta',
        'reason',
        'description',
        'source_game_id',
        'meta',
        'balance_after'
    ];

    protected $casts = [
        'meta' => 'array'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sourceGame()
    {
        return $this->belongsTo(GameHistory::class, 'source_game_id');
    }
}
