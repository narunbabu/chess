<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameStatus extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'game_statuses';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['code', 'label'];

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = true;

    /**
     * Get games with this status
     */
    public function games()
    {
        return $this->hasMany(Game::class, 'status_id');
    }

    /**
     * Find status by code
     */
    public static function findByCode(string $code): ?self
    {
        return static::where('code', $code)->first();
    }

    /**
     * Get status ID by code (cached for performance)
     */
    public static function getIdByCode(string $code): ?int
    {
        return cache()->remember("game_status_{$code}", 3600, function () use ($code) {
            return static::where('code', $code)->value('id');
        });
    }
}
