<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChampionshipResultType extends Model
{
    protected $table = 'championship_result_types';

    protected $fillable = ['code', 'label'];

    protected $casts = [
        'id' => 'integer',
    ];

    /**
     * Static cache for result type lookups
     */
    private static ?array $codeMap = null;

    /**
     * Get result type ID by code
     */
    public static function getIdByCode(string $code): int
    {
        if (self::$codeMap === null) {
            self::$codeMap = self::pluck('id', 'code')->toArray();
        }

        return self::$codeMap[$code] ?? throw new \InvalidArgumentException("Invalid championship result type code: {$code}");
    }

    /**
     * Clear the static cache
     */
    public static function clearCache(): void
    {
        self::$codeMap = null;
    }
}
