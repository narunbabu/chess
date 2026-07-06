<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameChatMessage extends Model
{
    protected $fillable = [
        'game_id',
        'user_id',
        'message',
        'original_message',
        'message_type',
        'safety_action',
        'filtered',
    ];

    protected $casts = [
        'filtered' => 'boolean',
    ];

    public function game()
    {
        return $this->belongsTo(Game::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reports()
    {
        return $this->hasMany(ChatMessageReport::class);
    }
}
