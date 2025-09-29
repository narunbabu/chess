<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'inviter_id',
        'invited_id',
        'status',
        'game_id',
        'inviter_preferred_color',
        'invited_preferred_color'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function inviter()
    {
        return $this->belongsTo(User::class, 'inviter_id');
    }

    public function invited()
    {
        return $this->belongsTo(User::class, 'invited_id');
    }

    public function game()
    {
        return $this->belongsTo(Game::class, 'game_id');
    }
}