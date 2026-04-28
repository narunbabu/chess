<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameAnalysis extends Model
{
    protected $table = 'game_analyses';

    protected $fillable = [
        'game_id',
        'status',
        'depth',
        'move_analyses',
        'accuracy_white',
        'accuracy_black',
        'acpl_white',
        'acpl_black',
        'quality_counts',
        'error_message',
        'completed_at',
    ];

    protected $casts = [
        'move_analyses' => 'array',
        'accuracy_white' => 'float',
        'accuracy_black' => 'float',
        'acpl_white' => 'float',
        'acpl_black' => 'float',
        'quality_counts' => 'array',
        'completed_at' => 'datetime',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
