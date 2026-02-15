<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\TutorialAchievement;
use Illuminate\Support\Facades\DB;

class TutorialContentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->disableForeignKeyChecks();
        TutorialModule::truncate();
        TutorialLesson::truncate();
        TutorialAchievement::truncate();
        $this->enableForeignKeyChecks();

        $this->createAchievements();
        $this->createBeginnerModules();
        $this->createIntermediateModules();
        $this->createAdvancedModules();
    }

    private function createAchievements(): void
    {
        $achievements = [
            [
                'name' => 'First Steps',
                'slug' => 'first-steps',
                'description' => 'Complete your first lesson',
                'icon' => "\u{1F476}",
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 1,
                'xp_reward' => 25,
            ],
            [
                'name' => 'Chess Novice',
                'slug' => 'chess-novice',
                'description' => 'Complete 5 lessons',
                'icon' => "\u{1F393}",
                'tier' => 'bronze',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 5,
                'xp_reward' => 50,
            ],
            [
                'name' => 'Tactic Master',
                'slug' => 'tactic-master',
                'description' => 'Complete 10 tactical puzzles',
                'icon' => "\u{2694}\u{FE0F}",
                'tier' => 'silver',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 10,
                'xp_reward' => 100,
            ],
            [
                'name' => 'Week Warrior',
                'slug' => 'week-warrior',
                'description' => 'Maintain a 7-day streak',
                'icon' => "\u{1F525}",
                'tier' => 'silver',
                'requirement_type' => 'streak',
                'requirement_value' => 7,
                'xp_reward' => 75,
            ],
            [
                'name' => 'Perfectionist',
                'slug' => 'perfectionist',
                'description' => 'Score 95% or higher on any lesson',
                'icon' => "\u{1F4AF}",
                'tier' => 'silver',
                'requirement_type' => 'score',
                'requirement_value' => 95,
                'xp_reward' => 60,
            ],
            [
                'name' => 'Chess Scholar',
                'slug' => 'chess-scholar',
                'description' => 'Complete 20 lessons',
                'icon' => "\u{1F4DA}",
                'tier' => 'gold',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 20,
                'xp_reward' => 150,
            ],
            [
                'name' => 'Opening Expert',
                'slug' => 'opening-expert',
                'description' => 'Complete all opening theory lessons',
                'icon' => "\u{265F}\u{FE0F}",
                'tier' => 'gold',
                'requirement_type' => 'special',
                'requirement_value' => 1,
                'xp_reward' => 125,
            ],
            [
                'name' => 'Month Champion',
                'slug' => 'month-champion',
                'description' => 'Maintain a 30-day streak',
                'icon' => "\u{1F451}",
                'tier' => 'gold',
                'requirement_type' => 'streak',
                'requirement_value' => 30,
                'xp_reward' => 200,
            ],
            [
                'name' => 'Chess Master',
                'slug' => 'chess-master',
                'description' => 'Complete 50 lessons',
                'icon' => "\u{1F3C6}",
                'tier' => 'platinum',
                'requirement_type' => 'lessons_completed',
                'requirement_value' => 50,
                'xp_reward' => 300,
            ],
            [
                'name' => 'Endgame Virtuoso',
                'slug' => 'endgame-virtuoso',
                'description' => 'Master all endgame techniques',
                'icon' => "\u{2654}",
                'tier' => 'platinum',
                'requirement_type' => 'special',
                'requirement_value' => 1,
                'xp_reward' => 250,
            ],
        ];

        foreach ($achievements as $achievement) {
            TutorialAchievement::create($achievement);
        }
    }

    // ---------------------------------------------------------------
    // Beginner Modules (3 modules, 12 lessons)
    // ---------------------------------------------------------------

    private function createBeginnerModules(): void
    {
        $basicsModule = $this->seedChessBasicsModule();
        $rulesModule = $this->seedRulesAndGoalsModule($basicsModule);
        $this->seedFirstTacticsModule($rulesModule);
    }

    /**
     * Module 1 — Chess Basics (5 theory lessons)
     */
    private function seedChessBasicsModule(): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Chess Basics',
            'slug' => 'chess-basics',
            'skill_tier' => 'beginner',
            'description' => 'Learn the chessboard, how each piece moves, and the special rules that make chess unique.',
            'icon' => "\u{265F}\u{FE0F}",
            'sort_order' => 1,
            'estimated_duration_minutes' => 60,
        ]);

        // --- Lesson 1: The Chessboard ---
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
                        'content' => '<p>Chess is played on a square board divided into <strong>64 squares</strong> in an 8x8 grid. White pieces start on ranks 1-2, black pieces on ranks 7-8.</p>',
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

        // --- Lesson 2: The Pawns ---
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

        // --- Lesson 3: Knights & Bishops ---
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

        // --- Lesson 4: Rooks & Queen ---
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

        // --- Lesson 5: The King & Special Moves ---
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

    /**
     * Module 2 — Rules & Goals (3 theory + 1 puzzle)
     */
    private function seedRulesAndGoalsModule(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'Rules & Goals',
            'slug' => 'rules-and-goals',
            'skill_tier' => 'beginner',
            'description' => 'Understand check, checkmate, stalemate, and all the ways a chess game can end.',
            'icon' => "\u{1F3AF}",
            'sort_order' => 2,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 50,
        ]);

        // PLACEHOLDER — filled in Step 2
        $this->seedRulesAndGoalsLessons($module);

        return $module;
    }

    private function seedRulesAndGoalsLessons(TutorialModule $module): void
    {
        // --- Lesson 6: Check, Checkmate & Stalemate ---
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

        // --- Lesson 7: How Games End ---
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

        // --- Lesson 8: Pawn Promotion ---
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

        // --- Lesson 9: Basic Checkmates (puzzle) ---
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
    }

    /**
     * Module 3 — First Tactics (2 theory + 1 puzzle)
     */
    private function seedFirstTacticsModule(TutorialModule $prerequisite): TutorialModule
    {
        $module = TutorialModule::create([
            'name' => 'First Tactics',
            'slug' => 'first-tactics',
            'skill_tier' => 'beginner',
            'description' => 'Discover the basic tactical patterns that win games: forks, pins, and skewers.',
            'icon' => "\u{2694}\u{FE0F}",
            'sort_order' => 3,
            'unlock_requirement_id' => $prerequisite->id,
            'estimated_duration_minutes' => 45,
        ]);

        // PLACEHOLDER — filled in Step 2
        $this->seedFirstTacticsLessons($module);

        return $module;
    }

    private function seedFirstTacticsLessons(TutorialModule $module): void
    {
        // --- Lesson 10: Forks ---
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
                        'diagram' => 'r3k3/8/8/8/8/8/8/Q3K3 w - - 0 1',
                        'highlights' => ['a1', 'a4'],
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

        // --- Lesson 11: Pins & Skewers ---
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
                        'content' => '<p>A <strong>pin</strong> occurs when an attacking piece targets a piece that <strong>cannot move</strong> without exposing a more valuable piece behind it. Bishops, rooks, and queens can pin along lines they control.</p>',
                        'diagram' => 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3',
                    ],
                    [
                        'title' => 'Absolute vs Relative Pins',
                        'content' => '<p>An <strong>absolute pin</strong> means the pinned piece shields the king — it is <strong>illegal</strong> to move it. A <strong>relative pin</strong> means the shielded piece is valuable (like a queen) but the pinned piece <em>could</em> legally move, just at great cost.</p>',
                    ],
                    [
                        'title' => 'Skewers',
                        'content' => '<p>A <strong>skewer</strong> is the reverse of a pin. You attack a valuable piece, and when it moves out of the way, you capture the piece <strong>behind</strong> it. Skewers are especially effective against the king.</p>',
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

        // --- Lesson 12: Tactical Puzzles (puzzle) ---
        $module->lessons()->create([
            'title' => 'Tactical Puzzles',
            'slug' => 'tactical-puzzles',
            'lesson_type' => 'puzzle',
            'difficulty_rating' => 3,
            'sort_order' => 3,
            'estimated_duration_minutes' => 15,
            'xp_reward' => 100,
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
                        'hints' => ['The knight is pinned to the king along a diagonal.', 'Capture the pinned piece — it cannot escape.'],
                    ],
                    [
                        'fen' => '6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1',
                        'solution' => ['Qe8#'],
                        'hints' => ['The king is trapped by its own pawns.', 'Deliver check on the back rank.'],
                    ],
                    [
                        'fen' => '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
                        'solution' => ['Nf7#'],
                        'hints' => ['The king is surrounded by its own pieces.', 'A knight on f7 would attack h8.'],
                    ],
                ],
            ],
        ]);
    }

    // ---------------------------------------------------------------
    // Intermediate & Advanced Modules (placeholders for future content)
    // ---------------------------------------------------------------

    private function createIntermediateModules(): void
    {
        $openingModule = TutorialModule::create([
            'name' => 'Opening Principles',
            'slug' => 'opening-principles',
            'skill_tier' => 'intermediate',
            'description' => 'Master the fundamental principles of chess openings',
            'icon' => "\u{1F4D6}",
            'sort_order' => 4,
            'estimated_duration_minutes' => 75,
        ]);

        $openingModule->lessons()->create([
            'title' => 'Control the Center',
            'slug' => 'control-center',
            'lesson_type' => 'theory',
            'content_data' => [
                'type' => 'theory',
                'slides' => [
                    [
                        'title' => 'The Importance of the Center',
                        'content' => '<p>Controlling the center squares (d4, e4, d5, e5) is crucial in chess openings.</p>',
                    ],
                    [
                        'title' => 'Classical Opening Principles',
                        'content' => '<p>1. Control the center<br>2. Develop your pieces<br>3. Castle early<br>4. Don\'t move the same piece twice</p>',
                    ],
                ],
            ],
            'difficulty_rating' => 5,
            'sort_order' => 1,
            'xp_reward' => 50,
        ]);
    }

    private function createAdvancedModules(): void
    {
        $endgameModule = TutorialModule::create([
            'name' => 'Advanced Endgames',
            'slug' => 'advanced-endgames',
            'skill_tier' => 'advanced',
            'description' => 'Master complex endgame techniques and theoretical positions',
            'icon' => "\u{2655}",
            'sort_order' => 5,
            'estimated_duration_minutes' => 90,
        ]);

        $endgameModule->lessons()->create([
            'title' => 'Rook Endgames',
            'slug' => 'rook-endgames',
            'lesson_type' => 'theory',
            'content_data' => [
                'type' => 'theory',
                'slides' => [
                    [
                        'title' => 'Rook Endgame Fundamentals',
                        'content' => '<p>Rook endgames are the most common type of endgame in chess.</p>',
                    ],
                    [
                        'title' => 'Lucena Position',
                        'content' => '<p>The Lucena position is a fundamental winning technique in rook endgames.</p>',
                    ],
                ],
            ],
            'difficulty_rating' => 8,
            'sort_order' => 1,
            'xp_reward' => 60,
        ]);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private function disableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL DEFERRED;');
        }
    }

    private function enableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL IMMEDIATE;');
        }
    }
}
