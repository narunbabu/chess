<?php

namespace App\Services;

use App\Models\Championship;

class RoundTypeDetectionService
{
    /**
     * Determine the type of round based on championship configuration
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return string 'swiss' or 'elimination'
     */
    public function determineRoundType(Championship $championship, int $roundNumber): string
    {
        $config = $championship->tournament_configuration ?? [];

        // Check if championship has explicit round type configuration
        if (isset($config['rounds'][$roundNumber]['type'])) {
            return $config['rounds'][$roundNumber]['type'];
        }

        // Default logic: Swiss until configured cutoff, then Elimination
        $swissRounds = $config['swiss_rounds'] ?? $this->calculateSwissRounds($championship);

        if ($roundNumber <= $swissRounds) {
            return 'swiss';
        }

        return 'elimination';
    }

    /**
     * Calculate number of Swiss rounds based on participant count
     */
    private function calculateSwissRounds(Championship $championship): int
    {
        $participantCount = $championship->participants()->paid()->count();

        // Standard Swiss formula: log2(participants) rounded
        return (int) ceil(log($participantCount, 2));
    }

    /**
     * Check if round should transition to elimination bracket
     */
    public function shouldTransitionToElimination(Championship $championship, int $completedRound): bool
    {
        $swissRounds = $championship->tournament_configuration['swiss_rounds'] ??
                       $this->calculateSwissRounds($championship);

        return $completedRound >= $swissRounds;
    }

    /**
     * Get elimination bracket configuration for a round
     */
    public function getEliminationConfig(Championship $championship, int $roundNumber): array
    {
        $config = $championship->tournament_configuration ?? [];

        // Explicit configuration takes precedence
        if (isset($config['rounds'][$roundNumber])) {
            return $config['rounds'][$roundNumber];
        }

        // Default elimination bracket sizing
        $swissRounds = $config['swiss_rounds'] ?? $this->calculateSwissRounds($championship);
        $eliminationRound = $roundNumber - $swissRounds;
        $participantCount = $this->getEliminationParticipantCount($championship, $eliminationRound);

        return [
            'type' => $this->getEliminationRoundType($eliminationRound, $participantCount),
            'participants' => $participantCount,
            'round_number' => $roundNumber,
            'elimination_round' => $eliminationRound
        ];
    }

    /**
     * Get the number of participants in elimination rounds
     */
    private function getEliminationParticipantCount(Championship $championship, int $eliminationRound): int
    {
        // For 10-player tournament:
        // - 3 Swiss rounds → Top 4 advance to elimination
        // - Round 4: Semi-finals (4 participants)
        // - Round 5: Finals (2 participants)

        $totalParticipants = $championship->participants()->paid()->count();

        if ($totalParticipants <= 8) {
            // Small tournaments: Top 4 advance
            return match($eliminationRound) {
                1 => 4, // Semi-finals
                2 => 2, // Finals
                default => 2
            };
        } elseif ($totalParticipants <= 16) {
            // Medium tournaments: Top 8 advance
            return match($eliminationRound) {
                1 => 8, // Quarter-finals
                2 => 4, // Semi-finals
                3 => 2, // Finals
                default => 2
            };
        } else {
            // Large tournaments: Top 16 advance
            return match($eliminationRound) {
                1 => 16, // Round of 16
                2 => 8,  // Quarter-finals
                3 => 4,  // Semi-finals
                4 => 2,  // Finals
                default => 2
            };
        }
    }

    /**
     * Get the specific elimination round type
     */
    private function getEliminationRoundType(int $eliminationRound, int $participantCount): string
    {
        return match($participantCount) {
            2 => 'final',
            4 => 'semi_final',
            8 => 'quarter_final',
            16 => 'round_of_16',
            32 => 'round_of_32',
            default => 'elimination_round_' . $eliminationRound
        };
    }

    /**
     * Validate tournament configuration for round type consistency
     */
    public function validateConfiguration(Championship $championship): array
    {
        $errors = [];
        $config = $championship->tournament_configuration ?? [];
        $participantCount = $championship->participants()->paid()->count();

        // Check if swiss_rounds is reasonable
        $swissRounds = $config['swiss_rounds'] ?? $this->calculateSwissRounds($championship);
        $maxReasonableSwissRounds = (int) ceil(log($participantCount, 2)) + 2;

        if ($swissRounds > $maxReasonableSwissRounds) {
            $errors[] = "Too many Swiss rounds ({$swissRounds}) for {$participantCount} participants. Maximum recommended: {$maxReasonableSwissRounds}";
        }

        // Check total rounds configuration
        if (isset($config['total_rounds'])) {
            $minimumRounds = $swissRounds + 2; // Swiss + semi-final + final
            if ($config['total_rounds'] < $minimumRounds) {
                $errors[] = "Total rounds ({$config['total_rounds']}) is too small. Minimum required: {$minimumRounds} ({$swissRounds} Swiss + 2 elimination)";
            }
        }

        return $errors;
    }
}