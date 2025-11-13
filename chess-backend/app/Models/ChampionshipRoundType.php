<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChampionshipRoundType extends Model
{
    protected $table = 'championship_round_types';

    protected $fillable = ['code', 'label'];

    protected $casts = [
        'id' => 'integer',
    ];

    /**
     * Static cache for round type lookups
     */
    private static ?array $codeMap = null;

    /**
     * Get round type ID by code
     */
    public static function getIdByCode(string $code): int
    {
        if (self::$codeMap === null) {
            self::$codeMap = self::pluck('id', 'code')->toArray();
        }

        return self::$codeMap[$code] ?? throw new \InvalidArgumentException("Invalid championship round type code: {$code}");
    }

    /**
     * Clear the static cache
     */
    public static function clearCache(): void
    {
        self::$codeMap = null;
    }
}
