<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameEndReason extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'game_end_reasons';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['code', 'label'];

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = true;

    /**
     * Get games with this end reason
     */
    public function games()
    {
        return $this->hasMany(Game::class, 'end_reason_id');
    }

    /**
     * Find end reason by code
     */
    public static function findByCode(string $code): ?self
    {
        return static::where('code', $code)->first();
    }

    /**
     * Get end reason ID by code (cached for performance)
     */
    public static function getIdByCode(string $code): ?int
    {
        return cache()->remember("game_end_reason_{$code}", 3600, function () use ($code) {
            return static::where('code', $code)->value('id');
        });
    }
}
