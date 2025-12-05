<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\User;

class DebugByeSelection extends Command
{
    protected $signature = 'test:debug-bye-selection {championship_id=89}';
    protected $description = 'Debug why same player gets BYE in multiple rounds';

    public function handle()
    {
        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("❌ Championship not found (ID: {$championshipId})");
            return 1;
        }

        $this->info("🔍 Debugging BYE Selection for: {$championship->name}");
        $this->line("");

        // Get all players with their BYE history
        $this->info("📊 Player BYE History:");
        $this->line("========================");

        // Get all participants
        $participants = $championship->participants()
            ->with('user')
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->get();

        foreach ($participants as $participant) {
            $byeHistory = $championship->matches()
                ->whereNull('player2_id')  // BYE matches
                ->where('player1_id', $participant->user_id)
                ->orderBy('round_number')
                ->get()
                ->pluck('round_number')
                ->toArray();

            $byeCount = count($byeHistory);
            $byeRounds = empty($byeHistory) ? 'None' : implode(', ', $byeHistory);

            $status = $byeCount > 1 ? '❌' : '✅';

            $this->line("   {$status} {$participant->user->name} ({$participant->user->rating}): {$byeCount} BYEs in rounds [{$byeRounds}]");
        }

        $this->line("");
        $this->info("🎯 Why Test Player E Got BYE in Round 2:");
        $this->line("=========================================");

        // Get Round 2 participants and their scores
        $standings = $championship->standings()->get()->keyBy('user_id');

        $this->info("Round 2 Standings (who should get BYE):");
        foreach ($participants as $participant) {
            $standing = $standings->get($participant->user_id);
            $score = $standing ? $standing->points : 0;
            $byes = $championship->matches()
                ->whereNull('player2_id')
                ->where('player1_id', $participant->user_id)
                ->count();

            $this->line("   {$participant->user->name}: {$score} points, {$byes} previous BYEs");
        }

        // Find who should have gotten the BYE in Round 2
        $this->line("");
        $this->info("🏆 Best BYE Candidates for Round 2:");
        $this->line("(Lowest score + fewest BYEs)");

        // Sort candidates by: 1) Lowest score, 2) Fewest BYEs
        $candidates = $participants->sortBy(function ($participant) use ($standings, $championship) {
            $score = $standings->get($participant->user_id)?->points ?? 0;
            $byes = $championship->matches()
                ->whereNull('player2_id')
                ->where('player1_id', $participant->user_id)
                ->count();

            // Lower array = higher priority (should get BYE)
            return [
                $score,  // Lowest score first
                $byes,   // Fewest BYEs second
            ];
        });

        foreach ($candidates as $i => $participant) {
            $standing = $standings->get($participant->user_id);
            $score = $standing ? $standing->points : 0;
            $byes = $championship->matches()
                ->whereNull('player2_id')
                ->where('player1_id', $participant->user_id)
                ->count();

            $ranking = $i + 1;
            $bestChoice = $i === 0 ? '👑 SHOULD GET BYE' : '';
            $this->line("   {$ranking}. {$participant->user->name}: {$score} points, {$byes} BYEs {$bestChoice}");
        }

        $this->line("");
        $this->info("🚨 PROBLEM ANALYSIS:");
        $this->line("===================");
        $this->line("The Swiss algorithm should prioritize:");
        $this->line("1. Lowest score players (for fairness)");
        $this->line("2. Players with fewest BYEs (for distribution)");
        $this->line("");
        $this->error("❌ Test Player E had 1 point after Round 1 (won via BYE)");
        $this->error("❌ Test Player A and D had 0 points (lost their matches)");
        $this->line("");
        $this->info("✅ Correct BYE recipient should be: Player A or Player D");
        $this->info("❌ Actual BYE recipient was: Player E (already had BYE!)");

        return 0;
    }
}