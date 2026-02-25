<?php

namespace Database\Seeders\Tutorial;

use App\Models\TutorialModule;

class AdvancedModuleSeeder
{
    /**
     * Seed 5 advanced modules (GOLD tier), 25 lessons total.
     * Modules 12-16 chain: Advanced Tactics -> Strategic Mastery -> Advanced Openings
     *   -> Advanced Endgames -> Master Preparation.
     */
    public function run(): void
    {
        $m12 = $this->seedAdvancedTactics();
        $m13 = $this->seedStrategicMastery($m12);
        $m14 = $this->seedAdvancedOpenings($m13);
        $m15 = $this->seedAdvancedEndgames($m14);
        $this->seedMasterPreparation($m15);
    }

    // ──────────────────────────────────────────────
    // Module 12 — Advanced Tactics (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedAdvancedTactics(): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Advanced Tactics',
            'slug' => 'advanced-tactics',
            'skill_tier' => 'advanced',
            'required_tier' => 'gold',
            'description' => 'Master complex combinations, tactical chains, positional sacrifices, and prophylactic thinking.',
            'icon' => "\u{1F5E1}\u{FE0F}",
            'sort_order' => 12,
            'estimated_duration_minutes' => 70,
        ]);

        // Lesson 1 — Complex Combinations
        $module->lessons()->create([
            'title' => 'Complex Combinations',
            'slug' => 'complex-combinations',
            'lesson_type' => 'theory',
            'difficulty_rating' => 7,
            'sort_order' => 1,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 100,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Multi-Move Combinations',
                        'content' => '<p>A <strong>complex combination</strong> is a forced sequence of moves — often involving sacrifices — that leads to a concrete advantage. Unlike simple tactics (one or two moves), advanced combinations can stretch <strong>four to eight moves deep</strong>, requiring precise calculation at every step.</p><p>The key skill is <strong>visualization</strong>: seeing the resulting position clearly in your mind before committing to the first move.</p>',
                    ],
                    [
                        'title' => 'Deflection & Decoy',
                        'content' => '<p><strong>Deflection</strong> forces a defender away from a critical square or duty. <strong>Decoy</strong> lures an enemy piece to a vulnerable square. Both ideas often appear together in master-level combinations.</p><p>In this classic position, White plays <strong>Qxd7+!</strong> to deflect the knight from guarding f6, followed by Nf6+ with a devastating discovered attack on the queen.</p>',
                        'diagram' => 'r1b2rk1/ppqn1ppp/2pbpn2/8/3P4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 1',
                        'highlights' => ['c2', 'd7', 'f6'],
                    ],
                    [
                        'title' => 'Clearance Sacrifice',
                        'content' => '<p>A <strong>clearance sacrifice</strong> removes one of your own pieces from a square so that another piece can use it more effectively. This selfless concept is central to deep combinations.</p><p>Consider the famous Tal–Miller 1958 position. White sacrifices the rook on e6 to clear the way for the knight to reach f5 with devastating effect, opening lines against the Black king.</p>',
                        'diagram' => 'r4rk1/pp1bqppp/2n1p3/3pN3/3Pn3/2N1P3/PP1QBPPP/R4RK1 w - - 0 1',
                        'highlights' => ['e5', 'e6'],
                    ],
                    [
                        'title' => 'The Windmill',
                        'content' => '<p>A <strong>windmill</strong> (or "see-saw") is a spectacular combination where discovered checks alternate with regular checks, allowing one piece to sweep across the board capturing material with each rotation.</p><p>The most famous example is <strong>Torre–Lasker 1925</strong>: after Bf6! Qxh5, Rxg7+ Kh8, Rxf7+ Kg8, Rg7+ Kh8, Rxb7+ and so on — White\'s rook harvests almost every Black piece.</p>',
                        'diagram' => '2rr2k1/pp1bqpp1/5n1p/4B3/8/1BP5/PP3PPP/2KR3R w - - 0 1',
                        'highlights' => ['e5', 'f6', 'g7'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of complex combinations.</p>',
                        'quiz' => [
                            'question' => 'What is a "clearance sacrifice"?',
                            'options' => ['Sacrificing a piece to open a file', 'Removing your own piece from a square so another can use it', 'Exchanging queens to reach an endgame', 'Giving check to gain a tempo'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Tactical Chains
        $module->lessons()->create([
            'title' => 'Tactical Chains',
            'slug' => 'tactical-chains',
            'lesson_type' => 'theory',
            'difficulty_rating' => 7,
            'sort_order' => 2,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 100,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Combining Tactical Motifs',
                        'content' => '<p>In advanced play, tactics rarely appear in isolation. A <strong>tactical chain</strong> weaves together multiple motifs — pin then fork, deflection then back-rank mate, decoy then skewer — into one continuous sequence.</p><p>The skill is recognizing which <strong>first link</strong> in the chain creates the conditions for the second, and so on. Each tactic sets up the next.</p>',
                    ],
                    [
                        'title' => 'Pin-then-Fork Chains',
                        'content' => '<p>One of the most common chains: first <strong>pin</strong> a piece to restrict the opponent\'s options, then follow up with a <strong>fork</strong> that the pinned piece cannot defend against.</p><p>In this position, White plays Bg5! pinning the knight on f6 to the queen on d8. After ...h6, White has Bxf6 Qxf6, and now Ne4 forks the queen and the bishop on c5.</p>',
                        'diagram' => 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
                        'highlights' => ['g5', 'f6', 'd8'],
                    ],
                    [
                        'title' => 'Deflection into Back-Rank',
                        'content' => '<p>Another devastating chain: <strong>deflect</strong> the key defender, then exploit the weakened back rank. This pattern appears frequently in games between strong players.</p><p>Here White deflects the rook from the back rank with Qb8+! Rxb8, and then Re8+ Rxe8, Rxe8# — a clean back-rank mate after the deflection removed the guardian.</p>',
                        'diagram' => '1r3rk1/5ppp/8/8/4Q3/8/5PPP/2R1R1K1 w - - 0 1',
                        'highlights' => ['e4', 'b8', 'e1', 'e8'],
                    ],
                    [
                        'title' => 'Counting Forcing Moves',
                        'content' => '<p>When calculating a tactical chain, always consider <strong>forcing moves</strong> first: checks, captures, and threats (in that order). This "CCT" method organizes your calculation and ensures you do not miss the strongest continuation.</p><p>At each step ask: "What checks do I have? What captures? What threats?" This systematic approach prevents overlooking key moves in long sequences.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of tactical chains.</p>',
                        'quiz' => [
                            'question' => 'What is the recommended order for considering forcing moves?',
                            'options' => ['Threats, captures, checks', 'Captures, checks, threats', 'Checks, captures, threats', 'Threats, checks, captures'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Positional Sacrifices
        $module->lessons()->create([
            'title' => 'Positional Sacrifices',
            'slug' => 'positional-sacrifices',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 3,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Sacrifice Without Forced Mate',
                        'content' => '<p>A <strong>positional sacrifice</strong> gives up material not for a forced checkmate or concrete win-back, but for long-term positional compensation: superior piece activity, a dominant outpost, a crushing pawn structure, or a lasting initiative.</p><p>This is one of the hardest concepts in chess — you must <strong>evaluate intangibles</strong> accurately to know whether the compensation is sufficient.</p>',
                    ],
                    [
                        'title' => 'The Exchange Sacrifice',
                        'content' => '<p>Giving up a rook for a minor piece (the "exchange") is the most common positional sacrifice. Typical compensation includes:</p><ul><li>A <strong>dominant knight</strong> on a central outpost</li><li><strong>Dark-square control</strong> with a bishop vs weakened pawns</li><li>A strong <strong>passed pawn</strong> supported by pieces</li></ul><p>Petrosian was the greatest master of the exchange sacrifice, using it as a <strong>prophylactic weapon</strong> to prevent opponent counterplay.</p>',
                        'diagram' => 'r1b2rk1/pp3ppp/2p1pn2/3p4/1b1P4/2NBP3/PP3PPP/R1BQ1RK1 w - - 0 1',
                        'highlights' => ['c3', 'd4'],
                    ],
                    [
                        'title' => 'The Greek Gift Sacrifice',
                        'content' => '<p>The <strong>Greek Gift</strong> (Bxh7+) is a classic bishop sacrifice against the castled king. After Bxh7+ Kxh7, Ng5+ Kg8 (or Kg6), Qh5 creates a powerful attack. The sacrifice works when:</p><ul><li>The bishop is protected (usually by a pawn on e4 or piece on d3)</li><li>A knight can reach g5 with check</li><li>The queen can join the attack quickly via h5</li><li>Black\'s f6 square is not well defended</li></ul>',
                        'diagram' => 'r1bq1rk1/pppnnppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 0 1',
                        'highlights' => ['d3', 'h7'],
                    ],
                    [
                        'title' => 'Evaluating Compensation',
                        'content' => '<p>When assessing a positional sacrifice, check these factors:</p><ul><li><strong>Piece activity</strong>: Are your remaining pieces significantly more active?</li><li><strong>King safety</strong>: Is the opponent\'s king exposed?</li><li><strong>Pawn structure</strong>: Do you have connected passed pawns or a structural advantage?</li><li><strong>Initiative</strong>: Can the opponent untangle, or are they permanently passive?</li></ul><p>If three or more factors favor you, the sacrifice is likely sound.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of positional sacrifices.</p>',
                        'quiz' => [
                            'question' => 'Which former World Champion was the greatest master of the exchange sacrifice?',
                            'options' => ['Fischer', 'Kasparov', 'Petrosian', 'Carlsen'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Prophylaxis
        $module->lessons()->create([
            'title' => 'Prophylaxis',
            'slug' => 'prophylaxis',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 4,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Thinking for Your Opponent',
                        'content' => '<p><strong>Prophylaxis</strong> is the art of preventing your opponent\'s plans before they can execute them. Instead of only thinking about what <em>you</em> want to do, you ask: "What does my opponent want to do?" — and then you stop it.</p><p>Nimzowitsch coined the term and considered it one of the most important positional concepts. Karpov and Petrosian elevated it to an art form.</p>',
                    ],
                    [
                        'title' => 'Prophylactic Moves',
                        'content' => '<p>Common prophylactic moves include:</p><ul><li><strong>h3/h6</strong>: Preventing Bg5/Bg4 pins or Ng5/Ng4 intrusions</li><li><strong>a3/a6</strong>: Preventing Nb5/Nb4 (or Bb5/Bb4) jumps</li><li><strong>Kh1/Kh8</strong>: Removing the king from potential pins along the a2-g8 (or a7-g1) diagonal</li><li><strong>Prophylactic piece moves</strong>: Repositioning to cover a weakness before it is attacked</li></ul>',
                        'diagram' => 'r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2N1PN2/PPB2PPP/R1BQ1RK1 w - - 0 8',
                    ],
                    [
                        'title' => 'Restraint and Overprotection',
                        'content' => '<p>Nimzowitsch\'s concept of <strong>overprotection</strong> means defending key central points with more pieces than strictly necessary. By overprotecting e4 or d5, you maintain a flexible position where your pieces serve dual purposes — defending and being ready to attack.</p><p><strong>Restraint</strong> means preventing your opponent\'s freeing pawn breaks. If Black wants to play ...e5, you take measures to make that move impossible or disadvantageous.</p>',
                    ],
                    [
                        'title' => 'The Karpov Method',
                        'content' => '<p>Karpov\'s prophylactic style demonstrates the concept perfectly. He would:</p><ol><li><strong>Improve</strong> his own pieces to optimal squares</li><li><strong>Restrict</strong> his opponent\'s active possibilities</li><li><strong>Wait</strong> for the opponent to weaken themselves trying to create counterplay</li><li><strong>Strike</strong> only when the position was ripe</li></ol><p>This "boa constrictor" approach wins by gradually squeezing all life from the opponent\'s position.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of prophylactic thinking.</p>',
                        'quiz' => [
                            'question' => 'What is the fundamental question in prophylactic thinking?',
                            'options' => ['What is my best attacking move?', 'What does my opponent want to do?', 'How can I simplify the position?', 'Which piece should I develop next?'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Advanced Test (puzzle)
        $module->lessons()->create([
            'title' => 'Advanced Test',
            'slug' => 'advanced-tactics-test',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 8,
            'sort_order' => 5,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 150,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'r1b2rk1/2q2ppp/p1p1pn2/2Pp4/1P1P4/P1N1PN2/5PPP/R1BQ1RK1 w - - 0 1',
                        'solution' => ['Bxh7+', 'Kxh7', 'Ng5+'],
                        'hints' => ['The classic Greek Gift sacrifice pattern is available.', 'After Bxh7+ Kxh7, a knight check continues the attack.'],
                    ],
                    [
                        'fen' => '2r1r1k1/pp1q1ppp/3b1n2/3p4/8/2NB1Q2/PPP2PPP/3RR1K1 w - - 0 1',
                        'solution' => ['Bxh7+', 'Nxh7', 'Rxd5'],
                        'hints' => ['Deflect the knight from defending d5.', 'After the bishop sacrifice, the d5 pawn is unprotected.'],
                    ],
                    [
                        'fen' => 'r4rk1/pp2qppp/2nbpn2/8/2BN4/2N1P3/PP3PPP/R2Q1RK1 w - - 0 1',
                        'solution' => ['Nxe6', 'fxe6', 'Bxe6+'],
                        'hints' => ['The e6 pawn is a structural weakness.', 'A knight sacrifice on e6 opens the king\'s position.'],
                    ],
                    [
                        'fen' => '1r3rk1/5ppp/p1p1pn2/2Pp4/1P6/P2BPN2/5PPP/R4RK1 w - - 0 1',
                        'solution' => ['Bxh7+', 'Kxh7', 'Ng5+', 'Kg8', 'Qh5'],
                        'hints' => ['The Greek Gift conditions are all met: bishop on d3, knight ready for g5, queen can reach h5.', 'Calculate the full sequence: sacrifice, knight check, queen entry.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 13 — Strategic Mastery (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedStrategicMastery(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Strategic Mastery',
            'slug' => 'strategic-mastery',
            'skill_tier' => 'advanced',
            'required_tier' => 'gold',
            'description' => 'Deepen your positional understanding with minority attacks, pawn breaks, space advantage, and the balance between dynamic and static factors.',
            'icon' => "\u{1F3AF}",
            'sort_order' => 13,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 70,
        ]);

        // Lesson 1 — Minority Attack
        $module->lessons()->create([
            'title' => 'Minority Attack',
            'slug' => 'minority-attack',
            'lesson_type' => 'theory',
            'difficulty_rating' => 7,
            'sort_order' => 1,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 100,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is a Minority Attack?',
                        'content' => '<p>A <strong>minority attack</strong> is a pawn advance on the wing where you have <strong>fewer pawns</strong> than your opponent. The goal is to create weaknesses in the opponent\'s pawn structure by forcing exchanges that leave behind isolated or backward pawns.</p><p>The classic example arises in the Queen\'s Gambit Declined Exchange Variation: White advances b4-b5 with only two queenside pawns (a2, b2) against Black\'s three (a7, b7, c6).</p>',
                        'diagram' => 'r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R w KQ - 0 1',
                        'highlights' => ['b2', 'a7', 'b7', 'c6'],
                    ],
                    [
                        'title' => 'The Mechanism',
                        'content' => '<p>The minority attack works in stages:</p><ol><li><strong>Advance b4-b5</strong>: Challenge the c6 pawn</li><li><strong>Exchange bxc6</strong>: After ...bxc6, Black has an isolated c-pawn; after ...Nxc6/dxc6, the pawn structure is weakened</li><li><strong>Target the weakness</strong>: Apply pressure with rooks on the c-file and pieces aimed at the weak pawn</li></ol><p>Black must decide which recapture is least damaging, but both options leave structural problems.</p>',
                    ],
                    [
                        'title' => 'Strategic Goals After the Attack',
                        'content' => '<p>After the minority attack succeeds, White typically has:</p><ul><li>A <strong>target pawn</strong> (isolated c-pawn or backward b-pawn) to press against</li><li><strong>Open or semi-open files</strong> for rook pressure</li><li>Long-term positional pressure in the endgame</li></ul><p>Meanwhile, Black should seek <strong>kingside counterplay</strong> with ...f5 or piece attacks to balance White\'s queenside pressure. The game becomes a race between plans on opposite wings.</p>',
                    ],
                    [
                        'title' => 'Defense Against the Minority Attack',
                        'content' => '<p>Black has several ways to counter the minority attack:</p><ul><li><strong>...a5</strong>: Prevents b5 (but weakens b5 square for White\'s pieces)</li><li><strong>...c5</strong>: Strike in the center before the attack arrives</li><li><strong>Kingside play</strong>: Start a counterattack (e.g., ...Ne4, ...f5) to divert White\'s attention</li><li><strong>...b5!?</strong>: A bold counter-advance to keep the structure solid</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of the minority attack.</p>',
                        'quiz' => [
                            'question' => 'What is the main goal of a minority attack?',
                            'options' => ['To promote a passed pawn', 'To create weaknesses in the opponent\'s pawn structure', 'To checkmate the king on the wing', 'To exchange all pieces'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Pawn Breaks
        $module->lessons()->create([
            'title' => 'Pawn Breaks',
            'slug' => 'pawn-breaks',
            'lesson_type' => 'theory',
            'difficulty_rating' => 7,
            'sort_order' => 2,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 100,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Understanding Pawn Breaks',
                        'content' => '<p>A <strong>pawn break</strong> is a pawn advance that challenges the opponent\'s pawn chain, opening lines and changing the structure. Correct timing of pawn breaks is one of the most important strategic skills — too early wastes the potential, too late allows the opponent to consolidate.</p><p>Every pawn structure has characteristic breaks. Learning them gives you a <strong>roadmap for the middlegame</strong>.</p>',
                    ],
                    [
                        'title' => 'Central Pawn Breaks',
                        'content' => '<p>The most powerful breaks strike at the center:</p><ul><li><strong>...d5 against e4</strong>: The primary break in many Sicilian and French positions</li><li><strong>...e5 against d4</strong>: The freeing break in the Queen\'s Gambit and King\'s Indian</li><li><strong>c4-c5 or ...c5</strong>: Attacks the d-pawn chain and opens the c-file</li><li><strong>f2-f4 or ...f5</strong>: The aggressive break, often preparing a kingside attack</li></ul>',
                        'diagram' => 'rnbqkb1r/pp2pppp/5n2/2pp4/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 4',
                        'highlights' => ['d5', 'e4'],
                    ],
                    [
                        'title' => 'Preparing the Break',
                        'content' => '<p>A pawn break should not be played randomly. Preparation involves:</p><ul><li><strong>Piece support</strong>: Place pieces to support the break and exploit the opening lines</li><li><strong>Timing</strong>: Wait until the opponent is committed and cannot prevent the break effectively</li><li><strong>Calculation</strong>: Verify the resulting position is favorable — check for tactics</li></ul><p>In the King\'s Indian, Black prepares ...f5 by placing pieces on ideal squares first (Nf6-d7, Rf8, Be7-f6), then strikes when the time is right.</p>',
                    ],
                    [
                        'title' => 'The Lever Principle',
                        'content' => '<p>Nimzowitsch\'s <strong>lever</strong> concept teaches that every pawn chain has a base — and the most effective break targets the <strong>base of the chain</strong>. For example, if White has pawns on e4-d5, Black should attack with ...c6 (targeting d5, the front) or ...f5 (targeting e4, the base). Attacking the base is usually more effective because it undermines the entire structure.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of pawn breaks.</p>',
                        'quiz' => [
                            'question' => 'According to Nimzowitsch, which part of a pawn chain should you target with a break?',
                            'options' => ['The front pawn', 'The middle pawn', 'The base of the chain', 'Any pawn in the chain'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Space Advantage
        $module->lessons()->create([
            'title' => 'Space Advantage',
            'slug' => 'space-advantage',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 3,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is Space Advantage?',
                        'content' => '<p><strong>Space advantage</strong> means your pawns are advanced further, giving your pieces more room to maneuver while cramping the opponent\'s pieces. A player with more space can <strong>transfer pieces between flanks more easily</strong> and has more options for regrouping.</p><p>Space advantage is measured by how far advanced your pawn chain extends into the opponent\'s half of the board.</p>',
                    ],
                    [
                        'title' => 'Using a Space Advantage',
                        'content' => '<p>When you have more space:</p><ul><li><strong>Avoid unnecessary exchanges</strong> — more pieces benefit the side with more room</li><li><strong>Maneuver on both flanks</strong> — your pieces can relocate faster</li><li><strong>Restrict the opponent\'s breaks</strong> — prophylactically prevent the freeing moves that would relieve the cramp</li><li><strong>Open lines when ready</strong> — use your space to build up pressure, then break through</li></ul>',
                        'diagram' => 'r1b2rk1/pp2bppp/2n1pn2/3pP3/3P1P2/2N2N2/PPP3PP/R1BQKB1R w KQ - 0 1',
                        'highlights' => ['e5', 'f4', 'd4'],
                    ],
                    [
                        'title' => 'Playing Against a Space Advantage',
                        'content' => '<p>The cramped side should:</p><ul><li><strong>Trade pieces</strong> to relieve the cramp — fewer pieces need less space</li><li><strong>Prepare a pawn break</strong> to challenge the advanced pawns (e.g., ...f6 against e5, or ...c5 against d4)</li><li><strong>Maintain solidity</strong> — avoid creating additional weaknesses while waiting for the right moment to break free</li></ul><p>Patience is critical: a premature break can leave you with the worst of both worlds — less space and structural weaknesses.</p>',
                    ],
                    [
                        'title' => 'Space in the King\'s Indian',
                        'content' => '<p>The King\'s Indian Defense is the classic example of space dynamics. White gets a massive <strong>center and queenside space advantage</strong> with d4-e4-c4-d5. In return, Black gets:</p><ul><li>A <strong>kingside attack</strong> with ...f5-f4</li><li>A <strong>dynamic pawn break</strong> that opens lines toward the White king</li></ul><p>The resulting positions are sharp: White expands on the queenside (c5, b4-b5), Black attacks the king. Whoever breaks through first usually wins.</p>',
                        'diagram' => 'r1bq1rk1/pppnn1bp/3p2p1/3Ppp2/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - f6 0 9',
                        'highlights' => ['c4', 'd5', 'e4', 'f5'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of space advantage.</p>',
                        'quiz' => [
                            'question' => 'What should the cramped side prioritize?',
                            'options' => ['Avoiding all exchanges', 'Building a bigger pawn center', 'Trading pieces and preparing a pawn break', 'Attacking immediately on the wing'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Dynamic vs Static
        $module->lessons()->create([
            'title' => 'Dynamic vs Static',
            'slug' => 'dynamic-vs-static',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 4,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Two Types of Advantage',
                        'content' => '<p>Chess advantages fall into two categories:</p><ul><li><strong>Static advantages</strong>: Long-lasting structural features — better pawn structure, bishop pair, passed pawn, weak squares. These <em>persist</em> and often grow stronger in the endgame.</li><li><strong>Dynamic advantages</strong>: Temporary factors — lead in development, initiative, piece activity, exposed enemy king. These <em>fade</em> over time if not exploited.</li></ul><p>Understanding which type you hold dictates your entire strategy.</p>',
                    ],
                    [
                        'title' => 'Converting Dynamic to Static',
                        'content' => '<p>The most important strategic skill is <strong>converting dynamic advantages into static ones</strong> before they evaporate:</p><ul><li>Use your <strong>development lead</strong> to win a pawn (creating a material or structural advantage)</li><li>Convert your <strong>initiative</strong> into a permanent weakness in the opponent\'s position</li><li>Use temporary <strong>piece activity</strong> to force favorable exchanges that simplify to a winning endgame</li></ul><p>Failing to convert means your advantage simply disappears as the opponent catches up.</p>',
                    ],
                    [
                        'title' => 'Dynamic Compensation',
                        'content' => '<p>Sometimes it is correct to <strong>sacrifice static assets for dynamic ones</strong>. A gambit gives up a pawn (static) for development and initiative (dynamic). The key question is: "Can I convert my dynamic advantage before it fades?"</p><p>The <strong>Marshall Attack</strong> in the Ruy Lopez is a perfect example: Black sacrifices a pawn with ...d5 for a fierce kingside initiative. If White defends precisely, the dynamic advantage dissipates and the extra pawn wins. If White falters, Black\'s attack is decisive.</p>',
                        'diagram' => 'r1bq1rk1/5ppp/p1np4/1p1Np3/4P3/3P4/PPP2PPP/R1BQ1RK1 w - - 0 1',
                    ],
                    [
                        'title' => 'Steinitz\'s Accumulation Theory',
                        'content' => '<p>Wilhelm Steinitz, the first World Champion, taught that a successful attack requires an <strong>accumulation of small advantages</strong>. You cannot attack from an equal position — first, you must patiently build up static and dynamic advantages until the position is ripe.</p><p>Conversely, the defender should seek to <strong>neutralize advantages one at a time</strong>, trading dynamic threats for static compensation, and gradually equalizing the position.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of dynamic vs static advantages.</p>',
                        'quiz' => [
                            'question' => 'What happens to a dynamic advantage over time if not exploited?',
                            'options' => ['It grows stronger', 'It stays the same', 'It fades and disappears', 'It converts automatically'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Strategy Puzzles
        $module->lessons()->create([
            'title' => 'Strategy Puzzles',
            'slug' => 'strategic-mastery-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 8,
            'sort_order' => 5,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 150,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 8',
                        'solution' => ['dxc5', 'Bxc5', 'b4'],
                        'hints' => ['Start a minority attack on the queenside.', 'Exchange in the center first, then advance b4 to target Black\'s queenside pawns.'],
                    ],
                    [
                        'fen' => 'r1bq1rk1/pppn1ppp/4pn2/3p4/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 6',
                        'solution' => ['c5'],
                        'hints' => ['Gain space on the queenside and restrict Black\'s bishop.', 'The c5 advance locks the center and prepares b4-b5 expansion.'],
                    ],
                    [
                        'fen' => 'r2q1rk1/pp1bbppp/2n1pn2/3p4/3P1B2/2N1PN2/PPQ2PPP/R3KB1R w KQ - 0 8',
                        'solution' => ['h3'],
                        'hints' => ['Think prophylactically — what does Black want to do?', 'h3 prevents ...Ng4 or ...Bg4, maintaining control.'],
                    ],
                    [
                        'fen' => 'r1bqr1k1/ppp2ppp/2nb1n2/3pp3/2P5/2N1PN2/PPQB1PPP/R3KB1R w KQ - 0 7',
                        'solution' => ['cxd5', 'exd5', 'Nb5'],
                        'hints' => ['Open the c-file and target the isolated d-pawn.', 'After exchanging on d5, the knight lands on b5 attacking c7 and pressuring d5.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 14 — Advanced Openings (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedAdvancedOpenings(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Advanced Openings',
            'slug' => 'advanced-openings',
            'skill_tier' => 'advanced',
            'required_tier' => 'gold',
            'description' => 'Study the Najdorf Sicilian, Ruy Lopez, Queen\'s Indian, and English Opening — the openings of champions.',
            'icon' => "\u{1F4D8}",
            'sort_order' => 14,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 75,
        ]);

        // Lesson 1 — Najdorf Sicilian
        $module->lessons()->create([
            'title' => 'Najdorf Sicilian',
            'slug' => 'najdorf-sicilian',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 1,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The King of Fighting Openings',
                        'content' => '<p>The <strong>Najdorf Sicilian</strong> (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6) is the most popular and deeply analyzed opening in chess history. The move <strong>5...a6</strong> prepares ...e5 and ...b5 while keeping maximum flexibility.</p><p>Fischer, Kasparov, and Carlsen have all used it as their primary weapon against 1.e4. It leads to rich, complex positions where both sides have chances.</p>',
                        'diagram' => 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
                        'highlights' => ['a6', 'd6', 'f6'],
                    ],
                    [
                        'title' => 'Key Ideas for Black',
                        'content' => '<p>Black\'s strategic plans in the Najdorf include:</p><ul><li><strong>...e5</strong>: The main freeing break, establishing a strong center. Often played after ...Be7 and ...O-O</li><li><strong>...b5</strong>: Queenside expansion, gaining space and preparing ...Bb7</li><li><strong>...Qb6 or ...Qc7</strong>: Flexible queen development covering key squares</li><li><strong>...Be6</strong>: In the English Attack lines, immediately challenging the knight on d4</li></ul>',
                    ],
                    [
                        'title' => 'White\'s Main Systems',
                        'content' => '<p>White has several major approaches:</p><ul><li><strong>6.Bg5</strong> (Classical): Pins the knight, leading to sharp theoretical battles</li><li><strong>6.Be2</strong>: Solid, preparing to meet ...e5 with positional play</li><li><strong>6.Be3/6.f3</strong> (English Attack): The modern favorite — White plays Qd2, O-O-O, g4, aiming for a direct kingside attack</li><li><strong>6.Bc4</strong> (Fischer\'s choice): Targeting f7 and controlling the center diagonals</li></ul>',
                        'diagram' => 'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 6',
                        'highlights' => ['g5', 'f6'],
                    ],
                    [
                        'title' => 'The Poisoned Pawn Variation',
                        'content' => '<p>After 6.Bg5 e6 7.f4 Qb6, Black grabs the "poisoned" b2 pawn with 8.Qd2 Qxb2. This ultra-sharp line has been tested at the highest level for over 60 years. The resulting positions are extraordinarily complex — both sides must know the theory deeply to survive.</p><p>Fischer was famous for playing both sides of this variation. Computer analysis has confirmed that the pawn grab is objectively sound, but the practical demands are immense.</p>',
                        'diagram' => 'rnb1kb1r/1p3ppp/p2ppn2/6B1/3NPP2/2N5/PqP3PP/R2QKB1R w KQkq - 0 9',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the Najdorf Sicilian.</p>',
                        'quiz' => [
                            'question' => 'What is the defining move of the Najdorf Sicilian?',
                            'options' => ['5...e6', '5...a6', '5...Nc6', '5...g6'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Ruy Lopez
        $module->lessons()->create([
            'title' => 'Ruy Lopez',
            'slug' => 'ruy-lopez',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 2,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Spanish Game',
                        'content' => '<p>The <strong>Ruy Lopez</strong> (1.e4 e5 2.Nf3 Nc6 3.Bb5) is the oldest and most respected opening in chess, named after the 16th-century Spanish priest Ruy L&oacute;pez de Segura. The bishop puts pressure on the knight that defends the e5 pawn, creating long-term tension in the center.</p><p>The Ruy Lopez has been a cornerstone of World Championship matches for over 150 years. Understanding it deeply is essential for any advanced player.</p>',
                        'diagram' => 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
                        'highlights' => ['b5', 'c6', 'e5'],
                    ],
                    [
                        'title' => 'The Closed Ruy Lopez',
                        'content' => '<p>The main line continues 3...a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O. White has completed development and is ready for d4, the central break that defines the struggle.</p><p>This is the <strong>Closed Ruy Lopez</strong>, where play is strategic and maneuvering. White aims for d4; Black tries to maintain the center with ...d6 and ...Bg4 or ...Na5 to exchange the powerful Bb3.</p>',
                        'diagram' => 'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 2 9',
                    ],
                    [
                        'title' => 'The Marshall Attack',
                        'content' => '<p>The <strong>Marshall Attack</strong> (8...d5!? instead of 8...O-O) is one of the most spectacular gambits in chess. Black sacrifices a pawn with 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6, obtaining a ferocious kingside attack with ...Bd6, ...Qh4, ...Bg4.</p><p>Frank Marshall saved this prepared idea for a tournament against Capablanca in 1918. Despite losing the game, the attack has since been proven fully sound and is regularly seen at the top level.</p>',
                        'diagram' => 'r1bq1rk1/5ppp/p1pb4/1p6/3n4/1BP5/PP1P1PPP/RNBQR1K1 w - - 0 12',
                    ],
                    [
                        'title' => 'The Berlin Defense',
                        'content' => '<p>The <strong>Berlin Defense</strong> (3...Nf6) became famous when Kramnik used it to dethrone Kasparov in 2000. After 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5, Black reaches an endgame that is notoriously difficult for White to win despite the better pawn structure.</p><p>The "Berlin Wall" is considered one of the most solid defenses in chess, though the resulting positions require deep endgame understanding to handle as Black.</p>',
                        'diagram' => 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
                        'highlights' => ['f6'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the Ruy Lopez.</p>',
                        'quiz' => [
                            'question' => 'Which defense did Kramnik use to defeat Kasparov in the 2000 World Championship?',
                            'options' => ['Marshall Attack', 'Berlin Defense', 'Closed Ruy Lopez', 'Morphy Defense'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Queen's Indian Defense
        $module->lessons()->create([
            'title' => 'Queen\'s Indian',
            'slug' => 'queens-indian',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 3,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'A Solid Hypermodern Defense',
                        'content' => '<p>The <strong>Queen\'s Indian Defense</strong> (1.d4 Nf6 2.c4 e6 3.Nf3 b6) is one of the most reliable defenses against 1.d4. Black fianchettoes the queen\'s bishop to b7, aiming it at the long diagonal (a8-h1) to control the central squares e4 and d5 from a distance.</p><p>This is a <strong>hypermodern</strong> approach: Black does not occupy the center with pawns but instead controls it with pieces.</p>',
                        'diagram' => 'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 4',
                        'highlights' => ['b6', 'b7', 'e4'],
                    ],
                    [
                        'title' => 'The Classical System (4.g3)',
                        'content' => '<p>White\'s most natural approach is <strong>4.g3</strong>, fianchettoing their own bishop to g2. This leads to a battle of the long diagonals — both bishops aim at each other. The resulting positions are strategic and positional, with subtle maneuvering.</p><p>Key themes include control of e4, the fight for d5, and whether Black can achieve the freeing ...d5 or ...c5 breaks.</p>',
                        'diagram' => 'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq - 0 4',
                    ],
                    [
                        'title' => 'The Petrosian System (4.a3)',
                        'content' => '<p>The <strong>Petrosian System</strong> with 4.a3 prevents ...Bb4 (which would be the Nimzo-Indian), maintaining flexibility. White can develop naturally with Nc3 without worrying about the pin.</p><p>This seemingly modest move has deep strategic implications. White retains maximum structural flexibility while steering the game into positions where the a3 pawn can support a later b4 expansion.</p>',
                    ],
                    [
                        'title' => 'Strategic Themes',
                        'content' => '<p>Key middlegame themes in the Queen\'s Indian:</p><ul><li><strong>Control of e4</strong>: The battle revolves around whether White can establish a pawn or piece on e4</li><li><strong>The b7 bishop</strong>: If this bishop is effective on the long diagonal, Black is well-placed; if blocked by pawns, Black struggles</li><li><strong>Pawn breaks ...c5 and ...d5</strong>: Black\'s freeing moves, timed carefully based on White\'s setup</li><li><strong>Queen-side expansion</strong>: White often plays b4-b5 to gain space and push the bishop off the diagonal</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the Queen\'s Indian Defense.</p>',
                        'quiz' => [
                            'question' => 'What is the main purpose of ...b6 in the Queen\'s Indian?',
                            'options' => ['To attack the c4 pawn', 'To fianchetto the bishop to b7 and control e4', 'To prepare ...a5 on the queenside', 'To defend the d5 square with a pawn'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — English Opening
        $module->lessons()->create([
            'title' => 'English Opening',
            'slug' => 'english-opening',
            'lesson_type' => 'theory',
            'difficulty_rating' => 7,
            'sort_order' => 4,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 100,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Flexible 1.c4',
                        'content' => '<p>The <strong>English Opening</strong> (1.c4) is White\'s second most popular first move. Named after Howard Staunton, it controls d5 from the flank and offers enormous flexibility — White can transpose into many 1.d4 openings or maintain a unique English character.</p><p>Botvinnik, Karpov, and Kramnik have all used the English extensively. It avoids heavily analyzed 1.e4 theory while maintaining a solid advantage.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1',
                        'highlights' => ['c4', 'd5'],
                    ],
                    [
                        'title' => 'The Symmetrical Variation',
                        'content' => '<p>After 1.c4 c5 (the <strong>Symmetrical English</strong>), both sides develop flexibly. White typically plays Nc3, g3, Bg2, creating a Botvinnik formation or a Hedgehog setup. Key plans for White include:</p><ul><li><strong>d4</strong>: Breaking the symmetry with a central advance</li><li><strong>Nd5</strong>: Occupying the central outpost</li><li><strong>b3 and Bb2</strong>: Fianchetto setup for long-diagonal pressure</li></ul>',
                        'diagram' => 'rnbqkbnr/pp1ppppp/8/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR b KQkq - 1 2',
                    ],
                    [
                        'title' => 'The Reversed Sicilian',
                        'content' => '<p>After 1.c4 e5, White has a <strong>Reversed Sicilian</strong> with an extra tempo. White\'s setup with Nc3, g3, Bg2, and d3 creates a solid platform. The extra move compared to the Sicilian should provide a small but lasting edge.</p><p>Typical plans include kingside expansion with f4 (the <strong>Grand Prix</strong> reversed) or positional play with d3 and slow expansion.</p>',
                    ],
                    [
                        'title' => 'The Hedgehog',
                        'content' => '<p>The <strong>Hedgehog</strong> is a famous formation arising from the English: Black plays pawns on a6, b6, d6, e6 with pieces behind them (Bb7, Be7, Qc7, Rfd8). Despite looking passive, the Hedgehog is <strong>resilient and full of counterattacking potential</strong>.</p><p>The key idea: Black waits patiently, then explodes with a well-timed ...b5 or ...d5 pawn break, often with devastating effect. White must be careful not to overextend.</p>',
                        'diagram' => 'r1bq1rk1/2p1bppp/p1n1pn2/1p6/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 8',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the English Opening.</p>',
                        'quiz' => [
                            'question' => 'What makes the English Opening particularly flexible?',
                            'options' => ['It forces an immediate attack', 'It can transpose into many 1.d4 openings or stay independent', 'It prevents all of Black\'s defenses', 'It guarantees a kingside attack'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Opening Analysis (puzzle)
        $module->lessons()->create([
            'title' => 'Opening Analysis',
            'slug' => 'advanced-opening-analysis',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 9,
            'sort_order' => 5,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 150,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
                        'solution' => ['Bg5'],
                        'hints' => ['This is the Najdorf Sicilian — what is White\'s most principled move?', 'Pin the knight on f6 to the queen — the Classical Najdorf mainline.'],
                    ],
                    [
                        'fen' => 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
                        'solution' => ['O-O'],
                        'hints' => ['The Ruy Lopez — develop the king to safety first.', 'Castling is the most accurate move, preserving tension and completing development.'],
                    ],
                    [
                        'fen' => 'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq - 0 4',
                        'solution' => ['Bb7'],
                        'hints' => ['Queen\'s Indian setup — complete the fianchetto.', 'The bishop on b7 exerts pressure on the a8-h1 diagonal, especially e4.'],
                    ],
                    [
                        'fen' => 'r1bqk2r/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 6',
                        'solution' => ['Bd3'],
                        'hints' => ['Develop the bishop to its most active diagonal.', 'Bd3 prepares O-O and eyes the h7 square for potential Greek Gift ideas.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 15 — Advanced Endgames (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedAdvancedEndgames(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Advanced Endgames',
            'slug' => 'advanced-endgames',
            'skill_tier' => 'advanced',
            'required_tier' => 'gold',
            'description' => 'Master the Lucena & Philidor positions, rook endgame theory, queen endgames, and practical endgame technique.',
            'icon' => "\u{2655}",
            'sort_order' => 15,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 75,
        ]);

        // Lesson 1 — Lucena & Philidor
        $module->lessons()->create([
            'title' => 'Lucena & Philidor',
            'slug' => 'lucena-and-philidor',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 1,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Two Most Important Positions',
                        'content' => '<p>The <strong>Lucena Position</strong> (winning for the stronger side) and the <strong>Philidor Position</strong> (drawing for the defender) are the two most fundamental rook endgame positions in chess. Understanding both is absolutely essential — they are the foundation upon which all rook endgame theory is built.</p><p>As Capablanca said: "In order to improve your game, you must study the endgame before everything else."</p>',
                    ],
                    [
                        'title' => 'The Lucena Position',
                        'content' => '<p>The <strong>Lucena Position</strong> arises when the stronger side has a rook and a pawn on the 7th rank with the king sheltering on the 8th rank in front of the pawn. The winning technique is the famous <strong>"bridge" method</strong>:</p><ol><li>Move the king to the side: Kc8→d7</li><li>Push the defending rook away with Re1+</li><li>Advance the rook to the 4th rank: Rd4 (building the "bridge")</li><li>When checked from behind, block with the rook: Rd4-d5 blocks the check</li></ol>',
                        'diagram' => '4K3/4P1k1/8/8/8/8/8/3rR3 w - - 0 1',
                        'highlights' => ['e8', 'e7', 'e1'],
                    ],
                    [
                        'title' => 'The Philidor Position',
                        'content' => '<p>The <strong>Philidor Position</strong> is the key defensive setup. The defender places the rook on the <strong>3rd rank</strong> (6th rank from the attacker\'s view), cutting off the attacking king. The critical technique:</p><ol><li>Keep the rook on the 3rd rank while the pawn is still on the 5th rank</li><li>When the pawn advances to the 6th rank, <strong>switch to checking from behind</strong> (from the 8th rank)</li></ol><p>This method draws because the attacking king has no shelter from the rook checks.</p>',
                        'diagram' => '8/4k3/8/4P3/8/4r3/4K3/4R3 w - - 0 1',
                        'highlights' => ['e3', 'e5'],
                    ],
                    [
                        'title' => 'Connecting the Concepts',
                        'content' => '<p>The strategic goal in rook endgames becomes clear:</p><ul><li><strong>Stronger side</strong>: Try to reach the Lucena Position — get the king in front of the pawn on the 8th rank with the pawn on the 7th</li><li><strong>Weaker side</strong>: Try to reach the Philidor Position — keep the rook on the 3rd rank and the king in front of the pawn</li></ul><p>Most rook endgames revolve around one side trying to achieve Lucena while the other fights for Philidor. Knowing when you can and cannot reach either position determines correct play.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the Lucena and Philidor positions.</p>',
                        'quiz' => [
                            'question' => 'In the Philidor Position, where should the defending rook be placed?',
                            'options' => ['On the 1st rank', 'On the 3rd rank (6th from the attacker)', 'Next to the pawn', 'Behind the pawn'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Rook Endgame Theory
        $module->lessons()->create([
            'title' => 'Rook Endgame Theory',
            'slug' => 'rook-endgame-theory',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 2,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Rook Activity',
                        'content' => '<p>The most important principle in rook endgames: <strong>rook activity trumps material</strong>. An active rook attacking pawns from behind or cutting off the enemy king is often worth more than an extra pawn held by a passive rook stuck defending.</p><p>Tarrasch\'s rule: "Place rooks <strong>behind passed pawns</strong>, whether your own or your opponent\'s." Behind your own pawn, the rook supports its advance. Behind the opponent\'s pawn, the rook pressures it with every step.</p>',
                    ],
                    [
                        'title' => 'The Outside Passed Pawn',
                        'content' => '<p>An <strong>outside passed pawn</strong> (far from the main pawn mass) is a powerful weapon in rook endgames. It acts as a <strong>decoy</strong>: the opponent must use their rook or king to stop it, leaving your rook free to attack elsewhere.</p><p>The classic technique: advance the outside passed pawn to draw the enemy king or rook away, then switch your rook to attack the undefended pawns on the other wing.</p>',
                        'diagram' => '8/5kpp/8/P4p2/5P2/6PP/4R1K1/4r3 w - - 0 1',
                        'highlights' => ['a5'],
                    ],
                    [
                        'title' => 'Rook and Pawn vs Rook',
                        'content' => '<p>This endgame occurs frequently and requires precise knowledge:</p><ul><li><strong>Rook pawn (a/h)</strong>: Usually drawn if the defending king reaches the corner — the attacker cannot use the Lucena bridge effectively</li><li><strong>Central/bishop pawn</strong>: Winning chances depend on the positions of the kings and whether Lucena or Philidor can be reached</li><li><strong>Knight pawn (b/g)</strong>: Similar to central pawns, with some specific defensive techniques</li></ul><p>The <strong>short side / long side</strong> principle: the defending king should be on the short side (between the pawn and the near edge), leaving the long side for rook checking distance.</p>',
                    ],
                    [
                        'title' => 'Seventh Rank Domination',
                        'content' => '<p>A rook on the <strong>seventh rank</strong> is a powerful asset. It:</p><ul><li>Attacks unadvanced pawns from the side</li><li>Restricts the enemy king to the back rank</li><li>Creates mating threats in combination with other pieces</li></ul><p>Two rooks on the seventh rank ("pigs on the seventh") is almost always decisive, creating threats against the king and pawns simultaneously.</p>',
                        'diagram' => '6k1/1R3ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
                        'highlights' => ['b7'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of rook endgame theory.</p>',
                        'quiz' => [
                            'question' => 'According to Tarrasch, where should rooks be placed relative to passed pawns?',
                            'options' => ['In front of them', 'Beside them', 'Behind them', 'It does not matter'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Queen Endgames
        $module->lessons()->create([
            'title' => 'Queen Endgames',
            'slug' => 'queen-endgames',
            'lesson_type' => 'theory',
            'difficulty_rating' => 9,
            'sort_order' => 3,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 120,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Most Complex Endgames',
                        'content' => '<p><strong>Queen endgames</strong> are among the most difficult in chess. The queen\'s enormous range means perpetual check is always a possibility, making it hard to convert extra material. Even a queen and pawn versus queen is only won in about <strong>70% of positions</strong> — and the winning process can require 50+ precise moves.</p><p>Practical mastery requires understanding key defensive fortresses and attacking techniques.</p>',
                    ],
                    [
                        'title' => 'Queen vs Pawn on the 7th',
                        'content' => '<p>Queen versus a pawn on the seventh rank is a critical endgame:</p><ul><li><strong>Central/knight pawn</strong>: The queen wins by bringing the king closer while giving checks that force the defending king to block the pawn</li><li><strong>Bishop pawn (c/f)</strong>: Usually winning, but requires precise technique — stalemate traps exist</li><li><strong>Rook pawn (a/h)</strong>: <strong>Drawn</strong> if the defending king is on b1/g1 (or b8/g8) — the defender achieves a stalemate fortress</li></ul>',
                        'diagram' => '8/8/8/8/8/3K4/1pQ5/1k6 w - - 0 1',
                        'highlights' => ['c2', 'b2', 'b1'],
                    ],
                    [
                        'title' => 'Perpetual Check Defense',
                        'content' => '<p>The most common defensive resource in queen endgames is <strong>perpetual check</strong>. The queen is uniquely suited to this because:</p><ul><li>It can check from multiple angles (ranks, files, diagonals)</li><li>The opponent\'s king often has few hiding squares</li><li>Even a significant material deficit can be overcome if the king cannot escape checks</li></ul><p>When defending, always look for perpetual check resources <strong>before</strong> resigning yourself to a passive defense.</p>',
                    ],
                    [
                        'title' => 'Queen Endgame Principles',
                        'content' => '<p>Key principles for queen endgames:</p><ul><li><strong>Centralize the queen</strong>: A centralized queen controls the maximum number of squares</li><li><strong>King safety</strong>: Keep your king sheltered — an exposed king invites perpetual check</li><li><strong>Passed pawns</strong>: They are even more dangerous in queen endgames because the queen can support them while simultaneously threatening the opponent\'s king</li><li><strong>Check distance</strong>: When giving checks, use <strong>distant checks</strong> where possible — they are harder to block</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of queen endgames.</p>',
                        'quiz' => [
                            'question' => 'Queen vs a pawn on the 7th: which pawn type is drawn?',
                            'options' => ['Central pawn', 'Knight pawn', 'Bishop pawn', 'Rook pawn'],
                            'correct' => 3,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Practical Technique
        $module->lessons()->create([
            'title' => 'Practical Technique',
            'slug' => 'practical-endgame-technique',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 4,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Principle of Two Weaknesses',
                        'content' => '<p>When you have an advantage, one weakness in the opponent\'s position is usually not enough to win — the defender can focus all resources on protecting it. You need to create a <strong>second weakness</strong> on a different part of the board, forcing the defender to stretch too thin.</p><p>This principle (attributed to Capablanca) is perhaps the most important concept in practical endgame technique. It applies to all endgame types.</p>',
                    ],
                    [
                        'title' => 'Zugzwang',
                        'content' => '<p><strong>Zugzwang</strong> ("compulsion to move") is a position where the side to move would prefer to pass — any move worsens their position. Zugzwang is a powerful weapon in endgames because there are fewer pieces to maneuver with.</p><p>Recognizing zugzwang positions and maneuvering to create them is a hallmark of endgame mastery. The technique often involves <strong>triangulation</strong> — the king makes a triangular maneuver to lose a tempo and transfer the move to the opponent.</p>',
                        'diagram' => '8/8/4k3/3p1p2/3K1P2/4P3/8/8 w - - 0 1',
                        'highlights' => ['d4', 'e6'],
                    ],
                    [
                        'title' => 'Corresponding Squares',
                        'content' => '<p><strong>Corresponding squares</strong> (or "conjugate squares") is an advanced technique for king and pawn endgames. Two squares "correspond" when: if one king stands on one square, the other king must stand on the corresponding square to maintain the balance.</p><p>By mapping out the correspondence system, you can determine the precise maneuvering required to reach a winning (or drawing) position. This technique solves many complex king and pawn endgames that seem impossible to calculate directly.</p>',
                    ],
                    [
                        'title' => 'Converting Advantages',
                        'content' => '<p>Practical conversion technique follows a clear process:</p><ol><li><strong>Assess</strong>: Identify your advantage (material, structure, activity)</li><li><strong>Simplify</strong>: Exchange pieces to reduce counterplay (but not pawns if you need a target)</li><li><strong>Create a passed pawn</strong>: Use your advantage to create a distant passed pawn</li><li><strong>Advance the passer</strong>: Force the opponent to deal with it, then exploit the distraction</li><li><strong>Technique</strong>: Use king activity, zugzwang, and the principle of two weaknesses to finish</li></ol>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of practical endgame technique.</p>',
                        'quiz' => [
                            'question' => 'What is the "Principle of Two Weaknesses"?',
                            'options' => ['Having two weak pawns is always losing', 'You need two separate weaknesses to exploit to win the endgame', 'Creating two passed pawns to win', 'Attacking with two pieces simultaneously'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Endgame Master (puzzle)
        $module->lessons()->create([
            'title' => 'Endgame Master',
            'slug' => 'endgame-master-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 9,
            'sort_order' => 5,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 150,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '1K6/1P2k3/8/8/8/8/8/4r3 w - - 0 1',
                        'solution' => ['Kc7', 'Rc1+', 'Kd6', 'Rd1+', 'Ke6', 'Re1+', 'Kd5', 'Rd1+', 'Kc4'],
                        'hints' => ['This is the Lucena Position — the winning technique is the "bridge."', 'Step the king away from the pawn, then use the rook to shield against checks.'],
                    ],
                    [
                        'fen' => '8/4Rpk1/8/8/8/4K3/8/1r6 w - - 0 1',
                        'solution' => ['Kf4', 'Rf1+', 'Kg5'],
                        'hints' => ['Bring the king up to support the rook on the 7th.', 'Advance toward the enemy king while avoiding checks.'],
                    ],
                    [
                        'fen' => '8/8/8/3k4/8/4K3/7p/5Q2 w - - 0 1',
                        'solution' => ['Qf2'],
                        'hints' => ['The queen must stop the pawn while bringing the king closer.', 'Keep the queen on a square that prevents ...h1=Q while approaching with the king later.'],
                    ],
                    [
                        'fen' => '8/5p2/5k2/5p2/3K4/8/8/8 w - - 0 1',
                        'solution' => ['Ke3', 'Ke5', 'Kf3'],
                        'hints' => ['Use triangulation to put Black in zugzwang.', 'The king maneuvers to transfer the move to Black, who then must give ground.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 16 — Master Preparation (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedMasterPreparation(TutorialModule $prerequisite): void
    {
        $module = TutorialModule::create([
            'name' => 'Master Preparation',
            'slug' => 'master-preparation',
            'skill_tier' => 'advanced',
            'required_tier' => 'gold',
            'description' => 'Train like a master: calculation exercises, candidate moves, time management, and systematic game analysis.',
            'icon' => "\u{1F3C6}",
            'sort_order' => 16,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 80,
        ]);

        // Lesson 1 — Calculation Training
        $module->lessons()->create([
            'title' => 'Calculation Training',
            'slug' => 'calculation-training',
            'lesson_type' => 'theory',
            'difficulty_rating' => 9,
            'sort_order' => 1,
            'estimated_duration_minutes' => 16,
            'xp_reward' => 120,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Tree of Variations',
                        'content' => '<p>Calculation in chess is the ability to <strong>visualize future positions</strong> in your mind without moving the pieces. The "tree of variations" is the branching structure of possible moves: each candidate move leads to opponent responses, which lead to your replies, and so on.</p><p>Strong players do not calculate every branch — they <strong>prune</strong> the tree efficiently, focusing on the most forcing and critical lines.</p>',
                    ],
                    [
                        'title' => 'How Grandmasters Calculate',
                        'content' => '<p>Research by de Groot and others shows that grandmasters do <strong>not</strong> see more moves ahead than amateurs in most positions. Instead, they:</p><ul><li><strong>Identify the right candidate moves</strong> faster and more accurately</li><li><strong>Evaluate resulting positions</strong> more precisely</li><li><strong>Prune bad lines</strong> instantly through pattern recognition</li><li><strong>Focus depth</strong> on the critical variations — sometimes 10+ moves deep in tactical positions, but only 2-3 in quiet ones</li></ul>',
                    ],
                    [
                        'title' => 'Calculation Exercises',
                        'content' => '<p>To improve your calculation:</p><ul><li><strong>Visualization training</strong>: Play through games blindfold, starting with short sequences and gradually increasing length</li><li><strong>Tactical puzzles</strong>: Solve without moving pieces on the board — only in your head</li><li><strong>Endgame studies</strong>: Artistic compositions that require deep, precise calculation</li><li><strong>Analysis practice</strong>: Choose a complex position and write down all variations you calculate before checking with an engine</li></ul>',
                    ],
                    [
                        'title' => 'Common Calculation Errors',
                        'content' => '<p>The most frequent calculation mistakes:</p><ul><li><strong>Skipping opponent\'s best reply</strong>: Always assume the opponent will find the strongest move</li><li><strong>Blundering the move order</strong>: A→B→C works, but B→A→C may not — check the exact sequence</li><li><strong>"Retained image" error</strong>: Visualizing a piece on its old square when it has moved in the variation</li><li><strong>Stopping too soon</strong>: Assuming a position is winning when there is a defensive resource 2-3 moves deeper</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of calculation methods.</p>',
                        'quiz' => [
                            'question' => 'According to research, what is the main difference between grandmaster and amateur calculation?',
                            'options' => ['Grandmasters see 20+ moves ahead', 'Grandmasters calculate every possible line', 'Grandmasters identify the right candidate moves and prune better', 'Grandmasters rely entirely on intuition'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Candidate Moves
        $module->lessons()->create([
            'title' => 'Candidate Moves',
            'slug' => 'candidate-moves',
            'lesson_type' => 'theory',
            'difficulty_rating' => 9,
            'sort_order' => 2,
            'estimated_duration_minutes' => 16,
            'xp_reward' => 120,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Kotov Method',
                        'content' => '<p>Alexander Kotov\'s <strong>candidate moves</strong> method is the classic systematic approach to decision-making in chess:</p><ol><li><strong>Survey the position</strong>: Assess material, king safety, piece activity, pawn structure, threats</li><li><strong>Select candidate moves</strong>: Identify 3-5 moves worth serious consideration</li><li><strong>Analyze each candidate</strong>: Calculate the main variations for each, one at a time</li><li><strong>Compare and decide</strong>: Choose the move with the best evaluation</li></ol><p>The key rule: <strong>do not jump between candidates</strong> during calculation. Finish analyzing one before moving to the next.</p>',
                    ],
                    [
                        'title' => 'Finding Candidate Moves',
                        'content' => '<p>To generate good candidate moves, use these techniques:</p><ul><li><strong>Forcing moves first</strong>: Checks, captures, and threats (CCT method)</li><li><strong>Positional requirements</strong>: What does the position demand? (piece improvement, pawn break, prophylaxis)</li><li><strong>Opponent\'s plan</strong>: What would your opponent do with a free move? Can you prevent it?</li><li><strong>Pattern recognition</strong>: Have you seen a similar position before? What was played there?</li><li><strong>Challenging moves</strong>: Consider moves that look surprising — they are often the ones opponents miss</li></ul>',
                    ],
                    [
                        'title' => 'The Process of Elimination',
                        'content' => '<p>Sometimes the best approach is <strong>elimination</strong>: instead of finding the right move directly, eliminate moves that clearly do not work. This is especially useful in positions where the "right" move is hard to find but the "wrong" moves are obviously flawed.</p><p>Sherlock Holmes\' principle applies: "When you have eliminated the impossible, whatever remains, however improbable, must be the truth." In chess, the move that survives elimination — even if it looks strange — is often correct.</p>',
                    ],
                    [
                        'title' => 'Intuition vs Calculation',
                        'content' => '<p>The best players combine <strong>intuition</strong> (pattern-based quick assessment) with <strong>calculation</strong> (concrete analysis). The ideal process:</p><ol><li><strong>Intuition first</strong>: Your initial feeling about the position suggests the best area to look</li><li><strong>Calculation second</strong>: Verify your intuitive choice with concrete analysis</li><li><strong>Trust but verify</strong>: If calculation contradicts intuition, trust the calculation — but re-check both</li></ol><p>With experience, your intuition becomes increasingly reliable, allowing faster and more accurate decisions.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of the candidate moves method.</p>',
                        'quiz' => [
                            'question' => 'According to Kotov, what is the key rule when analyzing candidate moves?',
                            'options' => ['Always analyze the most forcing move first', 'Calculate all moves to the same depth', 'Do not jump between candidates — finish one before starting the next', 'Only consider 2 candidate moves maximum'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Time Management
        $module->lessons()->create([
            'title' => 'Time Management',
            'slug' => 'time-management-chess',
            'lesson_type' => 'theory',
            'difficulty_rating' => 8,
            'sort_order' => 3,
            'estimated_duration_minutes' => 16,
            'xp_reward' => 110,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Clock as a Piece',
                        'content' => '<p>In competitive chess, time is a resource just like material. A player with 20 minutes against an opponent\'s 2 minutes has a huge practical advantage — even in a lost position. Treat the clock as an <strong>extra piece</strong> in your army.</p><p>The goal is not to use time equally across all moves, but to <strong>invest time where it matters most</strong> — the critical moments that decide the game.</p>',
                    ],
                    [
                        'title' => 'Time Allocation Strategy',
                        'content' => '<p>A practical approach to time management:</p><ul><li><strong>Opening (moves 1-15)</strong>: Spend moderately — you should know your openings, but verify critical moments. Aim for 25-30% of your time</li><li><strong>Critical middlegame moments</strong>: Invest heavily — these are the decisions that determine the game. Use 40-50% of your time</li><li><strong>Endgame</strong>: Keep enough time to play accurately. Reserve 20-25% minimum</li></ul><p>The biggest mistake: spending too much time early on non-critical decisions, then blundering in time pressure later.</p>',
                    ],
                    [
                        'title' => 'Recognizing Critical Moments',
                        'content' => '<p>Learn to identify <strong>critical moments</strong> — positions where a wrong decision has severe consequences:</p><ul><li><strong>Transition points</strong>: When the position character changes (e.g., opening to middlegame, piece exchange simplification)</li><li><strong>Irreversible decisions</strong>: Pawn moves, piece exchanges, and structural changes that cannot be undone</li><li><strong>Tactical complications</strong>: Positions with many forcing variations where concrete calculation is essential</li><li><strong>Defensive challenges</strong>: When under attack, precision is vital — one error can be fatal</li></ul>',
                    ],
                    [
                        'title' => 'Playing in Time Pressure',
                        'content' => '<p>When short on time, follow these survival rules:</p><ul><li><strong>Prioritize king safety</strong>: Avoid leaving your king exposed</li><li><strong>Make useful moves</strong>: When unsure, improve your worst piece or centralize</li><li><strong>Avoid complications</strong>: Choose the simplest, safest option</li><li><strong>Use increment wisely</strong>: With increment, you have a minimum time per move — use it all</li><li><strong>Pre-move natural recaptures</strong>: On obvious moves (forced recaptures), play quickly to save time for real decisions</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of time management.</p>',
                        'quiz' => [
                            'question' => 'Where should you invest the most time during a game?',
                            'options' => ['The opening moves', 'Critical middlegame moments', 'The endgame', 'Equally across all phases'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Game Analysis Method
        $module->lessons()->create([
            'title' => 'Game Analysis Method',
            'slug' => 'game-analysis-method',
            'lesson_type' => 'theory',
            'difficulty_rating' => 9,
            'sort_order' => 4,
            'estimated_duration_minutes' => 16,
            'xp_reward' => 120,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Why Analyze Your Games?',
                        'content' => '<p>Analyzing your own games is the <strong>single most effective way to improve</strong> at chess. It reveals your specific weaknesses, reinforces good decisions, and builds your understanding of positions you actually play. Botvinnik, who trained every World Championship contender for decades, made game analysis the cornerstone of his training method.</p>',
                    ],
                    [
                        'title' => 'The Botvinnik Method',
                        'content' => '<p>Botvinnik\'s systematic game analysis process:</p><ol><li><strong>Record your thoughts during the game</strong>: Note what you were thinking at critical moments</li><li><strong>Analyze without an engine first</strong>: Spend 1-2 hours going through the game on your own, writing down improvements</li><li><strong>Identify the critical moments</strong>: Where did the game change? What was the turning point?</li><li><strong>Check with an engine</strong>: Compare your analysis with computer evaluation to find what you missed</li><li><strong>Draw conclusions</strong>: What patterns of mistakes do you see? What should you study?</li></ol>',
                    ],
                    [
                        'title' => 'What to Look For',
                        'content' => '<p>During analysis, focus on these areas:</p><ul><li><strong>Opening preparation</strong>: Did you follow your planned opening? Where did you deviate, and was it correct?</li><li><strong>Tactical oversights</strong>: Were there tactics you or your opponent missed?</li><li><strong>Strategic decisions</strong>: Were your plans correct? Did you address the position\'s demands?</li><li><strong>Time management</strong>: Where did you spend time? Were those moments truly critical?</li><li><strong>Psychological factors</strong>: Did emotions affect your decisions? Were you overconfident or panicking?</li></ul>',
                    ],
                    [
                        'title' => 'Building a Study Plan',
                        'content' => '<p>Analysis should feed into a <strong>structured improvement plan</strong>:</p><ol><li><strong>Track your errors</strong>: Keep a notebook of mistake types (tactical blindness, time trouble, endgame errors, opening gaps)</li><li><strong>Identify patterns</strong>: After 10-20 analyzed games, patterns emerge — perhaps you always misplay rook endgames or miss backward moves</li><li><strong>Target weaknesses</strong>: Dedicate study time to your weakest areas</li><li><strong>Study model games</strong>: Find master games that feature the themes you struggle with</li><li><strong>Re-test</strong>: After study, analyze new games to verify improvement</li></ol>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of game analysis methods.</p>',
                        'quiz' => [
                            'question' => 'According to the Botvinnik Method, when should you use a chess engine?',
                            'options' => ['During the game for hints', 'Immediately after the game', 'After analyzing the game on your own first', 'Engine analysis is not recommended'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Master Challenge (puzzle)
        $module->lessons()->create([
            'title' => 'Master Challenge',
            'slug' => 'master-challenge-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 10,
            'sort_order' => 5,
            'estimated_duration_minutes' => 16,
            'xp_reward' => 150,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'r1bqr1k1/pp3pbp/2pp1np1/4p3/2P1P3/2N1BP2/PP2B1PP/R2Q1RK1 w - - 0 12',
                        'solution' => ['d4', 'exd4', 'Nd5'],
                        'hints' => ['Open the center when you have better development.', 'After d4 exd4, Nd5 is a powerful knight outpost hitting c7, e7, and f6.'],
                    ],
                    [
                        'fen' => '2r2rk1/1bqnbppp/pp1ppn2/8/2PNP3/1PN1BP2/P2QB1PP/2R2RK1 w - - 0 14',
                        'solution' => ['Nd5'],
                        'hints' => ['Find the strongest central outpost for the knight.', 'Nd5 dominates the position — it attacks e7, c7, b6 and cannot be easily challenged.'],
                    ],
                    [
                        'fen' => 'r4rk1/1b2bppp/ppnqpn2/2pp4/3P4/P1NBPN2/1PQ2PPP/R1B2RK1 w - - 0 11',
                        'solution' => ['dxc5', 'bxc5', 'e4'],
                        'hints' => ['First exchange in the center, then advance.', 'After dxc5 bxc5, e4 opens the position favorably — your pieces are better coordinated.'],
                    ],
                    [
                        'fen' => 'r1b1k2r/pp2bppp/1qn1pn2/2ppP3/3P4/2NB1N2/PPP2PPP/R1BQK2R w KQkq - 0 7',
                        'solution' => ['exf6', 'Bxf6', 'O-O', 'O-O', 'Bg5'],
                        'hints' => ['Clear the center tension first, then develop with purpose.', 'After exf6 Bxf6, castle and then Bg5 pins the bishop, creating pressure against the d5 pawn.'],
                    ],
                ],
            ],
        ]);
    }
}
