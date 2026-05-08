<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $sets = [
            [
                'slug' => 'newcomer-foundations',
                'title' => 'Newcomer Foundations',
                'description' => 'Rules, mate patterns, promotion habits, and first-game confidence.',
                'skill_band' => 'newcomer',
                'required_tier' => 'free',
                'theme' => 'Foundations',
                'sort_order' => 10,
            ],
            [
                'slug' => 'beginner-tactical-safety',
                'title' => 'Beginner Tactical Safety',
                'description' => 'Basic threats, back-rank patterns, and endgame habits.',
                'skill_band' => 'beginner',
                'required_tier' => 'free',
                'theme' => 'Tactics',
                'sort_order' => 20,
            ],
            [
                'slug' => 'improving-beginner-calculation',
                'title' => 'Improving Beginner Calculation',
                'description' => 'Forcing moves, forks, and simple calculation discipline.',
                'skill_band' => 'improving-beginner',
                'required_tier' => 'silver',
                'theme' => 'Calculation',
                'sort_order' => 30,
            ],
            [
                'slug' => 'club-player-conversion',
                'title' => 'Club Player Conversion',
                'description' => 'Practical decisions for converting small advantages.',
                'skill_band' => 'club-player',
                'required_tier' => 'silver',
                'theme' => 'Conversion',
                'sort_order' => 40,
            ],
            [
                'slug' => 'advanced-forcing-lines',
                'title' => 'Advanced Forcing Lines',
                'description' => 'Candidate moves, forcing order, and deeper defensive questions.',
                'skill_band' => 'advanced',
                'required_tier' => 'gold',
                'theme' => 'Calculation',
                'sort_order' => 50,
            ],
            [
                'slug' => 'competitive-preparation',
                'title' => 'Competitive Preparation',
                'description' => 'Tournament-style precision, conversion, and review habits.',
                'skill_band' => 'competitive',
                'required_tier' => 'gold',
                'theme' => 'Preparation',
                'sort_order' => 60,
            ],
        ];

        foreach ($sets as $set) {
            DB::table('training_drill_sets')->updateOrInsert(
                ['slug' => $set['slug']],
                array_merge($set, [
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }

        $setIds = DB::table('training_drill_sets')
            ->whereIn('slug', array_column($sets, 'slug'))
            ->pluck('id', 'slug');

        $drills = [
            [
                'set_slug' => 'newcomer-foundations',
                'slug' => 'queen-support-mate',
                'title' => 'Supported Queen Mate',
                'description' => 'Finish a mate in one by using queen and king coordination.',
                'skill_band' => 'newcomer',
                'required_tier' => 'free',
                'drill_type' => 'pattern',
                'theme' => 'Checkmate',
                'subtheme' => 'Queen support',
                'position_fen' => '4k3/7Q/4K3/8/8/8/8/8 w - - 0 1',
                'solution' => ['h7e7'],
                'hints' => ['Find checks first.', 'Keep the queen protected by the king.'],
                'thinking_steps' => ['Find every check.', 'Count escape squares.', 'Confirm the queen is protected.'],
                'explanation' => 'Qe7# works because the queen gives check and the king supports the mating square.',
                'time_target_seconds' => 45,
                'sort_order' => 10,
            ],
            [
                'set_slug' => 'newcomer-foundations',
                'slug' => 'promotion-check',
                'title' => 'Promote With Check',
                'description' => 'Convert an advanced pawn into a queen with check.',
                'skill_band' => 'newcomer',
                'required_tier' => 'free',
                'drill_type' => 'habit',
                'theme' => 'Promotion',
                'subtheme' => 'Queen promotion',
                'position_fen' => '7k/6P1/5K2/8/8/8/8/8 w - - 0 1',
                'solution' => ['g7g8=q'],
                'accepted_alternatives' => [['g7g8=Q'], ['g8=Q']],
                'hints' => ['The pawn has reached the seventh rank.', 'Choose the strongest promotion piece.'],
                'thinking_steps' => ['Look for forcing moves.', 'Promote before the king can approach.', 'Prefer a queen unless there is a special reason not to.'],
                'explanation' => 'Promoting to a queen gives White a decisive material and checking advantage.',
                'time_target_seconds' => 45,
                'sort_order' => 20,
            ],
            [
                'set_slug' => 'beginner-tactical-safety',
                'slug' => 'opposition-step',
                'title' => 'Take the Opposition',
                'description' => 'Use the king actively before pushing the pawn.',
                'skill_band' => 'beginner',
                'required_tier' => 'free',
                'drill_type' => 'endgame',
                'theme' => 'King and pawn endings',
                'subtheme' => 'Opposition',
                'position_fen' => '4k3/8/8/3P4/3K4/8/8/8 w - - 0 1',
                'solution' => ['d4e5'],
                'accepted_alternatives' => [['Ke5']],
                'hints' => ['The king should lead the pawn.', 'Step toward the key squares.'],
                'thinking_steps' => ['Improve the king first.', 'Keep the pawn protected.', 'Force the defender backward.'],
                'explanation' => 'Ke5 takes key space and helps the pawn advance safely.',
                'time_target_seconds' => 60,
                'sort_order' => 30,
            ],
            [
                'set_slug' => 'beginner-tactical-safety',
                'slug' => 'back-rank-mate',
                'title' => 'Back Rank Mate',
                'description' => 'Use the trapped king and blocked escape squares.',
                'skill_band' => 'beginner',
                'required_tier' => 'free',
                'drill_type' => 'pattern',
                'theme' => 'Back rank',
                'subtheme' => 'Rook mate',
                'position_fen' => '6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1',
                'solution' => ['f1f8'],
                'accepted_alternatives' => [['Rf8']],
                'hints' => ['The black pawns block the king.', 'A rook check on the back rank is decisive.'],
                'thinking_steps' => ['Find checks.', 'Count escape squares.', 'Use the rook on the open file.'],
                'explanation' => 'Rf8# is mate because the king has no escape square on the back rank.',
                'time_target_seconds' => 45,
                'sort_order' => 40,
            ],
            [
                'set_slug' => 'improving-beginner-calculation',
                'slug' => 'knight-fork-king-rook',
                'title' => 'Knight Fork',
                'description' => 'Move the knight with check and attack a loose rook.',
                'skill_band' => 'improving-beginner',
                'required_tier' => 'silver',
                'drill_type' => 'calculation',
                'theme' => 'Forks',
                'subtheme' => 'Knight fork',
                'position_fen' => '8/4k3/8/8/3N3r/8/8/4K3 w - - 0 1',
                'solution' => ['d4f5'],
                'accepted_alternatives' => [['Nf5']],
                'hints' => ['Look for a knight check.', 'The rook on h4 is also vulnerable.'],
                'thinking_steps' => ['Start with checks.', 'Check what the knight attacks after moving.', 'Prefer moves that gain time.'],
                'explanation' => 'Nf5+ forks the king and rook, so White wins material after the king moves.',
                'time_target_seconds' => 75,
                'sort_order' => 50,
            ],
            [
                'set_slug' => 'club-player-conversion',
                'slug' => 'rook-opposition-conversion',
                'title' => 'Activate the Rook',
                'description' => 'Put the rook behind the passer before the king can blockade.',
                'skill_band' => 'club-player',
                'required_tier' => 'silver',
                'drill_type' => 'endgame',
                'theme' => 'Rook endings',
                'subtheme' => 'Passed pawn support',
                'position_fen' => '8/4k3/8/3P4/8/8/4K3/R7 w - - 0 1',
                'solution' => ['a1d1'],
                'accepted_alternatives' => [['Rd1']],
                'hints' => ['The passed pawn needs support from behind.', 'Rook activity matters more than checking once.'],
                'thinking_steps' => ['Identify the passed pawn.', 'Put the rook where it supports promotion.', 'Make the defender passive.'],
                'explanation' => 'Rd1 supports the passer from behind and makes Black defend passively.',
                'time_target_seconds' => 90,
                'sort_order' => 60,
            ],
            [
                'set_slug' => 'advanced-forcing-lines',
                'slug' => 'candidate-move-discipline',
                'title' => 'Forcing Candidate',
                'description' => 'Choose the forcing move before settling for a quiet improvement.',
                'skill_band' => 'advanced',
                'required_tier' => 'gold',
                'drill_type' => 'calculation',
                'theme' => 'Candidate moves',
                'subtheme' => 'Forcing checks',
                'position_fen' => '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
                'solution' => ['e1e8'],
                'accepted_alternatives' => [['Re8']],
                'hints' => ['A check changes the move order.', 'The back rank is weak.'],
                'thinking_steps' => ['List checks.', 'Compare the opponent replies.', 'Choose the forcing continuation.'],
                'explanation' => 'Re8+ uses the back-rank weakness immediately and keeps Black under forcing pressure.',
                'time_target_seconds' => 90,
                'sort_order' => 70,
            ],
            [
                'set_slug' => 'competitive-preparation',
                'slug' => 'competitive-prep-pattern',
                'title' => 'Convert With Check',
                'description' => 'Keep the initiative while improving the rook.',
                'skill_band' => 'competitive',
                'required_tier' => 'gold',
                'drill_type' => 'review',
                'theme' => 'Conversion',
                'subtheme' => 'Forcing conversion',
                'position_fen' => '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
                'solution' => ['d1d8'],
                'accepted_alternatives' => [['Rd8']],
                'hints' => ['Checks reduce calculation noise.', 'The defender has few king squares.'],
                'thinking_steps' => ['Find the forcing move.', 'Verify the back-rank pattern.', 'Keep the rook active after the check.'],
                'explanation' => 'Rd8+ keeps the initiative and forces the defender to respond to the back-rank threat.',
                'time_target_seconds' => 90,
                'sort_order' => 80,
            ],
        ];

        foreach ($drills as $drill) {
            $setSlug = $drill['set_slug'];
            unset($drill['set_slug']);

            DB::table('training_drills')->updateOrInsert(
                ['slug' => $drill['slug']],
                array_merge($drill, [
                    'drill_set_id' => $setIds[$setSlug] ?? null,
                    'solution' => json_encode($drill['solution']),
                    'accepted_alternatives' => isset($drill['accepted_alternatives'])
                        ? json_encode($drill['accepted_alternatives'])
                        : null,
                    'hints' => json_encode($drill['hints']),
                    'thinking_steps' => json_encode($drill['thinking_steps']),
                    'mastery_threshold' => 3,
                    'source' => 'Chess99 foundational curriculum',
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }

    public function down(): void
    {
        DB::table('training_drills')->whereIn('slug', [
            'queen-support-mate',
            'promotion-check',
            'opposition-step',
            'back-rank-mate',
            'knight-fork-king-rook',
            'rook-opposition-conversion',
            'candidate-move-discipline',
            'competitive-prep-pattern',
        ])->delete();

        DB::table('training_drill_sets')->whereIn('slug', [
            'newcomer-foundations',
            'beginner-tactical-safety',
            'improving-beginner-calculation',
            'club-player-conversion',
            'advanced-forcing-lines',
            'competitive-preparation',
        ])->delete();
    }
};
