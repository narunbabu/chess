<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessageReport extends Model
{
    protected $fillable = [
        'game_chat_message_id',
        'game_id',
        'reporter_id',
        'reported_user_id',
        'reason',
        'note',
        'status',
        'reviewed_by',
        'reviewed_at',
        'resolution_note',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(GameChatMessage::class, 'game_chat_message_id');
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function reportedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
