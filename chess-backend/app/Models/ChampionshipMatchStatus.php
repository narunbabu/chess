<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChampionshipMatchStatus extends Model
{
    protected $table = 'championship_match_statuses';

    protected $fillable = ['code', 'label'];

    protected $casts = [
        'id' => 'integer',
    ];

    /**
     * Static cache for status lookups
     */
    private static ?array $codeMap = null;

    /**
     * Get status ID by code
     */
    public static function getIdByCode(string $code): int
    {
        if (self::$codeMap === null) {
            self::$codeMap = self::pluck('id', 'code')->toArray();
        }

        return self::$codeMap[$code] ?? throw new \InvalidArgumentException("Invalid championship match status code: {$code}");
    }

    /**
     * Clear the static cache
     */
    public static function clearCache(): void
    {
        self::$codeMap = null;
    }
}
