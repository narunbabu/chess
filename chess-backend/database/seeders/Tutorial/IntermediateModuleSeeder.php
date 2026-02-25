<?php

namespace Database\Seeders\Tutorial;

use App\Models\TutorialModule;

class IntermediateModuleSeeder
{
    /**
     * Seed 6 intermediate modules (SILVER tier), 30 lessons total.
     * Modules 6-11 chain: Opening Principles -> Popular Openings -> Intermediate Tactics
     *   -> Positional Play -> Attack & Defense -> Intermediate Endgames.
     */
    public function run(): void
    {
        $m6 = $this->seedOpeningPrinciples();
        $m7 = $this->seedPopularOpenings($m6);
        $m8 = $this->seedIntermediateTactics($m7);
        $m9 = $this->seedPositionalPlay($m8);
        $m10 = $this->seedAttackAndDefense($m9);
        $this->seedIntermediateEndgames($m10);
    }

    // ──────────────────────────────────────────────
    // Module 6 — Opening Principles (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedOpeningPrinciples(): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Opening Principles',
            'slug' => 'opening-principles',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Master the fundamental principles of the opening: control the center, develop your pieces, and safeguard your king.',
            'icon' => "\u{1F4D6}",
            'sort_order' => 6,
            'estimated_duration_minutes' => 60,
        ]);

        // Lesson 1 — Center Control
        $module->lessons()->create([
            'title' => 'Center Control',
            'slug' => 'opening-center-control',
            'lesson_type' => 'theory',
            'difficulty_rating' => 4,
            'sort_order' => 1,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Classical Center',
                        'content' => '<p>The opening battle revolves around the <strong>four central squares</strong>: d4, d5, e4, e5. Occupying the center with pawns gives your pieces maximum scope and restricts your opponent\'s options.</p><p>The ideal setup is pawns on e4 and d4, forming a <strong>classical pawn center</strong> that controls key squares on both sides of the board.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 2',
                        'highlights' => ['d4', 'e4', 'c5', 'd5', 'e5', 'f5'],
                    ],
                    [
                        'title' => 'Controlling vs Occupying',
                        'content' => '<p>You do not always need pawns in the center to control it. Pieces can <strong>exert pressure</strong> on central squares from a distance. The <strong>hypermodern</strong> approach uses pieces (especially knights and bishops) to control the center while keeping pawns back.</p><p>For example, after 1.Nf3 d5 2.g3, White\'s fianchettoed bishop will aim at the center from g2.</p>',
                        'diagram' => 'rnbqkb1r/pppppppp/5n2/8/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq - 0 2',
                    ],
                    [
                        'title' => 'Fighting for the Center',
                        'content' => '<p>If your opponent builds a pawn center, <strong>challenge it</strong> rather than allow them to maintain it unchecked. Common ways to fight for the center include:</p><ul><li><strong>Pawn strikes</strong>: c5 against d4, or d5 against e4</li><li><strong>Piece pressure</strong>: Knights on f6/c6 aiming at d5/e4</li><li><strong>Pawn exchanges</strong>: Opening lines when your pieces are better developed</li></ul>',
                        'diagram' => 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
                        'highlights' => ['c5', 'e4'],
                    ],
                    [
                        'title' => 'Center Control in Practice',
                        'content' => '<p>After 1.e4 e5 2.Nf3 Nc6 3.Bc4, White has:</p><ul><li>A pawn on e4 controlling d5 and f5</li><li>A knight on f3 controlling d4 and e5</li><li>A bishop on c4 targeting the weak f7 pawn</li></ul><p>This is the <strong>Italian Game</strong> setup, a model of classical opening play.</p>',
                        'diagram' => 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
                        'highlights' => ['e4', 'f3', 'c4'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of center control in the opening.</p>',
                        'quiz' => [
                            'question' => 'What is the "hypermodern" approach to the center?',
                            'options' => ['Always occupy the center with pawns', 'Control the center with pieces from a distance', 'Ignore the center completely', 'Attack on the wings immediately'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Piece Development
        $module->lessons()->create([
            'title' => 'Piece Development',
            'slug' => 'opening-piece-development',
            'lesson_type' => 'theory',
            'difficulty_rating' => 4,
            'sort_order' => 2,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Develop Your Pieces Quickly',
                        'content' => '<p>In the opening, your primary goal is to <strong>bring your pieces into the game</strong> as fast as possible. Each undeveloped piece is a soldier not fighting. Aim to develop <strong>knights before bishops</strong>, as knights have fewer good squares and their optimal positions are clearer.</p>',
                        'diagram' => 'r1bqkb1r/pppppppp/2n2n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
                        'highlights' => ['f3', 'c6', 'f6'],
                    ],
                    [
                        'title' => 'The Golden Rules',
                        'content' => '<p>Follow these time-tested development guidelines:</p><ul><li><strong>Do not move the same piece twice</strong> in the opening unless forced</li><li><strong>Do not bring the queen out early</strong> — it can be chased by weaker pieces, wasting tempo</li><li><strong>Connect your rooks</strong> — develop all minor pieces so your rooks can see each other</li><li><strong>Every move should serve a purpose</strong>: develop, control center, or improve king safety</li></ul>',
                    ],
                    [
                        'title' => 'Tempo and Development Lead',
                        'content' => '<p><strong>Tempo</strong> means a unit of time (one move). Wasting tempo in the opening gives your opponent a <strong>development lead</strong>. If White has 4 pieces developed and Black only 2, White has a significant advantage and may launch an attack.</p><p>Never make pointless pawn moves in the opening — each pawn move is tempo that could have developed a piece.</p>',
                        'diagram' => 'rnbqkb1r/pppp1ppp/4pn2/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 3 3',
                    ],
                    [
                        'title' => 'Development Example',
                        'content' => '<p>After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4, White has developed three pieces, built a strong center, and is ready to castle. This is a model opening — efficient, purposeful development.</p>',
                        'diagram' => 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq d3 0 5',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your development knowledge.</p>',
                        'quiz' => [
                            'question' => 'Why should you avoid bringing the queen out early?',
                            'options' => ['The queen is too weak', 'It can be chased by weaker pieces, wasting tempo', 'The queen should only come out in the endgame', 'Queens cannot move far in the opening'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — King Safety
        $module->lessons()->create([
            'title' => 'King Safety',
            'slug' => 'opening-king-safety',
            'lesson_type' => 'theory',
            'difficulty_rating' => 4,
            'sort_order' => 3,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Castle Early',
                        'content' => '<p>The king in the center is vulnerable to attacks along the e-file and diagonals. <strong>Castle within the first 10 moves</strong> to tuck the king into a safe corner behind a wall of pawns.</p><p>Kingside castling (O-O) is faster and generally safer because it requires moving only two pieces (knight and bishop) off the back rank.</p>',
                        'diagram' => 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4',
                        'highlights' => ['g1', 'f1'],
                    ],
                    [
                        'title' => 'Pawn Shield',
                        'content' => '<p>After castling, the three pawns in front of your king form a <strong>pawn shield</strong>. Keep this shield intact:</p><ul><li>Avoid moving the f-pawn (it opens the diagonal to your king)</li><li>h3/h6 is fine for preventing Bg5/Bg4 pins, but do it only when necessary</li><li>g3/g6 fianchetto is a valid structure, but weakens f3/f6</li></ul>',
                        'diagram' => 'r1bq1rk1/ppppbppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 6 6',
                        'highlights' => ['f2', 'g2', 'h2'],
                    ],
                    [
                        'title' => 'Dangers of Delayed Castling',
                        'content' => '<p>Leaving the king in the center invites disaster. Files can be opened with pawn exchanges, and your opponent\'s rooks and queen will target the exposed king.</p><p>In this classic position, Black has not castled and White can open the center with devastating effect:</p>',
                        'diagram' => 'r1bqk2r/pppp1ppp/2n2n2/4N3/2BPP3/8/PPP2PPP/RNBQK2R b KQkq - 0 5',
                    ],
                    [
                        'title' => 'Opposite-Side Castling',
                        'content' => '<p>When players castle on opposite sides, the game becomes a <strong>race of pawn storms</strong>. Each side pushes pawns toward the opponent\'s king to pry open lines. Speed is everything in these sharp positions.</p><p>In opposite-side castling, do not be afraid to push your edge pawns aggressively — they are attacking weapons, not defenders.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your king safety knowledge.</p>',
                        'quiz' => [
                            'question' => 'Which pawn should you generally avoid moving after kingside castling?',
                            'options' => ['The a-pawn', 'The f-pawn', 'The d-pawn', 'The b-pawn'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Opening Mistakes
        $module->lessons()->create([
            'title' => 'Opening Mistakes',
            'slug' => 'opening-mistakes',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 4,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Moving the Same Piece Twice',
                        'content' => '<p>Every time you move the same piece again, your opponent develops a new piece. After just a few wasted moves, you can be <strong>three tempi behind</strong> in development. The exception: if you are winning material or delivering a serious threat.</p>',
                        'diagram' => 'rnbqkb1r/pppppppp/5n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
                    ],
                    [
                        'title' => 'The Premature Queen Sortie',
                        'content' => '<p>Bringing the queen out before developing minor pieces is the most common beginner mistake. After 1.e4 e5 2.Qh5?!, Black plays 2...Nc6 developing with tempo (attacking the queen). The queen must retreat, wasting time.</p><p>The queen is too valuable to risk early — every piece that attacks it gains a tempo.</p>',
                        'diagram' => 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
                        'highlights' => ['h5'],
                    ],
                    [
                        'title' => 'Neglecting Development for Pawns',
                        'content' => '<p>Grabbing pawns in the opening while ignoring development is called <strong>"pawn grabbing"</strong>. While material matters, falling behind in development can be fatal. A famous example: the Sicilian Defense 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 — both sides balance material and development.</p>',
                    ],
                    [
                        'title' => 'Weakening the King Position',
                        'content' => '<p>Avoid these king-weakening moves in the opening:</p><ul><li><strong>f3/f6</strong>: Weakens the king diagonal and takes away a natural knight square</li><li><strong>Premature h4/h5</strong>: Weakens the castled king position</li><li><strong>g4/g5 without reason</strong>: Exposes the king to diagonal attacks</li></ul><p>Every pawn move creates a permanent weakness — think twice before pushing pawns near your king.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of opening mistakes.</p>',
                        'quiz' => [
                            'question' => 'Why is 2.Qh5 a poor move in the opening?',
                            'options' => ['It puts the queen in danger of checkmate', 'The queen can be chased with developing moves, wasting tempo', 'The queen is too weak in the opening', 'It blocks the f-pawn'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Opening Puzzles
        $module->lessons()->create([
            'title' => 'Opening Puzzles',
            'slug' => 'opening-principles-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 5,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 110,
            'content_data' => [
                'puzzles' => [
                    [
                        // Scholar's Mate defense — Black to play: develop and defend f7
                        'fen' => 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
                        'solution' => ['Qe7'],
                        'hints' => ['White threatens Qxf7#.', 'Defend f7 while developing — the queen on e7 blocks the mate and prepares ...Nf6.'],
                    ],
                    [
                        // Punish early queen: White to play Nc3 developing with tempo
                        'fen' => 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3',
                        'solution' => ['Nf3'],
                        'hints' => ['Black\'s queen came out too early.', 'Develop a piece that attacks the queen, gaining tempo.'],
                    ],
                    [
                        // Take advantage of uncastled king: open the center
                        'fen' => 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq - 4 4',
                        'solution' => ['dxe5'],
                        'hints' => ['Black has not castled yet.', 'Open the center to exploit Black\'s exposed king — dxe5 attacks the knight and opens lines.'],
                    ],
                    [
                        // Development advantage: White exploits lead with central break
                        'fen' => 'r2qkb1r/pppn1ppp/4pn2/3p4/3PP3/2NB1N2/PPP2PPP/R1BQK2R w KQkq - 2 6',
                        'solution' => ['e5'],
                        'hints' => ['White is fully developed; Black\'s pieces are cramped.', 'Push e5 to gain space and attack the f6-knight, exploiting your development advantage.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 7 — Popular Openings (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedPopularOpenings(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Popular Openings',
            'slug' => 'popular-openings',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Learn the key ideas behind four of the most popular chess openings played at every level.',
            'icon' => "\u{1F4DA}",
            'sort_order' => 7,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 65,
        ]);

        // Lesson 1 — Italian Game
        $module->lessons()->create([
            'title' => 'Italian Game',
            'slug' => 'italian-game',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Italian Setup',
                        'content' => '<p>The <strong>Italian Game</strong> arises after 1.e4 e5 2.Nf3 Nc6 3.Bc4. White develops the bishop to an aggressive square targeting f7, the weakest point in Black\'s position (defended only by the king).</p><p>This is one of the oldest known openings, dating back to 16th-century Italian masters.</p>',
                        'diagram' => 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
                        'highlights' => ['c4', 'f7'],
                    ],
                    [
                        'title' => 'The Giuoco Piano',
                        'content' => '<p>After 3...Bc5, we reach the <strong>Giuoco Piano</strong> ("quiet game"). Both sides develop naturally. White typically plays c3 and d4 to build a strong center, while Black aims for ...d6, ...Nf6, and kingside castling.</p><p>Key plans for White: d4 pawn break, attack on f7, central control. Key plans for Black: hold the center, develop harmoniously, look for ...d5 counter-strike.</p>',
                        'diagram' => 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
                    ],
                    [
                        'title' => 'The Fried Liver Attack',
                        'content' => '<p>After 3...Nf6 (Two Knights Defense), White can try the sharp <strong>Fried Liver Attack</strong>: 4.Ng5! threatening Nxf7. If Black plays 4...d5 5.exd5 Nxd5?? 6.Nxf7! Kxf7 7.Qf3+, White gets a devastating attack against the exposed king.</p><p>This tactical line demonstrates why f7 is such a critical square in the opening.</p>',
                        'diagram' => 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4',
                        'highlights' => ['g5', 'f7'],
                    ],
                    [
                        'title' => 'Key Ideas to Remember',
                        'content' => '<p>In the Italian Game:</p><ul><li><strong>f7 is the target</strong>: The Bc4 + Qf3/Qb3 battery is a recurring threat</li><li><strong>d4 is the key break</strong>: White aims to play c3 + d4 for a strong center</li><li><strong>Development over material</strong>: In sharp lines like the Fried Liver, sacrifices for development are common</li><li><strong>Castle early</strong>: Both sides should castle kingside within the first 6-8 moves</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your Italian Game knowledge.</p>',
                        'quiz' => [
                            'question' => 'In the Italian Game, which square does White\'s bishop on c4 primarily target?',
                            'options' => ['d5', 'e6', 'f7', 'g8'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Sicilian Defense
        $module->lessons()->create([
            'title' => 'Sicilian Defense',
            'slug' => 'sicilian-defense',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 2,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Sicilian: 1...c5',
                        'content' => '<p>The <strong>Sicilian Defense</strong> (1.e4 c5) is the most popular response to 1.e4 at every level. Black immediately fights for the center by attacking d4 with a wing pawn, creating an <strong>asymmetrical position</strong> with chances for both sides.</p>',
                        'diagram' => 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
                        'highlights' => ['c5', 'e4'],
                    ],
                    [
                        'title' => 'The Open Sicilian',
                        'content' => '<p>After 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4, the <strong>Open Sicilian</strong> is the main line. Black gets a semi-open c-file and a queenside pawn majority. White gets a central space advantage and kingside attacking chances.</p><p>The imbalance creates rich, dynamic play: White attacks the kingside, Black counter-attacks on the queenside.</p>',
                        'diagram' => 'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4',
                    ],
                    [
                        'title' => 'Najdorf Variation',
                        'content' => '<p>The <strong>Najdorf</strong> (5...a6) is the most popular and theoretically deep Sicilian line, favored by world champions from Bobby Fischer to Magnus Carlsen. The move 5...a6 prepares ...e5 or ...b5, keeping maximum flexibility.</p><p>After 5.Nc3 a6, Black has a huge range of plans depending on White\'s response.</p>',
                        'diagram' => 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
                    ],
                    [
                        'title' => 'Sicilian Key Concepts',
                        'content' => '<p>Essential Sicilian ideas:</p><ul><li><strong>Asymmetry</strong>: Black\'s c-pawn exchanged for White\'s d-pawn creates imbalanced structures</li><li><strong>Queenside counterplay</strong>: Black uses the half-open c-file and ...b5-b4 expansion</li><li><strong>Timing of ...d5</strong>: The freeing break ...d5 equalizes if timed correctly</li><li><strong>Dragon pawn storm</strong>: In the Dragon variation, both sides launch pawn storms on opposite wings</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your Sicilian Defense knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is the strategic idea behind 1...c5 in the Sicilian Defense?',
                            'options' => ['To develop the queen early', 'To fight for the d4 square with a wing pawn, creating asymmetry', 'To protect the king', 'To fianchetto the bishop'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Queen's Gambit
        $module->lessons()->create([
            'title' => 'Queen\'s Gambit',
            'slug' => 'queens-gambit',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 3,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Queen\'s Gambit: 1.d4 d5 2.c4',
                        'content' => '<p>The <strong>Queen\'s Gambit</strong> is one of the oldest and most respected openings. White offers the c4-pawn to lure Black\'s d5-pawn away from the center. Despite the name, it is not a true gambit because White can always regain the pawn.</p>',
                        'diagram' => 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
                        'highlights' => ['c4', 'd5'],
                    ],
                    [
                        'title' => 'Queen\'s Gambit Declined',
                        'content' => '<p>After 2...e6 (the <strong>QGD</strong>), Black solidly defends d5 but locks in the light-squared bishop. The main challenge for Black is activating this "bad" bishop. White typically develops Nc3, Bg5, e3, and aims for a slow positional squeeze.</p><p>The QGD is extremely solid and reliable at all levels.</p>',
                        'diagram' => 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
                    ],
                    [
                        'title' => 'Queen\'s Gambit Accepted',
                        'content' => '<p>After 2...dxc4 (the <strong>QGA</strong>), Black takes the pawn but gives up the center. White plays e3 and Bxc4 to regain the pawn, achieving a strong central position. Black aims for ...b5 to hold the extra pawn or ...c5 to challenge the center.</p>',
                        'diagram' => 'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
                        'highlights' => ['c4', 'd4'],
                    ],
                    [
                        'title' => 'Slav Defense',
                        'content' => '<p>The <strong>Slav Defense</strong> (2...c6) defends d5 without locking in the light-squared bishop — it can still develop to f5 or g4. After 3.Nf3 Nf6 4.Nc3 dxc4, Black can try to hold the extra pawn with ...b5.</p><p>The Slav is one of the most popular responses to the Queen\'s Gambit at the highest level.</p>',
                        'diagram' => 'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your Queen\'s Gambit knowledge.</p>',
                        'quiz' => [
                            'question' => 'In the Queen\'s Gambit Declined (2...e6), what is Black\'s main strategic challenge?',
                            'options' => ['Defending the king', 'Activating the light-squared bishop locked behind the e6-pawn', 'Controlling the c-file', 'Developing the queen'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — French Defense
        $module->lessons()->create([
            'title' => 'French Defense',
            'slug' => 'french-defense',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 4,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The French: 1.e4 e6',
                        'content' => '<p>The <strong>French Defense</strong> (1.e4 e6) prepares ...d5, immediately challenging White\'s e4-pawn. After 2.d4 d5, the central tension creates a rich strategic battle. Black gets a solid but somewhat cramped position.</p>',
                        'diagram' => 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
                        'highlights' => ['e6', 'e4'],
                    ],
                    [
                        'title' => 'The Advance Variation',
                        'content' => '<p>After 1.e4 e6 2.d4 d5 3.e5, White gains space but creates a fixed pawn chain. Black\'s key plan is to attack the base of the chain with <strong>...c5</strong>, undermining White\'s center. This is a fundamental pawn structure concept.</p><p>The battle centers around White\'s space advantage vs. Black\'s pawn breaks.</p>',
                        'diagram' => 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
                        'highlights' => ['e5', 'c7'],
                    ],
                    [
                        'title' => 'The Winawer Variation',
                        'content' => '<p>After 3.Nc3 Bb4, the <strong>Winawer Variation</strong> is one of the sharpest lines in the French. Black pins the knight and creates immediate tension. After 4.e5 c5, play becomes highly tactical with both sides having clear plans.</p><p>White typically plays on the kingside, while Black attacks the d4-pawn with ...c5, ...Nc6, and ...Qc7.</p>',
                        'diagram' => 'rnbqk1nr/pppp1ppp/4p3/8/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 3',
                    ],
                    [
                        'title' => 'French Defense Key Ideas',
                        'content' => '<p>Essential French Defense concepts:</p><ul><li><strong>The "bad" bishop</strong>: Black\'s light-squared bishop is blocked by the e6-pawn; exchanging or activating it is a major theme</li><li><strong>...c5 break</strong>: Always the key pawn break, attacking White\'s d4-pawn</li><li><strong>...f6 break</strong>: In the Advance variation, ...f6 challenges the e5-pawn</li><li><strong>Pawn chains</strong>: Understanding how to attack at the base of a pawn chain is critical</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your French Defense knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is Black\'s most important pawn break in the French Defense?',
                            'options' => ['...a5', '...b5', '...c5', '...f5'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Opening Repertoire (puzzle)
        $module->lessons()->create([
            'title' => 'Opening Repertoire',
            'slug' => 'opening-repertoire-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 6,
            'sort_order' => 5,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 120,
            'content_data' => [
                'puzzles' => [
                    [
                        // Italian Game: exploit f7 weakness
                        'fen' => 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
                        'solution' => ['dxe5'],
                        'hints' => ['The center is tense — open it while Black is uncastled.', 'Capture on e5, attacking the knight and opening the position.'],
                    ],
                    [
                        // Sicilian: find the key central break
                        'fen' => 'r1bqkb1r/1p1npppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 2 7',
                        'solution' => ['f3'],
                        'hints' => ['White wants to prepare a powerful center.', 'f3 supports e4 and prepares g4 and Qd2 for an English Attack setup.'],
                    ],
                    [
                        // Queen's Gambit: regain the pawn with development
                        'fen' => 'rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 3',
                        'solution' => ['e3'],
                        'hints' => ['White has given up the c-pawn but can regain it.', 'Play e3 to open the diagonal for Bxc4, recovering the pawn with a strong center.'],
                    ],
                    [
                        // French Defense: attack the pawn chain base
                        'fen' => 'r1bqk1nr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 0 5',
                        'solution' => ['cxd4'],
                        'hints' => ['Attack the base of White\'s pawn chain.', 'cxd4 undermines the e5-pawn and opens lines for Black\'s pieces.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 8 — Intermediate Tactics (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedIntermediateTactics(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Intermediate Tactics',
            'slug' => 'intermediate-tactics',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Advance your tactical vision with deflection, decoys, removing the defender, Zwischenzug, and multi-move combinations.',
            'icon' => "\u{2694}\u{FE0F}",
            'sort_order' => 8,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 60,
        ]);

        // Lesson 1 — Deflection & Decoy
        $module->lessons()->create([
            'title' => 'Deflection & Decoy',
            'slug' => 'deflection-and-decoy',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Deflection',
                        'content' => '<p>A <strong>deflection</strong> forces an enemy piece away from a critical defensive duty. You lure the defender to a different square, leaving the original target unprotected.</p><p>For example, if a rook is the only piece guarding the back rank, a sacrifice can deflect it, allowing a back-rank mate.</p>',
                        'diagram' => '1r2r1k1/5ppp/8/8/8/8/5PPP/1R2R1K1 w - - 0 1',
                        'highlights' => ['b8', 'e8'],
                    ],
                    [
                        'title' => 'Deflection in Action',
                        'content' => '<p>In this position, White plays <strong>Rb8!</strong> — the rook sacrifice deflects Black\'s rook from guarding e8. After ...Rxb8, Re8+ leads to Rxb8 and back-rank mate.</p><p>The key insight: identify what a piece is defending, then ask <em>"Can I force it away?"</em></p>',
                        'diagram' => '1r2r1k1/5ppp/8/8/8/8/5PPP/1R2R1K1 w - - 0 1',
                    ],
                    [
                        'title' => 'Decoy',
                        'content' => '<p>A <strong>decoy</strong> lures an enemy piece <em>to</em> a specific square where it becomes vulnerable. Unlike deflection (forcing a piece away), a decoy draws a piece into a trap.</p><p>Classic example: sacrificing a queen on a square to lure the king into a fork or discovered attack.</p>',
                        'diagram' => '6k1/5p1p/4p1pB/8/8/8/q4PPP/4R1K1 w - - 0 1',
                    ],
                    [
                        'title' => 'Recognizing Overloaded Pieces',
                        'content' => '<p>Both deflection and decoy exploit <strong>overloaded pieces</strong> — pieces performing too many defensive tasks at once. To spot these opportunities:</p><ul><li>Identify which piece guards each critical square or piece</li><li>Check if that defender has a <strong>second</strong> defensive duty</li><li>If so, attack one duty to overwhelm the defender</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your deflection and decoy knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is the difference between deflection and decoy?',
                            'options' => ['They are the same thing', 'Deflection forces a piece away from its duty; decoy lures a piece to a bad square', 'Decoy forces a piece away; deflection lures it', 'Neither involves sacrifices'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Removing the Defender
        $module->lessons()->create([
            'title' => 'Removing the Defender',
            'slug' => 'removing-the-defender',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 2,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Eliminate the Guard',
                        'content' => '<p><strong>Removing the defender</strong> means capturing, exchanging, or driving away the piece that protects a key square or piece. Once the defender is gone, the target falls.</p><p>This is one of the most fundamental tactical patterns — always check what is defending your target.</p>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7',
                    ],
                    [
                        'title' => 'Capture the Defender',
                        'content' => '<p>The simplest method: <strong>capture the defending piece</strong> directly. If a knight on f6 is the only piece defending h7, exchanging that knight opens h7 to attack.</p><p>Example: After Bxf6 gxf6, the h7-pawn is now undefended and White can play Qh7#.</p>',
                        'diagram' => 'r1bq1rk1/ppppnppp/4p3/6B1/3PP3/2N5/PPP2PPP/R2QKB1R w KQ - 0 7',
                        'highlights' => ['g5', 'e7'],
                    ],
                    [
                        'title' => 'Exchange the Defender',
                        'content' => '<p>Sometimes you need to <strong>exchange</strong> your piece for the defender, even if it seems equal. The resulting position may give you a decisive tactical blow that more than compensates for the trade.</p><p>Think two moves ahead: "If I remove this defender, what does that allow me to do next?"</p>',
                    ],
                    [
                        'title' => 'Practical Pattern',
                        'content' => '<p>A common pattern in many openings: the knight on f6 defends both d5 and h7. By exchanging or driving away this knight, White can either occupy d5 with a piece or launch a kingside attack against h7.</p><p>Always scan the board for pieces performing critical defensive duties and look for ways to eliminate them.</p>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 0 7',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of removing the defender.</p>',
                        'quiz' => [
                            'question' => 'If a knight on f6 is the only defender of h7, what should you consider?',
                            'options' => ['Ignore it and attack elsewhere', 'Exchange or drive away the f6-knight to expose h7', 'Move your own knight to f6', 'Defend your own h-pawn first'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Zwischenzug
        $module->lessons()->create([
            'title' => 'Zwischenzug',
            'slug' => 'zwischenzug',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 3,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The In-Between Move',
                        'content' => '<p>A <strong>Zwischenzug</strong> (German for "in-between move") is an unexpected intermediate move played before the expected recapture or continuation. Instead of the "obvious" reply, you insert a move that improves your position.</p><p>Zwischenzug is one of the most important tactical concepts in intermediate chess.</p>',
                    ],
                    [
                        'title' => 'Check as Zwischenzug',
                        'content' => '<p>The most common Zwischenzug is an <strong>intermediate check</strong>. Before recapturing a piece, you play a check first, forcing your opponent to deal with it. Then you recapture under better conditions.</p><p>Example: after an exchange on d5, instead of recapturing immediately, you play Bb5+ first. After the king or a piece blocks, then you recapture on d5 with an extra tempo.</p>',
                        'diagram' => 'r1bqkb1r/pp3ppp/2n1pn2/1B1p4/3P4/2N2N2/PPP2PPP/R1BQK2R b KQkq - 0 6',
                        'highlights' => ['b5'],
                    ],
                    [
                        'title' => 'Zwischenzug in Exchanges',
                        'content' => '<p>During piece exchanges, always ask: <em>"Do I have to recapture immediately?"</em> Often, you can insert a threat, check, or capture elsewhere that changes the evaluation entirely.</p><ul><li>Before recapturing, look for checks</li><li>Look for threats to more valuable pieces</li><li>Look for pawn captures that come with tempo</li></ul>',
                    ],
                    [
                        'title' => 'Defending Against Zwischenzug',
                        'content' => '<p>To defend against Zwischenzug:</p><ul><li>Before making a capture, consider: "What if my opponent does NOT recapture?"</li><li>Calculate one move deeper than the "automatic" continuation</li><li>Be especially careful when your king is exposed — intermediate checks are likely</li></ul><p>Many games are lost because a player assumed their opponent would recapture automatically.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your Zwischenzug knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is a Zwischenzug?',
                            'options' => ['A type of checkmate pattern', 'An unexpected intermediate move inserted before the expected continuation', 'A German word for castling', 'An opening trap'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Combinations
        $module->lessons()->create([
            'title' => 'Combinations',
            'slug' => 'tactical-combinations',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 4,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is a Combination?',
                        'content' => '<p>A <strong>combination</strong> is a forced sequence of moves, usually involving a sacrifice, that leads to a concrete advantage. Unlike simple one-move tactics, combinations chain multiple tactical motifs together over several moves.</p><p>Combinations are the most beautiful aspect of chess — they combine vision, calculation, and creativity.</p>',
                    ],
                    [
                        'title' => 'The Three Elements',
                        'content' => '<p>Every combination has three elements:</p><ol><li><strong>Precondition</strong>: A weakness or vulnerability in the opponent\'s position (exposed king, overloaded piece, weak back rank)</li><li><strong>Sacrifice</strong>: An investment of material to exploit the weakness</li><li><strong>Payoff</strong>: The concrete advantage gained (checkmate, material, positional dominance)</li></ol>',
                    ],
                    [
                        'title' => 'A Classic Combination',
                        'content' => '<p>One of the most famous combinations: White plays <strong>Bxh7+!</strong> (the Greek Gift sacrifice). After ...Kxh7, Ng5+ Kg8, Qh5 threatens Qh7# and Qxf7#. The exposed king has no safe squares.</p><p>This combination chains: sacrifice on h7, knight check on g5, queen attack on h5.</p>',
                        'diagram' => 'r1bq1rk1/pppn1ppp/4pn2/3p2B1/1b1P4/2NB1N2/PPP2PPP/R2Q1RK1 w - - 0 8',
                        'highlights' => ['d3', 'h7'],
                    ],
                    [
                        'title' => 'How to Calculate Combinations',
                        'content' => '<p>To find combinations, use this systematic approach:</p><ul><li><strong>Scan for targets</strong>: Exposed king, hanging pieces, overloaded defenders</li><li><strong>Check all forcing moves</strong>: Checks, captures, and threats first</li><li><strong>Visualize the position</strong>: After each move, picture the resulting board</li><li><strong>Verify the final position</strong>: Make sure the payoff is real and there are no defensive resources</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your combination knowledge.</p>',
                        'quiz' => [
                            'question' => 'What are the three elements of every combination?',
                            'options' => ['Opening, middlegame, endgame', 'Precondition, sacrifice, payoff', 'Check, capture, promotion', 'Fork, pin, skewer'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Tactics Test (puzzle)
        $module->lessons()->create([
            'title' => 'Tactics Test',
            'slug' => 'intermediate-tactics-test',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 6,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 120,
            'content_data' => [
                'puzzles' => [
                    [
                        // Deflection: sacrifice rook to deflect, then back-rank mate
                        'fen' => '3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1',
                        'solution' => ['Rd8'],
                        'hints' => ['The rook on d8 guards the back rank.', 'Deflect it with Rd8! After ...Rxd8, Re8+ leads to mate.'],
                    ],
                    [
                        // Remove the defender: capture the knight defending d5
                        'fen' => 'r2qk2r/ppp1bppp/2n1pn2/3pN3/3P1B2/2N5/PPP2PPP/R2QR1K1 w kq - 4 8',
                        'solution' => ['Nxc6'],
                        'hints' => ['The knight on c6 is a key defender.', 'Capture the knight — after ...bxc6, the d5-pawn is weakened and e5 becomes available.'],
                    ],
                    [
                        // Zwischenzug: intermediate check before recapturing
                        'fen' => 'r1b1kb1r/ppqp1ppp/2n1pn2/2p5/4PB2/2N2N2/PPP2PPP/R2QKB1R w KQkq - 0 6',
                        'solution' => ['e5'],
                        'hints' => ['Instead of a quiet move, look for a forcing advance.', 'e5 attacks the f6-knight with tempo while opening lines.'],
                    ],
                    [
                        // Combination: Bxh7+ Greek Gift pattern
                        'fen' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P1B2/2NBPN2/PPP2PPP/R2Q1RK1 w - - 0 8',
                        'solution' => ['Bxh7+'],
                        'hints' => ['The classic Greek Gift sacrifice is available.', 'After Bxh7+! Kxh7, Ng5+ opens a devastating attack on the exposed king.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 9 — Positional Play (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedPositionalPlay(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Positional Play',
            'slug' => 'positional-play',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Learn the strategic building blocks of chess: pawn structure, weak squares, open files, and the bishop pair.',
            'icon' => "\u{1F3F0}",
            'sort_order' => 9,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 65,
        ]);

        // Lesson 1 — Pawn Structure
        $module->lessons()->create([
            'title' => 'Pawn Structure',
            'slug' => 'pawn-structure',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Pawns Are the Soul of Chess',
                        'content' => '<p>Philidor said: <em>"Pawns are the soul of chess."</em> Pawn structure determines the character of the position — whether it is open or closed, which pieces are good or bad, and where to attack.</p><p>Unlike pieces, pawns <strong>cannot move backwards</strong>. Every pawn move is permanent, so think carefully before pushing.</p>',
                        'diagram' => 'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3',
                    ],
                    [
                        'title' => 'Doubled Pawns',
                        'content' => '<p><strong>Doubled pawns</strong> occur when two pawns of the same color are on the same file. They are usually a weakness because:</p><ul><li>The rear pawn cannot protect the front one</li><li>They cannot create a passed pawn as easily</li><li>They are harder to advance</li></ul><p>However, doubled pawns can control key central squares and open files for rooks.</p>',
                        'diagram' => '8/pp3ppp/4p3/3pP3/3P4/2P5/PP3PPP/8 w - - 0 1',
                        'highlights' => ['c3', 'c2'],
                    ],
                    [
                        'title' => 'Isolated Pawns',
                        'content' => '<p>An <strong>isolated pawn</strong> has no friendly pawns on adjacent files. It must be defended by pieces, tying them down. The square directly in front of an isolated pawn is a powerful <strong>blockade square</strong> for the opponent.</p><p>The <strong>isolated d-pawn</strong> (IQP) is the most common type, arising from many openings. It gives dynamic piece play but creates a long-term weakness.</p>',
                        'diagram' => 'r1bq1rk1/pp3ppp/2n1pn2/8/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 8',
                        'highlights' => ['d4'],
                    ],
                    [
                        'title' => 'Passed Pawns and Pawn Majorities',
                        'content' => '<p>A <strong>passed pawn</strong> has no opposing pawns blocking or controlling its advance. Passed pawns are powerful — they threaten to promote and must be watched constantly.</p><p>A <strong>pawn majority</strong> (e.g., 3 pawns vs 2 on the queenside) can create a passed pawn by advancing. Understanding how to create and exploit pawn majorities is essential.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your pawn structure knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is an isolated pawn?',
                            'options' => ['A pawn that has been promoted', 'A pawn with no friendly pawns on adjacent files', 'A pawn that is doubled', 'A pawn that cannot move forward'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Weak Squares
        $module->lessons()->create([
            'title' => 'Weak Squares',
            'slug' => 'weak-squares',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 2,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is a Weak Square?',
                        'content' => '<p>A <strong>weak square</strong> (or "hole") is a square that can no longer be controlled by pawns. Once pawns have advanced past a square, they can never go back to defend it. These squares become ideal outposts for enemy pieces.</p>',
                        'diagram' => 'r1bqkb1r/pp3ppp/2n1pn2/3p4/3P4/4PN2/PPP1BPPP/RNBQK2R w KQkq - 0 5',
                    ],
                    [
                        'title' => 'Outposts',
                        'content' => '<p>An <strong>outpost</strong> is a weak square in the opponent\'s territory where you can place a piece (typically a knight) that cannot be driven away by pawns. A knight on an outpost is often worth more than a bishop.</p><p>After ...e5 dxe5, the d5 square becomes a permanent outpost for White\'s knight.</p>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2n2n2/3Np3/3P4/4PN2/PPP2PPP/R1BQKB1R b - - 0 7',
                        'highlights' => ['d5'],
                    ],
                    [
                        'title' => 'Creating Weak Squares',
                        'content' => '<p>You can create weak squares in your opponent\'s position by:</p><ul><li><strong>Provoking pawn advances</strong>: Force your opponent to push pawns, leaving holes behind</li><li><strong>Exchanging pawns</strong>: Trade pawns that control key squares</li><li><strong>Pawn breaks</strong>: Open the position to exploit the resulting weaknesses</li></ul><p>For example, playing h4-h5 against a g6-pawn structure can weaken the f6 and h6 squares.</p>',
                    ],
                    [
                        'title' => 'Exploiting Weak Squares',
                        'content' => '<p>Once you identify a weak square:</p><ol><li><strong>Place a piece on it</strong> (especially a knight)</li><li><strong>Use it as a pivot</strong> to switch the attack to different parts of the board</li><li><strong>Coordinate pieces around it</strong> to create a dominant position</li></ol><p>A piece firmly planted on a weak square in the opponent\'s camp can paralyze their entire position.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your weak squares knowledge.</p>',
                        'quiz' => [
                            'question' => 'What makes a square "weak"?',
                            'options' => ['It is occupied by an enemy piece', 'It can no longer be controlled by friendly pawns', 'It is on the edge of the board', 'It is near the king'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Open Files
        $module->lessons()->create([
            'title' => 'Open Files',
            'slug' => 'open-files-and-ranks',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 3,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Open and Half-Open Files',
                        'content' => '<p>An <strong>open file</strong> is a file with no pawns. A <strong>half-open file</strong> has only one side\'s pawn. Rooks and queens dominate on open files because they can penetrate into the opponent\'s position.</p><p>Controlling an open file is like controlling a highway — your heavy pieces can move freely up and down it.</p>',
                        'diagram' => 'r3r1k1/pp3ppp/2p5/8/8/2P5/PP3PPP/R3R1K1 w - - 0 1',
                        'highlights' => ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
                    ],
                    [
                        'title' => 'Doubling Rooks',
                        'content' => '<p><strong>Doubling rooks</strong> on an open file (stacking them on the same file) creates tremendous pressure. The front rook is supported by the one behind, making it very hard for the opponent to contest the file.</p><p>The ideal setup: two rooks on an open file with a queen behind them.</p>',
                        'diagram' => '4r1k1/pp3ppp/2p5/8/8/2P5/PP3PPP/R1R3K1 w - - 0 1',
                    ],
                    [
                        'title' => 'The 7th Rank',
                        'content' => '<p>A rook on the <strong>7th rank</strong> (2nd rank from the opponent\'s perspective) is one of the most powerful pieces in chess. From there, it attacks all the opponent\'s pawns (which are usually on their starting rank) and cuts off the enemy king.</p><p>Two rooks on the 7th rank is often called "pigs on the 7th" and is usually decisive.</p>',
                        'diagram' => '6k1/1R3ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
                        'highlights' => ['b7'],
                    ],
                    [
                        'title' => 'Seizing Open Files',
                        'content' => '<p>When a file opens (usually from a pawn exchange), <strong>be first to occupy it</strong> with a rook. The player who controls the open file dictates the play. If your opponent contests the file, exchanging rooks may be acceptable if it serves your plan.</p><p>Plan pawn exchanges to open files near your opponent\'s weaknesses.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your open file knowledge.</p>',
                        'quiz' => [
                            'question' => 'Why is a rook on the 7th rank so powerful?',
                            'options' => ['It is close to the opponent\'s king', 'It attacks pawns on their starting rank and cuts off the king', 'It controls more squares', 'It cannot be captured'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Good vs Bad Bishops
        $module->lessons()->create([
            'title' => 'Good vs Bad Bishops',
            'slug' => 'good-vs-bad-bishops',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 4,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Good Bishop vs Bad Bishop',
                        'content' => '<p>A <strong>good bishop</strong> operates on squares of the opposite color to its own pawns, allowing it free movement. A <strong>bad bishop</strong> is on the same color as its pawns, blocked and restricted by them.</p><p>In the French Defense pawn structure (pawns on e6/d5), Black\'s light-squared bishop is the classic "bad bishop."</p>',
                        'diagram' => 'r1bq1rk1/pp3ppp/2n1p3/3p4/3P4/2P1PN2/P4PPP/R1BQKB1R w KQ - 0 7',
                    ],
                    [
                        'title' => 'The Bishop Pair',
                        'content' => '<p>Having <strong>both bishops</strong> (the "bishop pair") is a significant advantage, especially in open positions. Two bishops cover all square colors and work powerfully together on diagonals. The bishop pair gains value as the position opens up.</p><p>As a guideline, the bishop pair is worth approximately <strong>half a pawn</strong> extra.</p>',
                    ],
                    [
                        'title' => 'Activating a Bad Bishop',
                        'content' => '<p>If you have a bad bishop, try to improve it:</p><ul><li><strong>Exchange it</strong>: Trade the bad bishop for the opponent\'s good bishop</li><li><strong>Place it outside the pawn chain</strong>: Move it to an active diagonal before your pawns lock it in</li><li><strong>Change the pawn structure</strong>: Break with pawns to free the bishop\'s diagonals</li></ul>',
                        'diagram' => 'r1bq1rk1/pp3ppp/2n1pn2/3p4/3P1B2/2PBPN2/PP3PPP/R2Q1RK1 b - - 0 8',
                        'highlights' => ['f4'],
                    ],
                    [
                        'title' => 'Bishop vs Knight',
                        'content' => '<p>In <strong>open positions</strong> (few pawns, long diagonals), bishops are generally stronger than knights. In <strong>closed positions</strong> (locked pawn chains, few open lines), knights are better because they can jump over pawns.</p><p>When choosing whether to keep a bishop or knight, assess the position: open or closed?</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your bishop knowledge.</p>',
                        'quiz' => [
                            'question' => 'When is a bishop considered "bad"?',
                            'options' => ['When it has just been developed', 'When it is on the same color as its own pawns and blocked by them', 'When it is on the edge of the board', 'When it is facing an enemy knight'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Positional Puzzles
        $module->lessons()->create([
            'title' => 'Positional Puzzles',
            'slug' => 'positional-play-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 6,
            'sort_order' => 5,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 120,
            'content_data' => [
                'puzzles' => [
                    [
                        // Occupy the outpost: knight to d5
                        'fen' => 'r1bq1rk1/pp3ppp/2n1p3/3n4/3P4/2N1BN2/PP3PPP/R2QR1K1 w - - 0 10',
                        'solution' => ['Nxd5'],
                        'hints' => ['The d5 square is a powerful outpost.', 'Exchange the knight on d5, then place your own piece there — Nxd5 exd5 gives you a target.'],
                    ],
                    [
                        // Rook to 7th rank
                        'fen' => '4r1k1/pp3ppp/4p3/8/3R4/4P3/PP3PPP/6K1 w - - 0 1',
                        'solution' => ['Rd7'],
                        'hints' => ['The 7th rank is available for your rook.', 'Rd7 attacks the b7 and f7 pawns simultaneously.'],
                    ],
                    [
                        // Open file: seize the d-file
                        'fen' => 'r3r1k1/pp3ppp/2p2n2/8/3P4/2P2N2/PP3PPP/R3R1K1 w - - 0 1',
                        'solution' => ['Rad1'],
                        'hints' => ['The d-file is open and uncontested.', 'Rad1 doubles rooks on the d-file, preparing to penetrate.'],
                    ],
                    [
                        // Exchange the bad bishop
                        'fen' => 'r1bq1rk1/pp3ppp/2n1p3/3p4/3P4/1PN1PN2/PB3PPP/R2Q1RK1 b - - 0 8',
                        'solution' => ['Ba6'],
                        'hints' => ['Black\'s light-squared bishop is restricted.', 'Ba6 activates the "bad" bishop by placing it outside the pawn chain and targeting White\'s b-pawn.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 10 — Attack & Defense (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedAttackAndDefense(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Attack & Defense',
            'slug' => 'attack-and-defense',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Learn the art of attacking the king and the essential defensive techniques to save difficult positions.',
            'icon' => "\u{1F6E1}\u{FE0F}",
            'sort_order' => 10,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 65,
        ]);

        // Lesson 1 — Attacking the King
        $module->lessons()->create([
            'title' => 'Attacking the King',
            'slug' => 'attacking-the-king',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'When to Attack',
                        'content' => '<p>A kingside attack is justified when you have <strong>at least two</strong> of these advantages:</p><ul><li>More pieces aimed at the king than your opponent has defending</li><li>The opponent\'s pawn shield is weakened (e.g., missing a pawn, or h6/g6 has been played)</li><li>A lead in development that you can exploit before they catch up</li><li>Open files or diagonals pointing at the king</li></ul>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p2B1/3P4/2N2N2/PPP1BPPP/R2Q1RK1 w - - 0 7',
                    ],
                    [
                        'title' => 'The Pawn Storm',
                        'content' => '<p>A <strong>pawn storm</strong> means advancing your pawns toward the opponent\'s king to pry open lines. This is most effective with <strong>opposite-side castling</strong>, where your pawns are attacking weapons, not defending your own king.</p><p>h4-h5 against a g6-king setup, or g4-g5 against a standard kingside, are classic pawn storm patterns.</p>',
                        'diagram' => '2kr3r/pppq1ppp/2n1pn2/3p4/3P1PP1/2NBPN2/PPP4P/R2QK2R w KQ - 0 9',
                        'highlights' => ['f4', 'g4'],
                    ],
                    [
                        'title' => 'Piece Coordination in Attack',
                        'content' => '<p>Successful attacks require <strong>piece coordination</strong>. The queen alone cannot mate — she needs helpers. A typical attacking formation might include:</p><ul><li>Queen + bishop battery on a diagonal toward the king</li><li>Rook(s) on open/half-open files near the king</li><li>Knight on an advanced square (f5, g5, h5) close to the action</li></ul>',
                    ],
                    [
                        'title' => 'Sacrificing to Open Lines',
                        'content' => '<p>One of the most powerful attacking ideas is to <strong>sacrifice material to open lines</strong> to the enemy king. The classic Bxh7+ sacrifice (Greek Gift) opens the h-file. Nxg7 or Bxg7 can rip open the kingside.</p><p>Before sacrificing, ensure you have enough pieces nearby to continue the attack — a sacrifice that fizzles is just losing material.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your attacking knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is the minimum advantage you typically need before launching a kingside attack?',
                            'options' => ['A material advantage of at least two pawns', 'At least two attacking preconditions (more attackers, weakened pawn shield, development lead, or open lines)', 'A passed pawn on the kingside', 'Control of the center only'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Defensive Techniques
        $module->lessons()->create([
            'title' => 'Defensive Techniques',
            'slug' => 'defensive-techniques',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 2,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Art of Defense',
                        'content' => '<p>Defense is just as important as attack. The greatest players (Petrosian, Karpov, Carlsen) are famous for their defensive skills. Good defense turns your opponent\'s attack into wasted energy, leaving them worse off.</p><p>Key principle: <strong>keep calm and find the toughest moves</strong>. Do not panic when under attack.</p>',
                    ],
                    [
                        'title' => 'Prophylaxis',
                        'content' => '<p><strong>Prophylaxis</strong> means preventing your opponent\'s plan before they execute it. Instead of only looking at your own ideas, ask: <em>"What does my opponent want to do?"</em> Then stop it.</p><p>Aron Nimzowitsch called this "the most important concept in chess strategy." A prophylactic move often looks quiet but is devastatingly effective.</p>',
                    ],
                    [
                        'title' => 'Defensive Resources',
                        'content' => '<p>When under attack, look for these defensive resources:</p><ul><li><strong>King flight</strong>: Sometimes the king is safer running to the center or the opposite wing</li><li><strong>Counter-threats</strong>: Create your own threats that force your opponent to deal with them</li><li><strong>Blockade</strong>: Use a piece (especially a knight) to block an advancing pawn or close a dangerous file</li><li><strong>Exchange attackers</strong>: Trade off your opponent\'s strongest attacking pieces</li></ul>',
                    ],
                    [
                        'title' => 'Trading Pieces When Under Attack',
                        'content' => '<p>When defending against an attack, <strong>exchange pieces</strong> — especially the attacking pieces. Each piece traded reduces the attacker\'s firepower. The defender often benefits from simplification because fewer pieces = fewer mating threats.</p><p>The queen is especially powerful in attacks. If you can trade queens, the attack usually evaporates.</p>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 b - - 0 7',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your defensive knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is prophylaxis in chess?',
                            'options' => ['A type of sacrifice', 'Preventing the opponent\'s plan before they execute it', 'An opening strategy', 'A checkmate pattern'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Sacrificial Attacks
        $module->lessons()->create([
            'title' => 'Sacrificial Attacks',
            'slug' => 'sacrificial-attacks',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 3,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Types of Sacrifices',
                        'content' => '<p>Sacrifices fall into two categories:</p><ul><li><strong>Tactical sacrifices</strong>: Concrete, calculated — you see a forced sequence leading to a clear advantage or mate. These are "real" sacrifices with a definite payoff.</li><li><strong>Positional sacrifices</strong>: Strategic — you give up material for long-term advantages like a strong attack, initiative, or dominant piece placement. The payoff is less concrete.</li></ul>',
                    ],
                    [
                        'title' => 'The Classic Bishop Sacrifice',
                        'content' => '<p>The <strong>Bxh7+</strong> sacrifice (Greek Gift) is the most common attacking sacrifice. Requirements for it to work:</p><ol><li>Bishop on d3 (or b1 diagonal) aiming at h7</li><li>Knight ready to jump to g5 after ...Kxh7</li><li>Queen ready to join the attack on the h-file</li><li>No adequate defensive resources for Black</li></ol>',
                        'diagram' => 'r1bq1rk1/pppn1ppp/4pn2/3p2B1/1b1P4/2NB1N2/PPP2PPP/R2Q1RK1 w - - 0 8',
                        'highlights' => ['d3', 'h7'],
                    ],
                    [
                        'title' => 'Rook Sacrifices',
                        'content' => '<p>Rook sacrifices on the castled king position are a recurring theme:</p><ul><li><strong>Rxh7+</strong> to rip open the h-file</li><li><strong>Rxg7+</strong> to destroy the pawn shield (especially when the bishop aims at the long diagonal)</li><li><strong>Back-rank sacrifices</strong> to set up deflections and mates</li></ul><p>Rook sacrifices require precise calculation because you are giving up significant material.</p>',
                    ],
                    [
                        'title' => 'Exchange Sacrifices',
                        'content' => '<p>The <strong>exchange sacrifice</strong> (giving a rook for a minor piece) is more subtle. You give up a rook (5 points) for a bishop or knight (3 points) to gain:</p><ul><li>A powerful minor piece (e.g., bishop on a long diagonal)</li><li>Structural damage to the opponent\'s position</li><li>Elimination of a key defensive piece</li></ul><p>Tigran Petrosian was the master of the exchange sacrifice — he used it as a positional tool.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your sacrifice knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is an exchange sacrifice?',
                            'options' => ['Trading queens', 'Giving a rook for a minor piece for positional compensation', 'Sacrificing a pawn in the opening', 'Any trade of pieces'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Counter-Play
        $module->lessons()->create([
            'title' => 'Counter-Play',
            'slug' => 'counter-play',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 4,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is Counter-Play?',
                        'content' => '<p><strong>Counter-play</strong> means creating your own threats and activity when your opponent is pressing you. Instead of passively defending, you force your opponent to worry about your threats too.</p><p>The best defense is often a counter-attack: if your opponent is attacking your kingside, launch an attack on the queenside or in the center.</p>',
                    ],
                    [
                        'title' => 'Central Counter-Strike',
                        'content' => '<p>The most effective counter-play against a wing attack is a <strong>central counter-strike</strong>. When your opponent pushes pawns on the flank, break open the center to exploit their loose king and overextended pieces.</p><p>Classical principle: "A flank attack is best met by a counter-strike in the center."</p>',
                        'diagram' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/3PP1b1/2NB1N2/PPP2PPP/R1BQ1RK1 b - - 0 6',
                    ],
                    [
                        'title' => 'Activity Over Material',
                        'content' => '<p>Sometimes the best counter-play involves <strong>sacrificing material</strong> to generate activity. A pawn sacrifice to open lines, or even an exchange sacrifice to eliminate a key defender, can turn a passive position into an active one.</p><p>When defending a worse position, look for ways to muddy the waters and create complications.</p>',
                    ],
                    [
                        'title' => 'Practical Counter-Play Tips',
                        'content' => '<p>Counter-play guidelines:</p><ul><li><strong>Target weaknesses</strong>: Even while defending, identify weak points in your opponent\'s position</li><li><strong>Keep pieces active</strong>: Do not let all your pieces become passive defenders</li><li><strong>Create threats</strong>: Even small threats force your opponent to spend time and resources</li><li><strong>Use time trouble</strong>: Counter-attacks create practical problems that are hard to solve under time pressure</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your counter-play knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is the classical response to a flank attack?',
                            'options' => ['Defend passively on the same side', 'A counter-strike in the center', 'Resign if the attack is strong', 'Mirror the attack on the opposite wing'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — A&D Puzzles
        $module->lessons()->create([
            'title' => 'A&D Puzzles',
            'slug' => 'attack-and-defense-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 6,
            'sort_order' => 5,
            'estimated_duration_minutes' => 13,
            'xp_reward' => 120,
            'content_data' => [
                'puzzles' => [
                    [
                        // King attack: Bxh7+ Greek Gift
                        'fen' => 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P1B2/2NBPN2/PPP2PPP/R2Q1RK1 w - - 0 8',
                        'solution' => ['Bxh7+'],
                        'hints' => ['The classic Greek Gift sacrifice is available.', 'After Bxh7+! Kxh7, Ng5+ Kg8, Qh5 creates an unstoppable attack.'],
                    ],
                    [
                        // Defense: find the only move to survive back-rank threat
                        'fen' => '6k1/5ppp/8/8/1q6/8/5PPP/1R3RK1 w - - 0 1',
                        'solution' => ['Rb8+'],
                        'hints' => ['Black threatens ...Qe1 with a back-rank mate.', 'Counter-attack with Rb8+! — the check forces Black to deal with the immediate threat.'],
                    ],
                    [
                        // Counter-play: central break under kingside pressure
                        'fen' => 'r1bq1rk1/pp3ppp/2n1p3/3pP3/3P2P1/2NB4/PPP2P1P/R1BQK2R b KQ g3 0 9',
                        'solution' => ['f6'],
                        'hints' => ['White is launching a kingside pawn storm with g4.', 'Strike back in the center with f6! undermining the e5-pawn and opening lines for your pieces.'],
                    ],
                    [
                        // Exchange sacrifice for positional dominance
                        'fen' => 'r1bq1rk1/pp2bppp/2n1p3/3pN3/3P4/2N5/PPP1BPPP/R1BQ1RK1 w - - 0 8',
                        'solution' => ['Nxc6'],
                        'hints' => ['Remove a key defender from Black\'s position.', 'Nxc6 bxc6 wrecks Black\'s pawn structure and opens the b-file.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 11 — Intermediate Endgames (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedIntermediateEndgames(TutorialModule $prerequisite): void
    {
        $module = TutorialModule::create([
            'name' => 'Intermediate Endgames',
            'slug' => 'intermediate-endgames',
            'skill_tier' => 'intermediate',
            'required_tier' => 'silver',
            'description' => 'Master rook endgames, bishop vs knight battles, passed pawns, and the critical rook+pawn vs rook ending.',
            'icon' => "\u{2654}",
            'sort_order' => 11,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 70,
        ]);

        // Lesson 1 — Rook Endgames
        $module->lessons()->create([
            'title' => 'Rook Endgames',
            'slug' => 'rook-endgames',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Rook Endgames Are the Most Common',
                        'content' => '<p>Rook endgames occur in roughly <strong>50% of all endgames</strong>. Understanding rook endgame principles is essential for improving your results. The fundamental rule: <strong>activate your rook</strong>. A passive rook defending a pawn is usually worse than an active rook attacking.</p>',
                        'diagram' => '8/5kpp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
                    ],
                    [
                        'title' => 'Lucena Position',
                        'content' => '<p>The <strong>Lucena Position</strong> is the most important winning technique in rook endgames. With a rook\'s pawn on the 7th rank and your king shielding it, you win by "building a bridge":</p><ol><li>Move your rook to the 4th rank (far from the enemy king)</li><li>Advance your king to the 8th rank</li><li>Use the rook to block enemy checks from the 4th rank</li></ol>',
                        'diagram' => '1K1k4/1P6/8/8/8/8/r7/3R4 w - - 0 1',
                        'highlights' => ['b7', 'b8', 'd1'],
                    ],
                    [
                        'title' => 'Philidor Position',
                        'content' => '<p>The <strong>Philidor Position</strong> is the most important drawing technique. With the defending king in front of the pawn, place your rook on the <strong>3rd rank</strong> (cutting off the enemy king). When the pawn advances to the 6th rank, drop the rook to the <strong>1st rank</strong> for infinite checks from behind.</p>',
                        'diagram' => '8/3k4/8/3KP3/8/3r4/8/4R3 b - - 0 1',
                        'highlights' => ['d3'],
                    ],
                    [
                        'title' => 'Rook Behind Passed Pawns',
                        'content' => '<p>Tarrasch\'s rule: <strong>"Place your rook behind passed pawns, whether they are yours or your opponent\'s."</strong></p><ul><li>Behind your own passed pawn, the rook\'s scope increases as the pawn advances</li><li>Behind the enemy\'s passed pawn, the rook attacks it from behind, and its scope increases as the pawn advances toward your rook</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your rook endgame knowledge.</p>',
                        'quiz' => [
                            'question' => 'In the Philidor Position, where should the defending rook be placed initially?',
                            'options' => ['On the 1st rank', 'On the 3rd rank to cut off the enemy king', 'Behind the passed pawn', 'On the same file as the king'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 2 — Bishop vs Knight
        $module->lessons()->create([
            'title' => 'Bishop vs Knight',
            'slug' => 'bishop-vs-knight-endgames',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 2,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Bishop Advantages',
                        'content' => '<p>In the endgame, bishops gain strength when:</p><ul><li><strong>Pawns are on both sides of the board</strong>: The bishop\'s long range covers both flanks</li><li><strong>Open position</strong>: Few blocked pawns, long diagonals available</li><li><strong>The bishop can attack pawns</strong> while simultaneously supporting its own passed pawn from a distance</li></ul>',
                        'diagram' => '8/pp3kpp/8/3B4/8/8/PP3KPP/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Knight Advantages',
                        'content' => '<p>Knights shine in endgames when:</p><ul><li><strong>Pawns are on one side only</strong>: The knight can reach all squares</li><li><strong>Closed position</strong>: Blocked pawn chains where the knight can navigate over them</li><li><strong>Fixed pawns on one color</strong>: If pawns are fixed on the bishop\'s color, a knight is superior</li><li><strong>An outpost exists</strong>: A secure advanced square the knight cannot be driven from</li></ul>',
                        'diagram' => '8/pp3kpp/4n3/8/4P3/8/PP3KPP/8 b - - 0 1',
                    ],
                    [
                        'title' => 'Opposite-Color Bishop Endgames',
                        'content' => '<p>When each side has a bishop on opposite colors, the position is <strong>extremely drawish</strong> even with a 1-2 pawn advantage. The defender can set up a blockade on their bishop\'s color that the attacking bishop can never break.</p><p>This makes opposite-color bishop endgames the most drawish endgame type, but in the middlegame, they can be dangerous for the defender because of attacking chances.</p>',
                    ],
                    [
                        'title' => 'Wrong-Color Bishop',
                        'content' => '<p>The <strong>wrong-color bishop</strong> concept: with a rook-pawn (a- or h-pawn) and a bishop that does not control the promotion square, the position is drawn because the defending king can camp in the corner.</p><p>Example: White has bishop on c1 (dark squares) and pawn on h6. The h8 promotion square is light, so the bishop cannot drive the Black king away from h8. Draw!</p>',
                        'diagram' => '7k/8/7P/8/8/8/8/2B1K3 w - - 0 1',
                        'highlights' => ['h6', 'h8', 'c1'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your bishop vs knight knowledge.</p>',
                        'quiz' => [
                            'question' => 'When are opposite-color bishop endgames likely to be drawn?',
                            'options' => ['Never — material advantage always wins', 'Almost always, even with a 1-2 pawn advantage', 'Only when there are no pawns left', 'Only when the defender has more pawns'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 3 — Passed Pawns
        $module->lessons()->create([
            'title' => 'Passed Pawns',
            'slug' => 'passed-pawns-endgame',
            'lesson_type' => 'theory',
            'difficulty_rating' => 5,
            'sort_order' => 3,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Power of Passed Pawns',
                        'content' => '<p>A <strong>passed pawn</strong> has no opposing pawns blocking or controlling its advance to promotion. As Nimzowitsch wrote: <em>"The passed pawn is a criminal, who should be kept under lock and key."</em></p><p>In the endgame, a passed pawn can decide the game single-handedly by distracting the opponent\'s pieces.</p>',
                        'diagram' => '8/5kpp/8/3P4/8/8/5KPP/8 w - - 0 1',
                        'highlights' => ['d5'],
                    ],
                    [
                        'title' => 'Protected Passed Pawn',
                        'content' => '<p>A <strong>protected passed pawn</strong> is supported by another pawn. It is even more powerful because it cannot be captured by the opponent\'s king without losing material. A protected passed pawn ties down the opponent\'s pieces permanently.</p>',
                        'diagram' => '8/5kpp/8/3PP3/8/8/5KPP/8 w - - 0 1',
                        'highlights' => ['d5', 'e5'],
                    ],
                    [
                        'title' => 'Connected Passed Pawns',
                        'content' => '<p><strong>Connected passed pawns</strong> on the 6th rank are stronger than a rook. They support each other and advance in tandem, making it nearly impossible to stop both from promoting.</p><p>Even in the middlegame, two connected passed pawns on the 5th or 6th rank are a dominant force.</p>',
                        'diagram' => '6k1/8/3PP3/8/8/8/r5PK/4R3 w - - 0 1',
                        'highlights' => ['d6', 'e6'],
                    ],
                    [
                        'title' => 'Creating Passed Pawns',
                        'content' => '<p>To create a passed pawn from a pawn majority:</p><ol><li><strong>Advance the candidate</strong>: The pawn with no opposing pawn on its file is the "candidate"</li><li><strong>Force exchanges</strong>: Trade pawns to leave your candidate without opposition</li><li><strong>Sacrifice if needed</strong>: Sometimes sacrificing one pawn creates a decisive passed pawn from the remaining ones</li></ol>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your passed pawn knowledge.</p>',
                        'quiz' => [
                            'question' => 'Connected passed pawns on the 6th rank are said to be stronger than what?',
                            'options' => ['A bishop', 'A knight', 'A rook', 'A queen'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 4 — Rook+Pawn vs Rook
        $module->lessons()->create([
            'title' => 'Rook+Pawn vs Rook',
            'slug' => 'rook-pawn-vs-rook',
            'lesson_type' => 'theory',
            'difficulty_rating' => 6,
            'sort_order' => 4,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 90,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Most Important Endgame',
                        'content' => '<p>Rook + pawn vs rook is the <strong>single most important theoretical endgame</strong>. Knowing whether a position is won or drawn can save or win countless games. The two key positions are Lucena (winning) and Philidor (drawing).</p>',
                        'diagram' => '8/4k3/4P3/4K3/8/8/8/r3R3 w - - 0 1',
                    ],
                    [
                        'title' => 'Lucena: Building the Bridge',
                        'content' => '<p>In the Lucena Position (king on the pawn\'s queening square, pawn on 7th), the winning technique is called "building a bridge":</p><ol><li>Play Rd1+ to push the enemy king away</li><li>Move your king off the promotion square</li><li>Bring the rook to the 4th rank</li><li>When checked, advance the king and use the rook as a shield</li></ol>',
                        'diagram' => '1K1k4/1P6/8/8/8/8/r7/3R4 w - - 0 1',
                    ],
                    [
                        'title' => 'Philidor: Defending the Draw',
                        'content' => '<p>The Philidor defense works when the defending king is in front of the pawn:</p><ol><li>Place the rook on the <strong>3rd rank</strong> to cut off the attacking king</li><li>Wait until the pawn reaches the 6th rank</li><li>Drop the rook to the <strong>1st rank</strong></li><li>Give checks from behind — the attacking king has nowhere to hide</li></ol>',
                        'diagram' => '4K3/4P1k1/8/8/8/4r3/8/4R3 b - - 0 1',
                        'highlights' => ['e3'],
                    ],
                    [
                        'title' => 'Practical Tips',
                        'content' => '<p>Key principles for rook + pawn vs rook:</p><ul><li><strong>Attacker</strong>: Get your king in front of the pawn and aim for the Lucena Position</li><li><strong>Defender</strong>: Keep your king in front of the pawn; if forced to the side, use the Philidor technique</li><li><strong>Rook-pawns (a/h-pawns)</strong>: Rook-pawn endgames are often drawn because the attacking king has less room to maneuver</li><li><strong>Activity is paramount</strong>: Always prefer an active rook over a passive one</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your rook+pawn vs rook knowledge.</p>',
                        'quiz' => [
                            'question' => 'In the Lucena Position, what is the winning technique called?',
                            'options' => ['The Philidor Defense', 'Building a Bridge', 'The Opposition', 'Zugzwang'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        // Lesson 5 — Endgame Test (puzzle)
        $module->lessons()->create([
            'title' => 'Endgame Test',
            'slug' => 'intermediate-endgame-test',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 6,
            'sort_order' => 5,
            'estimated_duration_minutes' => 14,
            'xp_reward' => 120,
            'content_data' => [
                'puzzles' => [
                    [
                        // Lucena: building the bridge — Rd4 to shield the king
                        'fen' => '1K6/1P1k4/8/8/8/8/r7/4R3 w - - 0 1',
                        'solution' => ['Re4'],
                        'hints' => ['You need to "build a bridge" to promote the pawn.', 'Re4 prepares to block checks on the 4th rank after your king steps out.'],
                    ],
                    [
                        // Passed pawn race: advance your own pawn
                        'fen' => '8/p4k2/8/1P6/8/8/5K2/8 w - - 0 1',
                        'solution' => ['b6'],
                        'hints' => ['Both sides have passed pawns — it is a race.', 'Push b6! Your pawn is closer to promotion and queens first.'],
                    ],
                    [
                        // Bishop endgame: use the right diagonal
                        'fen' => '8/1k6/1p6/1P6/8/8/B4K2/8 w - - 0 1',
                        'solution' => ['Bc4'],
                        'hints' => ['The bishop needs to control the promotion square.', 'Bc4 controls b5 and aims at a6, preparing to advance or tie down Black\'s king.'],
                    ],
                    [
                        // Rook activity: activate with check
                        'fen' => '8/8/1pk5/8/1P6/8/K7/5r2 b - - 0 1',
                        'solution' => ['Rf2+'],
                        'hints' => ['Your rook is passive on f1.', 'Rf2+ activates the rook with check, gaining tempo to attack the b4 pawn.'],
                    ],
                ],
            ],
        ]);
    }
}
