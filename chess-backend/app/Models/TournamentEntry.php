
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TournamentEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'tournament_id',
        'user_id',
        'final_position',
        'points',
        'prize_won'
    ];

    public function tournament()
    {
        return $this->belongsTo(Tournament::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
