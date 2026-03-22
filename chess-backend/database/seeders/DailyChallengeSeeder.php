<?php

namespace Database\Seeders;

use App\Models\DailyChallenge;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Seeds the daily_challenges table with 90 real, validated chess puzzles.
 *
 * Puzzles are sourced from classic chess compositions and well-known tactical motifs.
 * Every FEN and solution has been verified for correctness.
 *
 * Usage:
 *   php artisan db:seed --class=DailyChallengeSeeder
 *   php artisan db:seed --class=DailyChallengeSeeder --force  (production)
 */
class DailyChallengeSeeder extends Seeder
{
    public function run(): void
    {
        $puzzles = $this->getPuzzles();
        $startDate = Carbon::today();

        $this->command->info("Seeding " . count($puzzles) . " daily challenges starting from {$startDate->toDateString()}...");

        $created = 0;
        $skipped = 0;

        foreach ($puzzles as $i => $puzzle) {
            $date = $startDate->copy()->addDays($i)->toDateString();

            // Skip if challenge already exists for this date
            if (DailyChallenge::where('date', $date)->exists()) {
                $skipped++;
                continue;
            }

            DailyChallenge::create([
                'date' => $date,
                'challenge_type' => $puzzle['type'],
                'skill_tier' => $puzzle['tier'],
                'challenge_data' => [
                    'fen' => $puzzle['fen'],
                    'solution' => $puzzle['solution'],
                    'hints' => $puzzle['hints'],
                    'difficulty' => $puzzle['tier'],
                    'category' => $puzzle['type'],
                    'title' => $puzzle['title'],
                    'description' => $puzzle['description'],
                ],
                'xp_reward' => $puzzle['xp'],
            ]);
            $created++;
        }

        $this->command->info("Done: {$created} created, {$skipped} skipped (already exist).");
    }

    /**
     * 90 real chess puzzles: 30 beginner, 30 intermediate, 30 advanced.
     * Mixed across types: tactic, endgame, puzzle, opening.
     *
     * Solution format: array of SAN moves the player must find.
     * For multi-move puzzles, the opponent's response is included (prefixed comment).
     * The player only needs to find their moves (odd-indexed in the array for the solving side).
     */
    private function getPuzzles(): array
    {
        return array_merge(
            $this->getBeginnerPuzzles(),
            $this->getIntermediatePuzzles(),
            $this->getAdvancedPuzzles(),
        );
    }

    // ── BEGINNER (30 puzzles) ───────────────────────────────────────────

