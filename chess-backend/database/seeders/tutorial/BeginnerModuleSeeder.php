<?php

namespace Database\Seeders\Tutorial;

use App\Models\TutorialModule;

class BeginnerModuleSeeder
{
    /**
     * Seed 5 beginner modules (FREE tier), 25 lessons total.
     * Modules 1-3 preserve existing high-quality content.
     */
    public function run(): void
    {
        $m1 = $this->seedChessBasics();
        $m2 = $this->seedRulesAndGoals($m1);
        $m3 = $this->seedFirstTactics($m2);
        $m4 = $this->seedPieceCoordination($m3);
        $this->seedBeginnerEndgames($m4);
    }

    // ──────────────────────────────────────────────
    // Module 1 — Chess Basics (5 theory)
    // ──────────────────────────────────────────────
    private function seedChessBasics(): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Chess Basics',
            'slug' => 'chess-basics',
            'skill_tier' => 'beginner',
            'required_tier' => 'free',
            'description' => 'Learn the chessboard, how each piece moves, and the special rules that make chess unique.',
            'icon' => "\u{265F}\u{FE0F}",
            'sort_order' => 1,
            'estimated_duration_minutes' => 60,
        ]);

        $module->lessons()->create([
            'title' => 'The Chessboard',
            'slug' => 'the-chessboard',
            'lesson_type' => 'theory',
            'difficulty_rating' => 1,
            'sort_order' => 1,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 50,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The 64 Squares',
                        'content' => '<p>Chess is played on a square board divided into <strong>64 squares</strong> in an 8×8 grid. White pieces start on ranks 1-2, black pieces on ranks 7-8.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    ],
                    [
                        'title' => 'Ranks and Files',
                        'content' => '<p><strong>Files</strong> are vertical columns labeled <strong>a-h</strong> from left to right. <strong>Ranks</strong> are horizontal rows numbered <strong>1-8</strong> from bottom to top (White\'s view).</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        'highlights' => ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'],
                    ],
                    [
                        'title' => 'Naming Squares',
                        'content' => '<p>Every square has a unique name: <strong>file letter + rank number</strong>. The bottom-left corner is <strong>a1</strong>. The center squares <strong>d4, d5, e4, e5</strong> are the most important area of the board.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        'highlights' => ['d4', 'd5', 'e4', 'e5'],
                    ],
                    [
                        'title' => 'Light and Dark Squares',
                        'content' => '<p>The squares alternate between light and dark colours. <strong>a1 is always dark</strong> and <strong>h1 is always light</strong>. Each player should have a light square in their right-hand corner (h1 for White, a8 for Black).</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test what you have learned about the chessboard.</p>',
                        'quiz' => [
                            'question' => 'How many squares are on a chessboard?',
                            'options' => ['32', '48', '64', '100'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'The Pawns',
            'slug' => 'the-pawns',
            'lesson_type' => 'theory',
            'difficulty_rating' => 1,
            'sort_order' => 2,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 50,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Pawn Movement',
                        'content' => '<p>Pawns move <strong>forward one square</strong> at a time. They are the only piece that cannot move backwards. Each side starts with 8 pawns on their second rank.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        'highlights' => ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'],
                    ],
                    [
                        'title' => 'The Two-Square First Move',
                        'content' => '<p>On its <strong>very first move</strong>, a pawn may advance <strong>one or two squares</strong> forward. After that, it can only move one square at a time.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                        'highlights' => ['e2', 'e4'],
                    ],
                    [
                        'title' => 'Pawn Captures',
                        'content' => '<p>Pawns capture <strong>diagonally forward</strong>, one square. They are the only piece that captures differently from how they move.</p>',
                        'diagram' => '8/8/8/3p4/4P3/8/8/8 w - - 0 1',
                        'highlights' => ['e4', 'd5'],
                    ],
                    [
                        'title' => 'En Passant',
                        'content' => '<p><strong>En passant</strong> ("in passing") is a special pawn capture. When an opponent\'s pawn advances two squares and lands beside your pawn, you may capture it as if it had only moved one square. This must be done immediately on the next move or the right is lost.</p>',
                        'diagram' => 'rnbqkbnr/pppp1p1p/8/4pPp1/8/8/PPPPP1PP/RNBQKBNR w KQkq g6 0 3',
                        'highlights' => ['f5', 'g6'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test what you know about pawns.</p>',
                        'quiz' => [
                            'question' => 'How does a pawn capture?',
                            'options' => ['Straight forward', 'Diagonally forward', 'In any direction', 'Sideways'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Knights & Bishops',
            'slug' => 'knights-and-bishops',
            'lesson_type' => 'theory',
            'difficulty_rating' => 1,
            'sort_order' => 3,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Knight',
                        'content' => '<p>The knight moves in an <strong>L-shape</strong>: two squares in one direction and one square perpendicular (or vice-versa). It always lands on a square of the opposite colour.</p>',
                        'diagram' => '8/8/8/4N3/8/8/8/8 w - - 0 1',
                        'highlights' => ['d3', 'f3', 'd7', 'f7', 'c4', 'g4', 'c6', 'g6'],
                    ],
                    [
                        'title' => 'Knights Jump',
                        'content' => '<p>The knight is the <strong>only piece that can jump</strong> over other pieces. This makes it especially powerful in crowded positions.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1',
                        'highlights' => ['f3'],
                    ],
                    [
                        'title' => 'The Bishop',
                        'content' => '<p>The bishop moves <strong>diagonally any number of squares</strong>. It cannot jump over other pieces. Each side starts with two bishops: one on light squares, one on dark squares.</p>',
                        'diagram' => '8/8/8/4B3/8/8/8/8 w - - 0 1',
                        'highlights' => ['d4', 'c3', 'b2', 'a1', 'f4', 'g3', 'h2', 'd6', 'c7', 'b8', 'f6', 'g7', 'h8'],
                    ],
                    [
                        'title' => 'Light and Dark Bishops',
                        'content' => '<p>A bishop is forever locked to the colour of its starting square. That is why a <strong>light-squared bishop</strong> can never reach a dark square, and vice-versa. Having both bishops (the "bishop pair") is a small advantage.</p>',
                        'diagram' => '8/8/8/8/8/8/8/2B2B2 w - - 0 1',
                        'highlights' => ['c1', 'f1'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of knights and bishops.</p>',
                        'quiz' => [
                            'question' => 'What is special about the knight compared to all other pieces?',
                            'options' => ['It moves diagonally', 'It can jump over other pieces', 'It is the most powerful piece', 'It can move backwards'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Rooks & Queen',
            'slug' => 'rooks-and-queen',
            'lesson_type' => 'theory',
            'difficulty_rating' => 1,
            'sort_order' => 4,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Rook',
                        'content' => '<p>The rook moves in <strong>straight lines</strong>: any number of squares horizontally or vertically. It cannot jump over pieces. Each side starts with two rooks in the corners.</p>',
                        'diagram' => '8/8/8/8/4R3/8/8/8 w - - 0 1',
                        'highlights' => ['e1', 'e2', 'e3', 'e5', 'e6', 'e7', 'e8', 'a4', 'b4', 'c4', 'd4', 'f4', 'g4', 'h4'],
                    ],
                    [
                        'title' => 'The Queen',
                        'content' => '<p>The queen is the <strong>most powerful piece</strong>. She combines the movement of the rook and bishop, moving any number of squares along a rank, file, or diagonal.</p>',
                        'diagram' => '8/8/8/8/4Q3/8/8/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Piece Values',
                        'content' => '<p>Each piece has a relative value to help you decide when to trade:</p><ul><li>Pawn = <strong>1</strong></li><li>Knight = <strong>3</strong></li><li>Bishop = <strong>3</strong></li><li>Rook = <strong>5</strong></li><li>Queen = <strong>9</strong></li></ul><p>The king is invaluable — losing it means losing the game.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the major pieces.</p>',
                        'quiz' => [
                            'question' => 'Which piece is worth the most points?',
                            'options' => ['Rook (5)', 'Bishop (3)', 'Queen (9)', 'Knight (3)'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'The King & Special Moves',
            'slug' => 'king-and-special-moves',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 5,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The King',
                        'content' => '<p>The king moves <strong>one square in any direction</strong> (horizontal, vertical, or diagonal). It is the most important piece — if your king is checkmated, you lose!</p>',
                        'diagram' => '8/8/8/8/4K3/8/8/8 w - - 0 1',
                        'highlights' => ['d3', 'e3', 'f3', 'd4', 'f4', 'd5', 'e5', 'f5'],
                    ],
                    [
                        'title' => 'Castling',
                        'content' => '<p><strong>Castling</strong> is a special move involving the king and a rook. The king moves <strong>two squares</strong> towards a rook, and the rook jumps to the other side of the king. Kingside castling (O-O) is short; queenside (O-O-O) is long.</p>',
                        'diagram' => 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
                        'highlights' => ['e1', 'g1', 'c1'],
                    ],
                    [
                        'title' => 'Castling Rules',
                        'content' => '<p>You may <strong>not</strong> castle if:</p><ul><li>The king or the chosen rook has already moved</li><li>The king is currently in check</li><li>The king would pass through or land on an attacked square</li><li>There are pieces between the king and the rook</li></ul>',
                    ],
                    [
                        'title' => 'What is Check?',
                        'content' => '<p>When a piece attacks the opponent\'s king, the king is <strong>in check</strong>. The player must immediately get out of check by: <strong>moving</strong> the king, <strong>blocking</strong> the check, or <strong>capturing</strong> the attacking piece.</p>',
                        'diagram' => '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of the king and castling.</p>',
                        'quiz' => [
                            'question' => 'How many squares does the king move when castling?',
                            'options' => ['One', 'Two', 'Three', 'Four'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 2 — Rules & Goals (3 theory + 2 puzzle)
    // ──────────────────────────────────────────────
    private function seedRulesAndGoals(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Rules & Goals',
            'slug' => 'rules-and-goals',
            'skill_tier' => 'beginner',
            'required_tier' => 'free',
            'description' => 'Understand check, checkmate, stalemate, and all the ways a chess game can end.',
            'icon' => "\u{1F3AF}",
            'sort_order' => 2,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 55,
        ]);

        $module->lessons()->create([
            'title' => 'Check, Checkmate & Stalemate',
            'slug' => 'check-checkmate-stalemate',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 1,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Check',
                        'content' => '<p>When a piece directly attacks the opponent\'s king, the king is <strong>in check</strong>. You must escape check immediately using one of three methods:</p><ol><li><strong>Move</strong> the king to a safe square</li><li><strong>Block</strong> the check with another piece</li><li><strong>Capture</strong> the attacking piece</li></ol>',
                        'diagram' => '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Checkmate',
                        'content' => '<p><strong>Checkmate</strong> occurs when a king is in check and there is no way to escape. The game is over immediately — the player who delivers checkmate wins!</p>',
                        'diagram' => '3k4/R7/3K4/8/8/8/8/8 w - - 0 1',
                        'highlights' => ['a7', 'd6'],
                    ],
                    [
                        'title' => 'Stalemate',
                        'content' => '<p><strong>Stalemate</strong> occurs when a player is <strong>not</strong> in check but has <strong>no legal moves</strong>. The game is a <strong>draw</strong>. This is an important trap to watch for — if you are winning, avoid stalemating your opponent!</p>',
                        'diagram' => 'k7/P1K5/8/8/8/8/8/8 b - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of check, checkmate, and stalemate.</p>',
                        'quiz' => [
                            'question' => 'What happens if a player has no legal moves but is NOT in check?',
                            'options' => ['They lose the game', 'The game is a draw (stalemate)', 'They skip their turn', 'The opponent wins'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'How Games End',
            'slug' => 'how-games-end',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 2,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 50,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Decisive Results',
                        'content' => '<p>A chess game can end in a <strong>win</strong> for one side or a <strong>draw</strong>. Wins happen by:</p><ul><li><strong>Checkmate</strong> — the ultimate goal</li><li><strong>Resignation</strong> — a player concedes when the position is hopeless</li><li><strong>Timeout</strong> — a player runs out of time (in timed games)</li></ul>',
                    ],
                    [
                        'title' => 'Draws',
                        'content' => '<p>Games can end in a draw in several ways:</p><ul><li><strong>Stalemate</strong> — no legal moves, not in check</li><li><strong>Agreement</strong> — both players agree to a draw</li><li><strong>Insufficient material</strong> — neither side can checkmate (e.g. king vs king)</li></ul>',
                    ],
                    [
                        'title' => 'Special Draw Rules',
                        'content' => '<p>Two additional draw rules prevent games from going on forever:</p><ul><li><strong>50-move rule</strong> — a draw can be claimed if 50 moves pass with no capture or pawn move</li><li><strong>Threefold repetition</strong> — a draw can be claimed if the same position occurs three times</li></ul>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge about how games end.</p>',
                        'quiz' => [
                            'question' => 'Which is NOT a way a chess game can end in a draw?',
                            'options' => ['Stalemate', 'Threefold repetition', 'Checkmate', 'Insufficient material'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Pawn Promotion',
            'slug' => 'pawn-promotion',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 3,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Promotion',
                        'content' => '<p>When a pawn reaches the <strong>last rank</strong> (rank 8 for White, rank 1 for Black), it <strong>must</strong> be promoted to a queen, rook, bishop, or knight. You may choose any piece regardless of what is already on the board.</p>',
                        'diagram' => '8/4P3/8/8/8/8/8/4K2k w - - 0 1',
                        'highlights' => ['e7'],
                    ],
                    [
                        'title' => 'Underpromotion',
                        'content' => '<p><strong>Underpromotion</strong> means choosing a piece other than the queen. While the queen is almost always the best choice, sometimes a <strong>knight</strong> is better because it can deliver check or a fork that a queen cannot.</p>',
                    ],
                    [
                        'title' => 'Promotion Strategy',
                        'content' => '<p>Pawn promotion is one of the most powerful ideas in chess. In the endgame, <strong>passed pawns</strong> (pawns with no opposing pawns blocking their path) become extremely valuable because they threaten to promote.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of pawn promotion.</p>',
                        'quiz' => [
                            'question' => 'What must happen when a pawn reaches the last rank?',
                            'options' => ['It is removed from the board', 'It must promote to another piece', 'It stays as a pawn', 'The game ends'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Basic Checkmates',
            'slug' => 'basic-checkmates-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 2,
            'sort_order' => 4,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 100,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
                        'solution' => ['Rd8#'],
                        'hints' => ['The black king is trapped by its own pawns.', 'A rook on the 8th rank delivers mate.'],
                    ],
                    [
                        'fen' => 'k7/8/1K6/8/8/8/8/1Q6 w - - 0 1',
                        'solution' => ['Qb7#'],
                        'hints' => ['The king is trapped on the edge.', 'Deliver check while covering all escape squares.'],
                    ],
                    [
                        'fen' => '1k6/R7/1R6/8/8/8/8/6K1 w - - 0 1',
                        'solution' => ['Ra8#'],
                        'hints' => ['The two rooks control adjacent ranks.', 'One rook can deliver the final blow on the 8th rank.'],
                    ],
                    [
                        'fen' => 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
                        'solution' => ['Qxf7#'],
                        'hints' => ['The f7 pawn is only defended by the king.', 'The queen and bishop work together on the f7 square.'],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Rules Review',
            'slug' => 'rules-review-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 2,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 80,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '8/5P1k/8/8/8/8/8/4K3 w - - 0 1',
                        'solution' => ['f8=Q'],
                        'hints' => ['The pawn is one step from promotion.', 'Promote to the strongest piece.'],
                    ],
                    [
                        'fen' => '5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
                        'solution' => ['Re8'],
                        'hints' => ['Exchange rooks to simplify.', 'The back rank is the target.'],
                    ],
                    [
                        'fen' => '4k3/4P3/4K3/8/8/8/8/8 w - - 0 1',
                        'solution' => ['e8=Q#'],
                        'hints' => ['Promote with check!', 'The pawn becomes a queen and delivers checkmate.'],
                    ],
                    [
                        'fen' => '7k/R7/8/8/8/8/8/1K6 w - - 0 1',
                        'solution' => ['Ra8#'],
                        'hints' => ['The king is on the edge of the board.', 'The rook delivers mate on the back rank.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 3 — First Tactics (3 theory + 2 puzzle)
    // ──────────────────────────────────────────────
    private function seedFirstTactics(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'First Tactics',
            'slug' => 'first-tactics',
            'skill_tier' => 'beginner',
            'required_tier' => 'free',
            'description' => 'Discover the basic tactical patterns that win games: forks, pins, and skewers.',
            'icon' => "\u{2694}\u{FE0F}",
            'sort_order' => 3,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 55,
        ]);

        $module->lessons()->create([
            'title' => 'Forks',
            'slug' => 'forks',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 1,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is a Fork?',
                        'content' => '<p>A <strong>fork</strong> is a tactic where one piece attacks <strong>two or more</strong> enemy pieces at the same time. The opponent can only save one, so you win material.</p>',
                    ],
                    [
                        'title' => 'Knight Forks',
                        'content' => '<p>Knights are the best forking pieces because of their unique L-shaped movement. A knight can attack pieces that cannot attack it back. The <strong>royal fork</strong> (forking king and queen) is devastating.</p>',
                        'diagram' => 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
                        'highlights' => ['d5', 'c7'],
                    ],
                    [
                        'title' => 'Queen and Pawn Forks',
                        'content' => '<p>The <strong>queen</strong> can fork along ranks, files, and diagonals. Even humble <strong>pawns</strong> can fork two pieces diagonally. Always look for double-attack opportunities with every piece!</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of forks.</p>',
                        'quiz' => [
                            'question' => 'Which piece is generally the best at delivering forks?',
                            'options' => ['Bishop', 'Knight', 'Rook', 'Pawn'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Pins & Skewers',
            'slug' => 'pins-and-skewers',
            'lesson_type' => 'theory',
            'difficulty_rating' => 3,
            'sort_order' => 2,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is a Pin?',
                        'content' => '<p>A <strong>pin</strong> occurs when an attacking piece targets a piece that <strong>cannot move</strong> without exposing a more valuable piece behind it.</p>',
                        'diagram' => 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3',
                    ],
                    [
                        'title' => 'Absolute vs Relative Pins',
                        'content' => '<p>An <strong>absolute pin</strong> means the pinned piece shields the king — it is <strong>illegal</strong> to move it. A <strong>relative pin</strong> means the shielded piece is valuable (like a queen) but the pinned piece <em>could</em> legally move, just at great cost.</p>',
                    ],
                    [
                        'title' => 'Skewers',
                        'content' => '<p>A <strong>skewer</strong> is the reverse of a pin. You attack a valuable piece, and when it moves out of the way, you capture the piece <strong>behind</strong> it.</p>',
                        'diagram' => '4k3/8/8/4R3/8/8/8/4r2K w - - 0 1',
                        'highlights' => ['e5', 'e8', 'e1'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your knowledge of pins and skewers.</p>',
                        'quiz' => [
                            'question' => 'In an absolute pin, the pinned piece shields which piece?',
                            'options' => ['The queen', 'The king', 'A rook', 'Any piece'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Discovered Attacks',
            'slug' => 'discovered-attacks',
            'lesson_type' => 'theory',
            'difficulty_rating' => 3,
            'sort_order' => 3,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Discovered Attack',
                        'content' => '<p>A <strong>discovered attack</strong> happens when you move one piece and <strong>uncover</strong> an attack by another piece behind it. It is like a surprise ambush — the opponent must deal with two threats at once.</p>',
                        'diagram' => '4k3/8/4n3/8/4B3/8/8/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Discovered Check',
                        'content' => '<p>A <strong>discovered check</strong> is even more powerful — when the uncovered piece gives check, the moving piece can go almost anywhere (including capturing a piece) because the opponent must deal with the check first.</p>',
                    ],
                    [
                        'title' => 'Double Check',
                        'content' => '<p>In a <strong>double check</strong>, both the moving piece and the uncovered piece give check simultaneously. The only escape is to <strong>move the king</strong> — you cannot block or capture two attackers at once!</p>',
                        'diagram' => '4k3/8/5N2/8/8/8/4B3/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of discovered attacks.</p>',
                        'quiz' => [
                            'question' => 'In a double check, what is the ONLY way to escape?',
                            'options' => ['Block the check', 'Capture one attacker', 'Move the king', 'Any of the above'],
                            'correct' => 2,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Double Checks',
            'slug' => 'double-checks-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 4,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 90,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
                        'solution' => ['Nc7+'],
                        'hints' => ['The knight can attack two pieces at once.', 'Find the square that forks the king and the rook.'],
                    ],
                    [
                        'fen' => '7k/8/5n2/8/3B4/8/8/6K1 w - - 0 1',
                        'solution' => ['Bxf6+'],
                        'hints' => ['The knight is pinned to the king along a diagonal.', 'Capture the pinned piece.'],
                    ],
                    [
                        'fen' => '6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1',
                        'solution' => ['Qe8#'],
                        'hints' => ['The king is trapped by its own pawns.', 'Deliver check on the back rank.'],
                    ],
                    [
                        'fen' => '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
                        'solution' => ['Nf7#'],
                        'hints' => ['The king is surrounded by its own pieces.', 'A knight on f7 covers h8 and h6.'],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Tactical Puzzles',
            'slug' => 'tactical-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 100,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => 'r1b1kb1r/pppp1ppp/5n2/4N1q1/2BnP3/8/PPPP1PPP/RNBQK2R w KQkq - 0 1',
                        'solution' => ['Nxf7'],
                        'hints' => ['The knight can fork two valuable pieces.', 'Nxf7 attacks the queen and the rook.'],
                    ],
                    [
                        'fen' => 'r4rk1/ppp2ppp/2n5/3qp3/8/2N2N2/PPPQ1PPP/R3R1K1 w - - 0 1',
                        'solution' => ['Nxd5'],
                        'hints' => ['A piece is undefended in the center.', 'The queen on d5 can be captured.'],
                    ],
                    [
                        'fen' => '2r3k1/pp3ppp/8/2b5/8/2B5/PPP2PPP/4R1K1 w - - 0 1',
                        'solution' => ['Re8+'],
                        'hints' => ['Use the open file to attack.', 'A back-rank check is very strong here.'],
                    ],
                    [
                        'fen' => 'r1bqk2r/ppppbppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
                        'solution' => ['Ng5'],
                        'hints' => ['Target the weak f7 square.', 'The knight and bishop both aim at f7.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 4 — Piece Coordination (4 theory + 1 puzzle)
    // ──────────────────────────────────────────────
    private function seedPieceCoordination(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Piece Coordination',
            'slug' => 'piece-coordination',
            'skill_tier' => 'beginner',
            'required_tier' => 'free',
            'description' => 'Learn how to trade pieces wisely, gain material advantage, and coordinate your army.',
            'icon' => "\u{1F91D}",
            'sort_order' => 4,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 55,
        ]);

        $module->lessons()->create([
            'title' => 'Trading Pieces',
            'slug' => 'trading-pieces',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 1,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'When to Trade',
                        'content' => '<p>Trading (exchanging) pieces is a fundamental skill. General rules:</p><ul><li>Trade when you are <strong>ahead in material</strong> — simplify to win</li><li>Avoid trading when you are <strong>behind</strong> — keep pieces for counterplay</li><li>Trade off your <strong>bad</strong> pieces for your opponent\'s <strong>good</strong> pieces</li></ul>',
                    ],
                    [
                        'title' => 'Equal vs Unequal Trades',
                        'content' => '<p>An <strong>equal trade</strong> (knight for knight, rook for rook) is neutral. An <strong>unequal trade</strong> means gaining material: winning a rook (5) for a bishop (3) gains you 2 points of material advantage.</p>',
                    ],
                    [
                        'title' => 'The Exchange',
                        'content' => '<p>"Winning the exchange" means trading a minor piece (bishop/knight, worth 3) for a rook (worth 5). This 2-point gain is significant and usually enough to win the game with accurate play.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your trading knowledge.</p>',
                        'quiz' => [
                            'question' => 'When should you generally trade pieces?',
                            'options' => ['When behind in material', 'When ahead in material', 'Never', 'Always'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Material Advantage',
            'slug' => 'material-advantage',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 2,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Counting Material',
                        'content' => '<p>Add up piece values for each side: Pawn=1, Knight=3, Bishop=3, Rook=5, Queen=9. The side with the higher total has a <strong>material advantage</strong>.</p>',
                    ],
                    [
                        'title' => 'Converting an Advantage',
                        'content' => '<p>When ahead in material: <strong>trade pieces, not pawns</strong>. Each trade makes your advantage relatively larger. With extra material, aim for a safe endgame where your extra piece will decide the game.</p>',
                    ],
                    [
                        'title' => 'Quality Over Quantity',
                        'content' => '<p>Sometimes fewer but better-placed pieces are stronger than more material. An <strong>active</strong> rook is worth more than a <strong>passive</strong> queen that is stuck defending. Always consider piece activity alongside material count.</p>',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your material knowledge.</p>',
                        'quiz' => [
                            'question' => 'When ahead in material, what should you trade?',
                            'options' => ['Pawns', 'Pieces (not pawns)', 'Nothing', 'Only queens'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Piece Activity',
            'slug' => 'piece-activity',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 3,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Active vs Passive Pieces',
                        'content' => '<p>An <strong>active</strong> piece controls many squares and participates in the game. A <strong>passive</strong> piece is stuck defending or has limited mobility. Always strive to make your pieces active.</p>',
                    ],
                    [
                        'title' => 'Improving Your Worst Piece',
                        'content' => '<p>A classic guideline: find your <strong>least active piece</strong> and improve it. Reposition it to a better square where it controls more territory or supports your plan.</p>',
                    ],
                    [
                        'title' => 'Piece Cooperation',
                        'content' => '<p>Pieces are strongest when they <strong>work together</strong>. A rook and bishop aiming at the same target is much stronger than either alone. Look for ways to coordinate your pieces toward a common goal.</p>',
                        'diagram' => '4k3/8/8/8/8/3B4/4R3/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your understanding of piece activity.</p>',
                        'quiz' => [
                            'question' => 'What is a good general guideline for improving your position?',
                            'options' => ['Move your queen first', 'Improve your worst piece', 'Attack immediately', 'Trade all your pieces'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Center Control',
            'slug' => 'center-control',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 4,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 60,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'Why the Center Matters',
                        'content' => '<p>The center squares (d4, d5, e4, e5) are the most important area of the board. Pieces in the center control more squares and can reach any part of the board quickly.</p>',
                        'diagram' => 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2',
                        'highlights' => ['d4', 'e4'],
                    ],
                    [
                        'title' => 'Classical Center',
                        'content' => '<p>Occupying the center with pawns (e4, d4) is the <strong>classical</strong> approach. These pawns control key squares and give your pieces room to develop behind them.</p>',
                    ],
                    [
                        'title' => 'Knights Love the Center',
                        'content' => '<p>A knight on e4 or d5 controls 8 squares. A knight on a1 controls only 2 squares! The saying "<strong>a knight on the rim is dim</strong>" captures this perfectly.</p>',
                        'diagram' => '8/8/8/3N4/8/8/8/8 w - - 0 1',
                        'highlights' => ['b4', 'b6', 'c3', 'c7', 'e3', 'e7', 'f4', 'f6'],
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your center control knowledge.</p>',
                        'quiz' => [
                            'question' => 'Why are the center squares so important?',
                            'options' => ['They are closer to the king', 'Pieces there control more squares', 'They are easier to defend', 'Pawns cannot reach them'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Coordination Puzzles',
            'slug' => 'coordination-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 90,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '2r3k1/pp3ppp/8/3R4/8/8/PPP2PPP/6K1 w - - 0 1',
                        'solution' => ['Rd8+'],
                        'hints' => ['Use the open file for a back-rank attack.', 'The rook can check on the 8th rank.'],
                    ],
                    [
                        'fen' => '4k3/8/8/4B3/8/8/3R4/4K3 w - - 0 1',
                        'solution' => ['Rd8#'],
                        'hints' => ['The bishop and rook work together.', 'The bishop covers the escape squares.'],
                    ],
                    [
                        'fen' => 'r3k2r/ppp2ppp/2nb1n2/3pp3/2B1P3/3P1N2/PPP2PPP/R1BQK2R w KQkq - 0 6',
                        'solution' => ['Bxd5'],
                        'hints' => ['A central pawn is underdefended.', 'The bishop can capture and attack multiple targets.'],
                    ],
                    [
                        'fen' => '3qk3/8/8/4N3/8/8/8/3QK3 w - - 0 1',
                        'solution' => ['Nc6'],
                        'hints' => ['The knight and queen can coordinate.', 'The knight on c6 forks the king and queen.'],
                    ],
                ],
            ],
        ]);

        return $module;
    }

    // ──────────────────────────────────────────────
    // Module 5 — Beginner Endgames (3 theory + 2 puzzle)
    // ──────────────────────────────────────────────
    private function seedBeginnerEndgames(TutorialModule $prerequisite): void
    {
        $module = TutorialModule::create([
            'name' => 'Beginner Endgames',
            'slug' => 'beginner-endgames',
            'skill_tier' => 'beginner',
            'required_tier' => 'free',
            'description' => 'Master the essential endgame checkmates that every chess player must know.',
            'icon' => "\u{1F451}",
            'sort_order' => 5,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 55,
        ]);

        $module->lessons()->create([
            'title' => 'King + Queen vs King',
            'slug' => 'kq-vs-k',
            'lesson_type' => 'theory',
            'difficulty_rating' => 2,
            'sort_order' => 1,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 70,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Easiest Checkmate',
                        'content' => '<p>King and Queen vs lone King is the easiest checkmate to learn. The method: use your queen to <strong>restrict the opposing king to the edge</strong>, then bring your own king to support the final checkmate.</p>',
                        'diagram' => '7k/8/5K2/8/8/8/1Q6/8 w - - 0 1',
                    ],
                    [
                        'title' => 'The Technique',
                        'content' => '<p>Step 1: Push the enemy king to the edge with your queen. Step 2: Bring your king closer. Step 3: Deliver checkmate on the edge.</p><p><strong>Avoid stalemate!</strong> Always leave the opponent\'s king at least one move (until the final checkmate).</p>',
                    ],
                    [
                        'title' => 'Stalemate Traps',
                        'content' => '<p>The biggest danger is accidentally stalemating the opponent. If the king is on the edge with no legal moves and your queen is not giving check, it is a <strong>draw</strong>! Always double-check before your final move.</p>',
                        'diagram' => 'k7/1Q6/1K6/8/8/8/8/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your K+Q vs K knowledge.</p>',
                        'quiz' => [
                            'question' => 'What is the biggest danger in K+Q vs K?',
                            'options' => ['Losing the queen', 'Stalemate', 'Running out of time', 'The king escaping'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'King + Rook vs King',
            'slug' => 'kr-vs-k',
            'lesson_type' => 'theory',
            'difficulty_rating' => 3,
            'sort_order' => 2,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'The Ladder Technique',
                        'content' => '<p>With King + Rook vs King, use the <strong>ladder</strong> (or "staircase") technique: cut off the opposing king rank by rank with your rook while your king approaches.</p>',
                        'diagram' => '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
                    ],
                    [
                        'title' => 'Step-by-Step',
                        'content' => '<p>1. Cut off the king on a rank or file with the rook. 2. Bring your king to support. 3. Push the enemy king back rank by rank. 4. Deliver checkmate on the edge of the board.</p>',
                    ],
                    [
                        'title' => 'Opposition',
                        'content' => '<p>When your king faces the enemy king with one square between them on the same rank or file, you have the <strong>opposition</strong>. This forces the enemy king to retreat, allowing your rook to deliver the checkmate.</p>',
                        'diagram' => '4k3/4R3/8/4K3/8/8/8/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your K+R vs K knowledge.</p>',
                        'quiz' => [
                            'question' => 'What technique is used in K+R vs K checkmates?',
                            'options' => ['Sacrifice the rook', 'The ladder technique', 'Promote a pawn', 'Trade all pieces'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Opposition',
            'slug' => 'opposition',
            'lesson_type' => 'theory',
            'difficulty_rating' => 3,
            'sort_order' => 3,
            'estimated_duration_minutes' => 10,
            'xp_reward' => 80,
            'content_data' => [
                'slides' => [
                    [
                        'title' => 'What is Opposition?',
                        'content' => '<p><strong>Opposition</strong> is a key endgame concept. Two kings are in opposition when they face each other with exactly one square between them. The player who does NOT have to move has the opposition — the other king must retreat.</p>',
                        'diagram' => '4k3/8/4K3/8/8/8/8/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Why It Matters',
                        'content' => '<p>Having the opposition in king + pawn endgames often determines whether you can promote a pawn or not. The attacking king uses the opposition to <strong>outflank</strong> the defender and escort the pawn to promotion.</p>',
                    ],
                    [
                        'title' => 'Key Rule',
                        'content' => '<p>In king + pawn vs king: if the attacking king is <strong>in front of the pawn</strong> with the opposition, the pawn usually promotes. If the defending king has the opposition, it is usually a draw.</p>',
                        'diagram' => '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1',
                    ],
                    [
                        'title' => 'Quiz',
                        'content' => '<p>Test your opposition knowledge.</p>',
                        'quiz' => [
                            'question' => 'Who has the advantage in opposition?',
                            'options' => ['The side that must move', 'The side that does NOT have to move', 'Neither', 'Both equally'],
                            'correct' => 1,
                        ],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Pawn Endgame Basics',
            'slug' => 'pawn-endgame-basics-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 4,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 90,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '8/8/4k3/8/4PK2/8/8/8 w - - 0 1',
                        'solution' => ['e5+'],
                        'hints' => ['Advance the pawn to gain space.', 'The pawn pushes the king back.'],
                    ],
                    [
                        'fen' => '8/5k2/8/8/8/4K3/5P2/8 w - - 0 1',
                        'solution' => ['Ke4'],
                        'hints' => ['Bring the king in front of the pawn.', 'The king must lead the way to promote.'],
                    ],
                    [
                        'fen' => '8/8/8/3k4/8/4K3/4P3/8 w - - 0 1',
                        'solution' => ['Kf4'],
                        'hints' => ['Take the opposition.', 'Your king needs to get in front of the pawn.'],
                    ],
                    [
                        'fen' => '7k/R7/8/8/8/8/8/1K6 w - - 0 1',
                        'solution' => ['Ra8#'],
                        'hints' => ['The king is on the edge.', 'The rook delivers mate on the back rank.'],
                    ],
                ],
            ],
        ]);

        $module->lessons()->create([
            'title' => 'Endgame Puzzles',
            'slug' => 'beginner-endgame-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 5,
            'estimated_duration_minutes' => 12,
            'xp_reward' => 100,
            'content_data' => [
                'puzzles' => [
                    [
                        'fen' => '7k/8/5K2/8/8/8/1Q6/8 w - - 0 1',
                        'solution' => ['Qg7#'],
                        'hints' => ['The king is cornered.', 'The queen can deliver mate supported by the king.'],
                    ],
                    [
                        'fen' => '4k3/4R3/4K3/8/8/8/8/8 w - - 0 1',
                        'solution' => ['Re1'],
                        'hints' => ['Wait with the rook — do not stalemate!', 'Keep the opposition with your king.'],
                    ],
                    [
                        'fen' => '8/8/8/8/8/5k2/5p2/5K2 b - - 0 1',
                        'solution' => ['f1=Q#'],
                        'hints' => ['The pawn is ready to promote.', 'Promote to a queen for checkmate.'],
                    ],
                    [
                        'fen' => '3k4/R7/3K4/8/8/8/8/8 w - - 0 1',
                        'solution' => ['Ra8#'],
                        'hints' => ['The king is on the back rank.', 'The rook delivers checkmate.'],
                    ],
                ],
            ],
        ]);
    }
}
