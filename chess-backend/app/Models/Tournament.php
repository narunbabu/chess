
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tournament extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'entry_fee',
        'prize_pool',
        'max_participants',
        'status',
        'registration_start',
        'registration_end',
        'tournament_start',
        'tournament_end',
        'settings'
    ];

    protected $casts = [
        'registration_start' => 'datetime',
        'registration_end' => 'datetime',
        'tournament_start' => 'datetime',
        'tournament_end' => 'datetime',
        'settings' => 'array'
    ];

    public function entries()
    {
        return $this->hasMany(TournamentEntry::class);
    }

    public function participants()
    {
        return $this->belongsToMany(User::class, 'tournament_entries')
                   ->withPivot(['final_position', 'points', 'prize_won'])
                   ->withTimestamps();
    }
}
