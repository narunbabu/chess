<?php

namespace App\Services;

class TacticalRatingService
{
    public function computeRatingDelta(array $puzzle, bool $success, int $wrongCount, float $cctQuality = 1.0): array
    {
        $difficulty = $puzzle['difficulty'] ?? 'easy';

        $base = match ($difficulty) {
            'very hard' => 12,
            'hard' => 8,
            'medium' => 5,
            default => 3,
        };

        if ($success) {
            $bonus = $wrongCount === 0 ? (int) round($base * 0.4) : 0;
            $raw = $base + $bonus;
            $mult = $cctQuality >= 0.9 ? 1.0
                : ($cctQuality >= 0.7 ? 0.85
                : ($cctQuality >= 0.5 ? 0.70
                : 0.50));

            return [
                'value' => max(1, (int) round($raw * $mult)),
                'sign' => '+',
            ];
        }

        return [
            'value' => (int) ceil($base * 0.3),
            'sign' => '-',
        ];
    }
}