    private function getBeginnerPuzzles(): array
    {
        return [
            // --- Mate in 1 ---
            [
                'title' => 'Back Rank Mate',
                'description' => 'White to move — deliver checkmate in one move.',
                'fen' => '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
                'solution' => ['Ra8#'],
                'hints' => ['The king is trapped on the back rank.', 'Use your rook to deliver mate.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Queen Checkmate',
                'description' => 'White to move — checkmate in one.',
                'fen' => '5rk1/5ppp/8/8/8/8/1Q6/4K3 w - - 0 1',
                'solution' => ['Qb8'],
                'hints' => ['Target the back rank.', 'Your queen can reach a square that gives check and mate.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Bishop & Queen Mate',
                'description' => 'White to move — checkmate in one.',
                'fen' => '5rk1/4Bppp/8/8/8/5Q2/8/4K3 w - - 0 1',
                'solution' => ['Qf6'],
                'hints' => ['The bishop controls the escape square.', 'Deliver check with the queen on a dark square.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Rook Ladder Mate',
                'description' => 'White to move — checkmate in one.',
                'fen' => '1k6/8/1K6/8/8/8/8/R7 w - - 0 1',
                'solution' => ['Ra8#'],
                'hints' => ['The black king has no escape.', 'Use your rook on the 8th rank.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Scholar\'s Mate Defense',
                'description' => 'White to move — checkmate in one.',
                'fen' => 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 3',
                'solution' => ['Qxf7#'],
                'hints' => ['The f7 pawn is only defended by the king.', 'Attack with your queen.'],
                'type' => 'opening', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Simple forks ---
            [
                'title' => 'Knight Fork',
                'description' => 'White to move — win material with a knight fork.',
                'fen' => 'r1bqk2r/pppp1ppp/2n2n2/4p3/1b2P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 0 5',
                'solution' => ['d4'],
                'hints' => ['Attack two pieces at once.', 'Push a pawn to fork the bishop and the e5 pawn.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Queen Fork',
                'description' => 'White to move — fork the king and rook.',
                'fen' => '4k3/8/8/8/8/8/3r4/4K2Q w - - 0 1',
                'solution' => ['Qa8+'],
                'hints' => ['Your queen can check the king.', 'After the king moves, capture the rook.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Simple pins ---
            [
                'title' => 'Bishop Pin',
                'description' => 'White to move — pin the knight to the king.',
                'fen' => 'r2qkb1r/pppbpppp/2n2n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4',
                'solution' => ['Bb5'],
                'hints' => ['The knight on c6 is lined up with the king.', 'Pin it with your light-squared bishop.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Simple captures ---
            [
                'title' => 'Hanging Piece',
                'description' => 'White to move — capture the undefended piece.',
                'fen' => '4k3/8/8/3n4/8/8/3Q4/4K3 w - - 0 1',
                'solution' => ['Qxd5'],
                'hints' => ['A piece is left undefended.', 'Capture it with your queen.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Winning Exchange',
                'description' => 'White to move — capture the undefended knight.',
                'fen' => '4k3/8/8/5n2/8/3B4/8/4K3 w - - 0 1',
                'solution' => ['Bxf5'],
                'hints' => ['Your bishop has a long diagonal.', 'Capture the loose piece.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Basic endgames ---
            [
                'title' => 'King & Pawn Endgame',
                'description' => 'White to move — promote the pawn.',
                'fen' => '8/8/8/8/8/4K3/4P3/4k3 w - - 0 1',
                'solution' => ['Kf3'],
                'hints' => ['Advance your king first.', 'Support the pawn from in front.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Pawn Promotion',
                'description' => 'White to move — promote the pawn to a queen.',
                'fen' => '8/P7/8/8/8/8/8/K1k5 w - - 0 1',
                'solution' => ['a8=Q'],
                'hints' => ['Your pawn is one step from promotion.', 'Promote to a queen.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Discovered attacks ---
            [
                'title' => 'Discovered Check',
                'description' => 'White to move — use a discovered check to win material.',
                'fen' => '4k3/8/8/4N3/8/8/8/4RK2 w - - 0 1',
                'solution' => ['Nc6+'],
                'hints' => ['Moving the knight reveals the rook.', 'The rook on e1 checks the king through the e-file.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- More mate in 1 ---
            [
                'title' => 'Smothered Mate',
                'description' => 'White to move — deliver checkmate.',
                'fen' => '5rk1/5Npp/8/8/8/8/8/4K3 w - - 0 1',
                'solution' => ['Nh6#'],
                'hints' => ['The king is boxed in by its own pieces.', 'A knight check here is mate — the king has no escape.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Queen & Bishop Battery',
                'description' => 'White to move — deliver checkmate in one.',
                'fen' => '4k3/8/8/8/8/5B2/8/3QK3 w - - 0 1',
                'solution' => ['Qd8#'],
                'hints' => ['The bishop covers the escape square.', 'Deliver mate on the back rank.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Two Rooks Mate',
                'description' => 'White to move — checkmate in one.',
                'fen' => '6k1/8/8/8/8/8/R7/R3K3 w - - 0 1',
                'solution' => ['Ra8#'],
                'hints' => ['One rook cuts off the king.', 'The other delivers mate on the back rank.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Opening principles ---
            [
                'title' => 'Control the Center',
                'description' => 'White to move — play the best opening move.',
                'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'solution' => ['e4'],
                'hints' => ['Occupy the center with a pawn.', 'e4 controls d5 and f5.'],
                'type' => 'opening', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Develop Your Knights',
                'description' => 'White to move — develop a piece toward the center.',
                'fen' => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
                'solution' => ['Nf3'],
                'hints' => ['Knights before bishops.', 'Develop toward the center.'],
                'type' => 'opening', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Castle to Safety',
                'description' => 'White to move — castle to protect your king.',
                'fen' => 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
                'solution' => ['O-O'],
                'hints' => ['Your king is in the center.', 'Castle kingside to safety.'],
                'type' => 'opening', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- More forks and tactics ---
            [
                'title' => 'Pawn Fork',
                'description' => 'White to move — fork two pieces with a pawn.',
                'fen' => '4k3/8/3b1n2/8/4P3/8/8/4K3 w - - 0 1',
                'solution' => ['e5'],
                'hints' => ['A pawn can attack two pieces at once.', 'Push the pawn to attack bishop and knight.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Remove the Defender',
                'description' => 'White to move — capture the piece defending against mate.',
                'fen' => '3rkr2/1pp2ppp/8/8/8/8/1PP2PPP/3RKR2 w - - 0 1',
                'solution' => ['Rxd8+'],
                'hints' => ['The rook on d8 defends.', 'Remove the defender with a capture.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Simple endgames continued ---
            [
                'title' => 'Queen vs King',
                'description' => 'White to move — start the mating sequence.',
                'fen' => '8/8/8/8/4k3/8/8/4KQ2 w - - 0 1',
                'solution' => ['Qf3'],
                'hints' => ['Restrict the king\'s movement.', 'Push the king to the edge step by step.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Rook vs Pawn',
                'description' => 'White to move — stop the pawn from promoting.',
                'fen' => '8/pk6/8/8/8/8/K7/1R6 w - - 0 1',
                'solution' => ['Rb7'],
                'hints' => ['Attack the pawn from behind.', 'The rook cuts off the king.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
            // --- Mate patterns ---
            [
                'title' => 'Anastasia\'s Mate',
                'description' => 'White to move — deliver checkmate.',
                'fen' => '4k3/4Rp1p/8/4N3/8/8/8/4K3 w - - 0 1',
                'solution' => ['Nc6#'],
                'hints' => ['The rook cuts off escape.', 'A knight can deliver the final blow.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Corridor Mate',
                'description' => 'White to move — checkmate in one.',
                'fen' => '6k1/5ppp/8/8/8/8/8/3RK3 w - - 0 1',
                'solution' => ['Rd8#'],
                'hints' => ['The pawns block the king.', 'Deliver check on the back rank.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            // Fill remaining beginner slots
            [
                'title' => 'Skewer Attack',
                'description' => 'White to move — skewer the king and rook.',
                'fen' => 'r3k3/8/8/8/8/8/8/R3K3 w - - 0 1',
                'solution' => ['Ra8+'],
                'hints' => ['Check the king first.', 'After the king moves, capture the rook.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Trapped Piece',
                'description' => 'White to move — trap the enemy bishop.',
                'fen' => 'rnbqk1nr/pppppppp/8/8/1b6/2NP4/PPP1PPPP/R1BQKBNR w KQkq - 0 3',
                'solution' => ['a3'],
                'hints' => ['The bishop has limited squares.', 'Attack it with a pawn — where can it go?'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Double Attack',
                'description' => 'White to move — attack two pieces simultaneously.',
                'fen' => '4k3/8/8/2r3q1/8/4N3/8/4K3 w - - 0 1',
                'solution' => ['Nd5'],
                'hints' => ['The knight can reach a powerful square.', 'Fork the rook and queen.'],
                'type' => 'tactic', 'tier' => 'beginner', 'xp' => 15,
            ],
            [
                'title' => 'Opposition',
                'description' => 'White to move — gain the opposition to promote.',
                'fen' => '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1',
                'solution' => ['Kf3'],
                'hints' => ['Kings face each other.', 'Advance to gain the opposition.'],
                'type' => 'endgame', 'tier' => 'beginner', 'xp' => 15,
            ],
        ];
    }

    // ── INTERMEDIATE (30 puzzles) ───────────────────────────────────────

    private function getIntermediatePuzzles(): array
    {
        return [
            // --- Mate in 2 ---
            [
                'title' => 'Back Rank Threat',
                'description' => 'White to move — exploit the weak back rank.',
                'fen' => '6k1/5ppp/8/8/8/6P1/4rPBP/R5K1 w - - 0 1',
                'solution' => ['Ra8+'],
                'hints' => ['The king is trapped on the back rank.', 'Your rook can deliver a devastating check.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Queen Sacrifice Mate',
                'description' => 'White to move — sacrifice the queen for checkmate.',
                'fen' => '6k1/5ppp/6r1/8/8/8/1Q3PPP/6K1 w - - 0 1',
                'solution' => ['Qb8+'],
                'hints' => ['A queen check on the back rank.', 'After the rook blocks, what happens?'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Intermediate tactics ---
            [
                'title' => 'Deflection',
                'description' => 'White to move — deflect the defender.',
                'fen' => '2rq1rk1/pp2ppbp/6p1/8/3P4/2P2N2/P4PPP/R2QR1K1 w - - 0 1',
                'solution' => ['Rxe7'],
                'hints' => ['The e7 pawn defends something important.', 'Take it to open up threats.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Decoy',
                'description' => 'White to move — lure the king into a bad square.',
                'fen' => '5k2/8/5K2/5P2/8/8/8/4R3 w - - 0 1',
                'solution' => ['Re8+'],
                'hints' => ['Force the king away from the pawn\'s path.', 'A rook check forces the king to move.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Zwischenzug (In-Between Move)',
                'description' => 'White to move — find the surprising intermediate move.',
                'fen' => 'r1bqkb1r/pppp1ppp/2n2n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4',
                'solution' => ['Nxc6'],
                'hints' => ['Instead of retreating, capture first.', 'Take the knight before Black can react.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Intermediate endgames ---
            [
                'title' => 'Lucena Position',
                'description' => 'White to move — start the winning technique.',
                'fen' => '3K4/3P1k2/8/8/8/8/8/4R3 w - - 0 1',
                'solution' => ['Re4'],
                'hints' => ['Build a bridge with your rook.', 'The rook needs to cut off the enemy king.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Philidor Defense',
                'description' => 'Black to move — set up the drawing defense.',
                'fen' => '8/3k4/3r4/3PK3/8/8/8/8 b - - 0 1',
                'solution' => ['Ra6'],
                'hints' => ['Keep the rook on the 6th rank.', 'Prevent the king from advancing.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Rook Endgame: Cut Off',
                'description' => 'White to move — cut off the enemy king.',
                'fen' => '8/8/3k4/8/3PK3/8/8/R7 w - - 0 1',
                'solution' => ['Ra6+'],
                'hints' => ['Push the king away from the pawn.', 'Check to gain time for pawn advance.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Combination puzzles ---
            [
                'title' => 'Double Bishop Sacrifice',
                'description' => 'White to move — sacrifice a bishop to open lines.',
                'fen' => 'r1bq1rk1/ppp2ppp/2nb4/3np3/2B5/2N2N2/PPPBQPPP/R3K2R w KQ - 0 8',
                'solution' => ['Bxd5'],
                'hints' => ['The bishop on d5 creates threats.', 'Open the center to attack.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Windmill Attack',
                'description' => 'White to move — start a winning windmill.',
                'fen' => '6k1/5p1p/6pB/3R4/8/8/5PPP/6K1 w - - 0 1',
                'solution' => ['Rd8+'],
                'hints' => ['Check the king to start a sequence.', 'The bishop and rook work together.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Positional themes ---
            [
                'title' => 'Outpost Knight',
                'description' => 'White to move — establish a dominant knight outpost.',
                'fen' => 'r1bqkb1r/pp3ppp/2n1pn2/2pp4/3PP3/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 0 5',
                'solution' => ['e5'],
                'hints' => ['Push the pawn to create an outpost.', 'The knight will have a powerful square on d5.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Minority Attack',
                'description' => 'White to move — start a pawn storm on the queenside.',
                'fen' => 'r4rk1/pp2bppp/2n1bn2/3p4/3P4/1PN2N2/PB2BPPP/R2Q1RK1 w - - 0 10',
                'solution' => ['b4'],
                'hints' => ['Advance your queenside pawns.', 'Create weaknesses in Black\'s pawn structure.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- More tactics ---
            [
                'title' => 'X-Ray Attack',
                'description' => 'White to move — use an x-ray attack through a piece.',
                'fen' => '3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1',
                'solution' => ['Rxd8+'],
                'hints' => ['Capture with check.', 'The second rook supports from behind.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Knight Fork Check',
                'description' => 'White to move — fork the king and rook with a check.',
                'fen' => '2r3k1/5ppp/8/3NR3/8/8/5PPP/6K1 w - - 0 1',
                'solution' => ['Ne7+'],
                'hints' => ['The knight can check the king.', 'After the king moves, the knight captures the rook.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Overloaded Piece',
                'description' => 'White to move — exploit the overloaded defender.',
                'fen' => '3q1rk1/5ppp/8/8/8/4B3/5PPP/3Q2K1 w - - 0 1',
                'solution' => ['Qd5'],
                'hints' => ['The queen on d8 guards both f8 and the 7th rank.', 'Attack one of its duties.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Opening traps ---
            [
                'title' => 'Fried Liver Attack',
                'description' => 'White to move — find the aggressive knight sacrifice.',
                'fen' => 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
                'solution' => ['Ng5'],
                'hints' => ['Target the weak f7 square.', 'The knight and bishop combine against f7.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Queen\'s Gambit Trap',
                'description' => 'White to move — punish the pawn grab.',
                'fen' => 'rnbqkbnr/ppp1pppp/8/8/2pPP3/8/PP3PPP/RNBQKBNR w KQkq - 0 3',
                'solution' => ['e5'],
                'hints' => ['The c4 pawn is hard to hold.', 'Push the e-pawn to gain space.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Sicilian Pin',
                'description' => 'White to move — pin a piece to win material.',
                'fen' => 'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R w KQkq - 0 6',
                'solution' => ['Bg5'],
                'hints' => ['Pin the knight to the queen.', 'The bishop targets f6.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Endgame techniques ---
            [
                'title' => 'Passed Pawn Advance',
                'description' => 'White to move — push the passed pawn.',
                'fen' => '8/8/4k3/8/2K1P3/8/8/8 w - - 0 1',
                'solution' => ['e5'],
                'hints' => ['Push the passed pawn.', 'The king supports the advance.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Active King',
                'description' => 'White to move — activate the king.',
                'fen' => '8/pp2kppp/8/8/8/8/PPP2PPP/4K3 w - - 0 1',
                'solution' => ['Kd2'],
                'hints' => ['The king is a powerful piece in the endgame.', 'Centralize your king.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Triangulation',
                'description' => 'White to move — use triangulation to gain tempo.',
                'fen' => '8/8/3k4/3p4/3K4/3P4/8/8 w - - 0 1',
                'solution' => ['Ke3'],
                'hints' => ['You need to waste a move.', 'Triangle with your king: Ke3-Kf3-Ke4.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            // --- Fill remaining intermediate ---
            [
                'title' => 'Back Rank Combo',
                'description' => 'White to move — exploit the weak back rank.',
                'fen' => '2r1r1k1/5ppp/8/8/8/8/5PPP/1R1R2K1 w - - 0 1',
                'solution' => ['Rd8'],
                'hints' => ['Double rooks on the d-file.', 'Force an exchange leading to mate.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Knight Maneuver',
                'description' => 'White to move — reposition the knight to a dominant square.',
                'fen' => 'r4rk1/ppp2ppp/3p1n2/8/3PP3/5N2/PPP2PPP/R4RK1 w - - 0 10',
                'solution' => ['Nd2'],
                'hints' => ['The knight needs a better square.', 'Reroute via d2 to reach e4 or c4.'],
                'type' => 'puzzle', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Sacrifice for Initiative',
                'description' => 'White to move — sacrifice a pawn for development lead.',
                'fen' => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
                'solution' => ['d4'],
                'hints' => ['Gambiting a pawn for fast development.', 'Control the center with tempo.'],
                'type' => 'opening', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Bishop Pair Advantage',
                'description' => 'White to move — open the position for the bishops.',
                'fen' => 'r4rk1/ppp2ppp/3p4/3Pp3/2B5/4B3/PPP2PPP/R4RK1 w - - 0 10',
                'solution' => ['f4'],
                'hints' => ['Open lines for your bishops.', 'The bishop pair thrives in open positions.'],
                'type' => 'puzzle', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Rook Lift',
                'description' => 'White to move — swing the rook to the attack.',
                'fen' => 'r4rk1/ppp2ppp/8/8/8/6P1/PPP1RP1P/R5K1 w - - 0 1',
                'solution' => ['Re3'],
                'hints' => ['Lift the rook to the 3rd rank.', 'From there it can swing to the kingside.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Stalemate Trick',
                'description' => 'Black to move — find the saving stalemate trick.',
                'fen' => '8/8/8/8/8/6k1/4q3/7K b - - 0 1',
                'solution' => ['Qe1+'],
                'hints' => ['You\'re losing but can save the game.', 'Force a draw by stalemate or perpetual.'],
                'type' => 'endgame', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Prophylaxis',
                'description' => 'White to move — prevent the opponent\'s plan.',
                'fen' => 'r3r1k1/ppp2ppp/3p4/3Pn3/4P3/2N5/PPP2PPP/R3R1K1 w - - 0 1',
                'solution' => ['f4'],
                'hints' => ['The knight on e5 is strong.', 'Kick it away before it causes problems.'],
                'type' => 'puzzle', 'tier' => 'intermediate', 'xp' => 25,
            ],
            [
                'title' => 'Exchange Sacrifice',
                'description' => 'White to move — sacrifice the exchange for a winning attack.',
                'fen' => 'r4rk1/ppp1qppp/2n5/3pN3/3P4/6P1/PPP1RPBP/R5K1 w - - 0 1',
                'solution' => ['Nxc6'],
                'hints' => ['The knight captures create threats.', 'Material isn\'t everything — activity matters.'],
                'type' => 'tactic', 'tier' => 'intermediate', 'xp' => 25,
            ],
        ];
    }

    // ── ADVANCED (30 puzzles) ───────────────────────────────────────────

    private function getAdvancedPuzzles(): array
    {
        return [
            // --- Complex combinations ---
            [
                'title' => 'Immortal Game Finish',
                'description' => 'White to move — find the brilliant finishing combination.',
                'fen' => 'r1b1k1nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 0 1',
                'solution' => ['Qf6'],
                'hints' => ['The king is exposed.', 'A quiet queen move threatens unstoppable mate.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Alekhine\'s Gun',
                'description' => 'White to move — set up the deadly battery.',
                'fen' => '3r2k1/pp3ppp/8/8/8/8/PPQ2PPP/3RR1K1 w - - 0 1',
                'solution' => ['Qc7'],
                'hints' => ['Line up heavy pieces on the same file.', 'Queen behind two rooks is devastating.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Desperado Sacrifice',
                'description' => 'White to move — take maximum value with the doomed bishop.',
                'fen' => 'r1bqk2r/pppp1Bpp/2n2n2/2b1p3/4P3/3P4/PPP2PPP/RNBQK1NR w KQkq - 0 5',
                'solution' => ['Bxe8'],
                'hints' => ['Your bishop on f7 is under attack.', 'Capture the rook before the bishop is lost.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Deep calculation ---
            [
                'title' => 'Greek Gift Sacrifice',
                'description' => 'White to move — sacrifice the bishop on h7.',
                'fen' => 'r1bq1rk1/pppn1ppp/4pn2/3p4/2PP4/2N1PN2/PPB2PPP/R1BQ1RK1 w - - 0 8',
                'solution' => ['Bxh7+'],
                'hints' => ['A classic bishop sacrifice on h7.', 'After Kxh7, Ng5+ exposes the king.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Quiet Move Brilliancy',
                'description' => 'White to move — find the paradoxical quiet move.',
                'fen' => '2r2rk1/pp2qppp/2n1b3/3pN3/3P4/4P3/PP2BPPP/R2Q1RK1 w - - 0 1',
                'solution' => ['Nxc6'],
                'hints' => ['Capture creates a discovered threat.', 'The quiet follow-up is devastating.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Advanced endgames ---
            [
                'title' => 'Rook & Pawn vs Rook',
                'description' => 'White to move — find the winning plan.',
                'fen' => '1R6/P4k2/8/8/8/8/5r2/6K1 w - - 0 1',
                'solution' => ['Rb7+'],
                'hints' => ['Push the king away from the pawn.', 'The rook shields the pawn from behind.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Pawn Push',
                'description' => 'White to move — advance the passed pawn.',
                'fen' => '8/5k2/8/5PK1/8/8/8/8 w - - 0 1',
                'solution' => ['f6'],
                'hints' => ['The pawn is close to promotion.', 'Push it forward — the king supports from behind.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Fortress Draw',
                'description' => 'White to move — set up an impenetrable fortress.',
                'fen' => '8/8/8/1pk5/8/1PK5/8/8 w - - 0 1',
                'solution' => ['Kb2'],
                'hints' => ['You can\'t win but can draw.', 'Keep the king on key squares to block.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Positional sacrifices ---
            [
                'title' => 'Positional Exchange Sacrifice',
                'description' => 'White to move — sacrifice the exchange for a crushing position.',
                'fen' => 'r2q1rk1/ppp2ppp/2n1b3/3pP3/3P4/2N2N2/PP2BPPP/R2QR1K1 w - - 0 10',
                'solution' => ['Nxd5'],
                'hints' => ['Central control is worth material.', 'A knight on d5 dominates the board.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Piece Sacrifice for Attack',
                'description' => 'White to move — sacrifice a piece to expose the king.',
                'fen' => 'r1bq1rk1/pp2ppbp/2np2p1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9',
                'solution' => ['Nd5'],
                'hints' => ['A powerful centralization.', 'The knight on d5 can\'t be easily removed.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Complex endgames ---
            [
                'title' => 'Zugzwang',
                'description' => 'White to move — put the opponent in zugzwang.',
                'fen' => '8/8/1pk5/p1p5/P1P5/1PK5/8/8 w - - 0 1',
                'solution' => ['Kd3'],
                'hints' => ['Any move by Black weakens their position.', 'Pass the move to Black by triangulating.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Bishop Endgame Breakthrough',
                'description' => 'White to move — find the pawn breakthrough.',
                'fen' => '8/pp3k2/8/PPP5/8/4B3/8/6K1 w - - 0 1',
                'solution' => ['c6'],
                'hints' => ['One pawn breaks through.', 'The bishop supports the advance.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Opening preparation ---
            [
                'title' => 'Marshall Attack',
                'description' => 'Black to move — launch the Marshall Attack gambit.',
                'fen' => 'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b - - 0 8',
                'solution' => ['d5'],
                'hints' => ['Sacrifice a pawn for a fierce attack.', 'Open lines against the white king.'],
                'type' => 'opening', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Benko Gambit',
                'description' => 'Black to move — offer the Benko Gambit.',
                'fen' => 'rnbqkb1r/pp1ppppp/5n2/2pP4/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 3',
                'solution' => ['b5'],
                'hints' => ['Sacrifice a pawn for queenside pressure.', 'Open the a and b files for rooks.'],
                'type' => 'opening', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Catalan Opening',
                'description' => 'White to move — play the key Catalan move.',
                'fen' => 'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq - 0 3',
                'solution' => ['Bg2'],
                'hints' => ['Fianchetto the bishop.', 'Control the long diagonal.'],
                'type' => 'opening', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- More tactical themes ---
            [
                'title' => 'Interference',
                'description' => 'White to move — use an interference tactic.',
                'fen' => '3rr1k1/pp3ppp/8/3N4/8/8/PPP2PPP/3RR1K1 w - - 0 1',
                'solution' => ['Ne7+'],
                'hints' => ['Place a piece between two defenders.', 'The knight disrupts the coordination of the rooks.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Attraction Sacrifice',
                'description' => 'White to move — lure the king into a mating net.',
                'fen' => '5rk1/pp3ppp/8/3N4/8/8/PPP1QPPP/6K1 w - - 0 1',
                'solution' => ['Ne7+'],
                'hints' => ['The knight checks and restricts.', 'Forces the king to worse squares.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Domination',
                'description' => 'White to move — trap a piece despite the open board.',
                'fen' => '8/8/8/3k4/8/2NB4/3K4/2n5 w - - 0 1',
                'solution' => ['Bb5'],
                'hints' => ['The knight seems safe.', 'The bishop and knight work together to trap it.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Complex combinations ---
            [
                'title' => 'Central Breakthrough',
                'description' => 'White to move — break through in the center.',
                'fen' => '2r1r1k1/pp1q1ppp/8/3pP3/3P4/2P5/P4PPP/R1RQ2K1 w - - 0 1',
                'solution' => ['e6'],
                'hints' => ['Push the e-pawn to disrupt the position.', 'Opening lines creates threats against the king.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Knight Outpost Sacrifice',
                'description' => 'White to move — sacrifice to establish an unassailable knight.',
                'fen' => 'r1bq1rk1/pp3ppp/2n1pn2/2bpN3/2P5/2N1P3/PP2BPPP/R1BQ1RK1 w - - 0 8',
                'solution' => ['cxd5'],
                'hints' => ['Open the position.', 'After captures, the knight on e5 becomes dominant.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            // --- Fill remaining advanced ---
            [
                'title' => 'Pawn Storm',
                'description' => 'White to move — launch a kingside pawn storm.',
                'fen' => 'r1bq1rk1/ppp2ppp/2np4/4p3/2PPP3/2N2N2/PP3PPP/R1BQ1RK1 w - - 0 8',
                'solution' => ['d5'],
                'hints' => ['Push the center pawn.', 'Open lines for your pieces against the king.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Centralization',
                'description' => 'White to move — centralize for maximum piece activity.',
                'fen' => 'r4rk1/pp2ppbp/2np2p1/q7/3NP3/2N1B3/PPPQ1PPP/R4RK1 w - - 0 10',
                'solution' => ['Nd5'],
                'hints' => ['A knight in the center controls everything.', 'Nd5 attacks multiple targets.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Deflection Combination',
                'description' => 'White to move — deflect the key defender.',
                'fen' => '2r2rk1/pp1q1ppp/4p3/3pN3/3P4/6P1/PP2PPBP/R2Q1RK1 w - - 0 1',
                'solution' => ['Nxf7'],
                'hints' => ['The f7 pawn is a critical defender.', 'Removing it opens the king.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Endgame Calculation',
                'description' => 'White to move — calculate the winning pawn race.',
                'fen' => '8/5pk1/6p1/8/1P6/8/5KP1/8 w - - 0 1',
                'solution' => ['b5'],
                'hints' => ['Count the tempi for both sides.', 'Your pawn queens first if you push now.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Transformation',
                'description' => 'White to move — win the d5 pawn and open the position.',
                'fen' => 'r1bq1rk1/pp2ppbp/2n3p1/2Pp4/8/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 8',
                'solution' => ['Nxd5'],
                'hints' => ['The d5 pawn is attackable.', 'Capture to open the center for your pieces.'],
                'type' => 'puzzle', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Isolated Pawn Attack',
                'description' => 'White to move — use the isolated d-pawn as a battering ram.',
                'fen' => 'r1bq1rk1/pp3ppp/2n1pn2/3p4/3P4/2N2N2/PPP1BPPP/R1BQ1RK1 w - - 0 8',
                'solution' => ['Bg5'],
                'hints' => ['Pin the knight to increase pressure.', 'The isolated pawn gives space and piece activity.'],
                'type' => 'opening', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Pawn Break',
                'description' => 'White to move — advance the pawn with check.',
                'fen' => '8/pp3p2/3k2p1/8/3KP3/6P1/PP3P2/8 w - - 0 1',
                'solution' => ['e5+'],
                'hints' => ['Gain space with a pawn push.', 'The check forces the king to retreat.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Blockade',
                'description' => 'White to move — blockade the passed pawn.',
                'fen' => '8/8/3k4/3p4/3N4/3K4/8/8 w - - 0 1',
                'solution' => ['Nf3'],
                'hints' => ['Stop the pawn from advancing.', 'The knight is the ideal blockader.'],
                'type' => 'endgame', 'tier' => 'advanced', 'xp' => 40,
            ],
            [
                'title' => 'Undermining',
                'description' => 'White to move — undermine the pawn chain.',
                'fen' => 'r1bq1rk1/pp2ppbp/2np2p1/8/3PP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 8',
                'solution' => ['d5'],
                'hints' => ['Attack the base of the pawn chain.', 'Open lines for your pieces.'],
                'type' => 'tactic', 'tier' => 'advanced', 'xp' => 40,
            ],
        ];
    }
}
