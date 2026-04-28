<?php

namespace App\Services;

class OpeningDetectionService
{
    private static ?array $openings = null;
    private static ?array $sortedByLength = null;

    public function detectOpening($moves): ?array
    {
        $sanMoves = $this->extractSanMoves($moves);
        if (empty($sanMoves)) {
            return null;
        }

        $moveStr = implode(' ', $sanMoves);
        $openings = $this->getSortedOpenings();

        foreach ($openings as $opening) {
            if (str_starts_with($moveStr, $opening['moves'])) {
                return [
                    'eco' => $opening['eco'],
                    'name' => $opening['name'],
                ];
            }
        }

        return null;
    }

    public function detectOpeningName($moves): ?string
    {
        $result = $this->detectOpening($moves);
        return $result['name'] ?? null;
    }

    private function extractSanMoves($moves): array
    {
        if ($moves === null || $moves === '') {
            return [];
        }

        if (is_string($moves)) {
            // Try semicolon-separated format first: "e4,2.52;Nf6,0.98"
            if (str_contains($moves, ';')) {
                return $this->parseSemicolonMoves($moves);
            }

            // Try JSON format
            $decoded = json_decode($moves, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $moves = $decoded;
            } else {
                return [];
            }
        }

        if (!is_array($moves) || empty($moves)) {
            return [];
        }

        $sans = [];
        foreach (array_slice($moves, 0, 12) as $move) {
            $san = $move['san'] ?? $move['move'] ?? $move['notation'] ?? null;
            if ($san) {
                $sans[] = $san;
            }
        }

        return $sans;
    }

    private function parseSemicolonMoves(string $moves): array
    {
        $sans = [];
        $pairs = explode(';', $moves);
        foreach (array_slice($pairs, 0, 12) as $pair) {
            if (empty(trim($pair))) {
                continue;
            }
            $parts = explode(',', $pair);
            $san = trim($parts[0]);
            if ($san) {
                $sans[] = $san;
            }
        }
        return $sans;
    }

    private function getSortedOpenings(): array
    {
        if (self::$sortedByLength !== null) {
            return self::$sortedByLength;
        }

        $openings = $this->loadOpenings();

        usort($openings, function ($a, $b) {
            $lenA = substr_count($a['moves'], ' ');
            $lenB = substr_count($b['moves'], ' ');
            return $lenB - $lenA;
        });

        self::$sortedByLength = $openings;
        return $openings;
    }

    private function loadOpenings(): array
    {
        if (self::$openings !== null) {
            return self::$openings;
        }

        $path = database_path('data/eco_openings.json');
        if (!file_exists($path)) {
            self::$openings = [];
            return self::$openings;
        }

        $content = file_get_contents($path);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            self::$openings = [];
            return self::$openings;
        }

        self::$openings = array_filter($data, fn($o) => isset($o['eco'], $o['name'], $o['moves']));
        return self::$openings;
    }

    public static function clearCache(): void
    {
        self::$openings = null;
        self::$sortedByLength = null;
    }
}
