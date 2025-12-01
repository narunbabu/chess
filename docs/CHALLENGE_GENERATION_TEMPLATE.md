# 🎯 Chess Tutorial Challenge Generation Template

**Version:** 1.0
**Last Updated:** December 1, 2025
**Purpose:** Complete guide for frontend developers to create chess tutorial challenges

---

## 📋 Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Template Library](#template-library)
3. [Puzzle Challenge Templates](#puzzle-challenge-templates)
4. [Interactive Challenge Templates](#interactive-challenge-templates)
5. [Theory Lesson Templates](#theory-lesson-templates)
6. [Validation & Testing](#validation--testing)
7. [Common Tactical Patterns](#common-tactical-patterns)
8. [FEN Position Generator](#fen-position-generator)

---

## 🚀 Quick Start Guide

### Step 1: Choose Challenge Type

```javascript
const CHALLENGE_TYPES = {
  PUZZLE: 'puzzle',           // Single position, find the best move
  INTERACTIVE: 'interactive', // Multi-stage guided learning
  THEORY: 'theory',          // Educational content with quizzes
  PRACTICE: 'practice_game'  // Play against AI
};
```

### Step 2: Select Difficulty Tier

```javascript
const DIFFICULTY_TIERS = {
  BEGINNER: { rating: 1-3, xp: 10-30 },
  INTERMEDIATE: { rating: 4-6, xp: 35-60 },
  ADVANCED: { rating: 7-10, xp: 65-150 }
};
```

### Step 3: Use Template Below

Copy the appropriate template, fill in your content, validate FEN, test in frontend.

---

## 📚 Template Library

### 🧩 **PUZZLE TEMPLATE: Single Move Tactic**

```json
{
  "module_slug": "basic-tactics",
  "lesson": {
    "title": "Fork: Knight Attacks Two Pieces",
    "slug": "knight-fork-1",
    "lesson_type": "puzzle",
    "difficulty_rating": 3,
    "sort_order": 1,
    "estimated_duration_minutes": 5,
    "xp_reward": 25,
    "content_data": {
      "type": "puzzle",
      "puzzles": [
        {
          "fen": "r3k2r/8/8/8/4N3/8/8/4K3 w KQkq - 0 1",
          "objective": "Win material with a knight fork",
          "solution": ["Nf6+"],
          "hints": [
            "The knight can attack multiple pieces at once",
            "Look for a check that also attacks another piece",
            "Knights are excellent for forks due to their unique movement"
          ],
          "explanation": "After Nf6+, the knight gives check to the king on e8 and simultaneously attacks the rook on h8. Black must move the king, allowing White to capture the rook with Nxh8."
        }
      ]
    }
  }
}
```

**Usage Notes:**
- FEN must be valid position
- Solution uses algebraic notation (Nf6+, not f6)
- Hints should be progressive (easier → harder)
- Explanation shown after completion

---

### 🧩 **PUZZLE TEMPLATE: Multi-Move Combination**

```json
{
  "module_slug": "intermediate-tactics",
  "lesson": {
    "title": "Smothered Mate Pattern",
    "slug": "smothered-mate-1",
    "lesson_type": "puzzle",
    "difficulty_rating": 6,
    "sort_order": 1,
    "estimated_duration_minutes": 8,
    "xp_reward": 50,
    "content_data": {
      "type": "puzzle",
      "puzzles": [
        {
          "fen": "5rk1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
          "objective": "Deliver checkmate in 2 moves",
          "solution": ["Qd8+", "Rxd8", "Nf7#"],
          "move_sequence": [
            {
              "move": "Qd8+",
              "explanation": "Queen sacrifice forces the rook to capture"
            },
            {
              "move": "Rxd8",
              "explanation": "Black must capture the queen"
            },
            {
              "move": "Nf7#",
              "explanation": "Smothered mate! The knight delivers checkmate with the king trapped by its own pieces"
            }
          ],
          "hints": [
            "This is a forcing sequence - start with a sacrifice",
            "Look for a way to trap the king with its own pieces",
            "The knight delivers the final blow"
          ],
          "tags": ["sacrifice", "smothered_mate", "checkmate_pattern"]
        }
      ]
    }
  }
}
```

**Usage Notes:**
- `move_sequence` provides step-by-step explanation
- Each move in sequence should be validated
- Tags help with categorization and filtering

---

### 🎮 **INTERACTIVE TEMPLATE: Pawn Endgame Training**

```json
{
  "module_slug": "endgame-mastery",
  "lesson": {
    "title": "King and Pawn vs King",
    "slug": "kpk-endgame",
    "lesson_type": "interactive",
    "difficulty_rating": 5,
    "sort_order": 1,
    "estimated_duration_minutes": 20,
    "xp_reward": 75,
    "content_data": {
      "description": "Master the fundamental King and Pawn endgame",
      "learning_objectives": [
        "Understand the square rule",
        "Learn king opposition",
        "Master the key squares concept",
        "Practice promotion technique"
      ]
    },
    "interactive_config": {
      "allow_all_moves": false,
      "show_coordinates": true,
      "blindfold_mode": false,
      "auto_reset_on_success": true,
      "reset_delay_ms": 2000,
      "show_feedback": true,
      "enable_hints": true,
      "max_hints_per_stage": 2
    },
    "interactive_type": "endgame_training",
    "stages": [
      {
        "stage_order": 1,
        "title": "The Square Rule",
        "instruction_text": "Can your king catch the passed pawn? Use the square rule to decide whether to pursue the pawn or push your own!",
        "initial_fen": "8/8/8/3k4/8/8/5P2/4K3 w - - 0 1",
        "orientation": "white",
        "goals": [
          {
            "type": "make_move",
            "valid_moves": ["f2f4", "f2f3"],
            "best_move": "f2f4",
            "feedback_success": "✅ Correct! Push your pawn because the black king cannot catch it using the square rule.",
            "feedback_fail": "❌ Think about whether the black king can catch your pawn. Use the square rule!",
            "score_reward": 20
          }
        ],
        "hints": [
          "Draw an imaginary square from the pawn to the 8th rank",
          "If the enemy king is outside this square, push the pawn!",
          "f2-f8 creates a 6x6 square. Is the black king inside?"
        ],
        "visual_aids": {
          "arrows": [
            {"from": "f2", "to": "f8", "color": "green"}
          ],
          "highlights": ["f2", "f3", "f4", "f5", "f6", "f7", "f8"]
        },
        "auto_reset_on_success": true,
        "auto_reset_delay_ms": 2000,
        "feedback_messages": {
          "success": "🎯 Perfect understanding of the square rule!",
          "partial": "👍 Close, but consider the square rule more carefully",
          "fail": "📐 Review the square rule: can the king catch the pawn?"
        }
      },
      {
        "stage_order": 2,
        "title": "Gain the Opposition",
        "instruction_text": "Position your king to gain the opposition and support your pawn's advance!",
        "initial_fen": "8/8/4k3/8/4P3/8/4K3/8 w - - 0 1",
        "orientation": "white",
        "goals": [
          {
            "type": "make_move",
            "valid_moves": ["Ke3"],
            "best_move": "Ke3",
            "feedback_success": "✅ Excellent! You gained the opposition. The kings face each other with one square between.",
            "feedback_fail": "❌ Not quite. Position your king directly opposite the black king with one square between.",
            "score_reward": 25
          }
        ],
        "hints": [
          "Opposition means the kings face each other with one square between",
          "The player who must move loses the opposition",
          "Move your king to face the black king"
        ],
        "visual_aids": {
          "arrows": [
            {"from": "e2", "to": "e3", "color": "blue"}
          ],
          "highlights": ["e3", "e6"]
        },
        "auto_reset_on_success": true,
        "auto_reset_delay_ms": 2000,
        "feedback_messages": {
          "success": "👑 Perfect opposition! This is a fundamental endgame skill.",
          "fail": "🤔 Think about king placement - direct opposition is key"
        }
      },
      {
        "stage_order": 3,
        "title": "Promote the Pawn",
        "instruction_text": "Use your king and pawn coordination to promote! Remember: the king must lead the pawn.",
        "initial_fen": "8/8/8/3k4/3P4/3K4/8/8 w - - 0 1",
        "orientation": "white",
        "goals": [
          {
            "type": "reach_square",
            "target_squares": ["d8"],
            "piece_type": "pawn",
            "feedback_success": "✅ Promotion achieved! You mastered king and pawn coordination.",
            "feedback_fail": "❌ The pawn was lost. Remember: king must clear the path first.",
            "score_reward": 30
          }
        ],
        "hints": [
          "The king must stay in front of or beside the pawn",
          "Don't push the pawn unless the king controls the squares ahead",
          "Use opposition to force the enemy king back"
        ],
        "visual_aids": {
          "arrows": [
            {"from": "d4", "to": "d8", "color": "gold"}
          ],
          "highlights": ["d5", "d6", "d7", "d8"]
        },
        "auto_reset_on_success": false,
        "auto_reset_delay_ms": 3000,
        "feedback_messages": {
          "success": "🏆 Masterful technique! You've mastered the King and Pawn endgame!",
          "fail": "⚠️ Coordinate king and pawn carefully - the king leads!"
        }
      }
    ]
  }
}
```

**Interactive Stage Goal Types:**

```javascript
const GOAL_TYPES = {
  make_move: {
    description: "Execute specific move(s)",
    params: ["valid_moves", "best_move"],
    example: { "type": "make_move", "valid_moves": ["Nf6+"], "best_move": "Nf6+" }
  },
  reach_square: {
    description: "Move piece to target square(s)",
    params: ["target_squares", "piece_type"],
    example: { "type": "reach_square", "target_squares": ["e5"], "piece_type": "king" }
  },
  avoid_square: {
    description: "Don't move to forbidden squares",
    params: ["forbidden_squares"],
    example: { "type": "avoid_square", "forbidden_squares": ["e4", "d4"] }
  },
  capture_piece: {
    description: "Capture specific piece",
    params: ["target_piece", "target_square"],
    example: { "type": "capture_piece", "target_piece": "knight", "target_square": "f6" }
  },
  create_pattern: {
    description: "Create specific tactical pattern",
    params: ["pattern_type"],
    example: { "type": "create_pattern", "pattern_type": "fork" }
  }
};
```

---

### 📖 **THEORY TEMPLATE: Educational Content**

```json
{
  "module_slug": "opening-principles",
  "lesson": {
    "title": "The Italian Game",
    "slug": "italian-game-basics",
    "lesson_type": "theory",
    "difficulty_rating": 4,
    "sort_order": 1,
    "estimated_duration_minutes": 15,
    "xp_reward": 35,
    "content_data": {
      "type": "theory",
      "slides": [
        {
          "title": "Introduction to the Italian Game",
          "content": "<p>The Italian Game is one of the oldest chess openings, beginning with <strong>1.e4 e5 2.Nf3 Nc6 3.Bc4</strong>.</p><p>It focuses on rapid development and central control while preparing to castle kingside.</p>",
          "diagram": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1",
          "highlights": ["e4", "e5", "f3", "c6", "c4"]
        },
        {
          "title": "Key Opening Principles",
          "content": "<h3>The Italian Game follows classical principles:</h3><ul><li>✅ Control the center (e4, e5)</li><li>✅ Develop knights before bishops</li><li>✅ Bishop to c4 attacks f7 weakness</li><li>✅ Castle early for king safety</li><li>✅ Don't move the same piece twice in opening</li></ul>",
          "diagram": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1"
        },
        {
          "title": "Common Variations",
          "content": "<p><strong>Giuoco Piano:</strong> 3...Bc5 (Piano means 'quiet' in Italian)</p><p><strong>Two Knights Defense:</strong> 3...Nf6 (More aggressive counterplay)</p><p><strong>Hungarian Defense:</strong> 3...Be7 (Solid but passive)</p>",
          "diagram": "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1"
        },
        {
          "title": "Quick Knowledge Check",
          "content": "<p>Test your understanding of the Italian Game!</p>",
          "quiz": [
            {
              "question": "What is the main weakness that Bc4 attacks in the Italian Game?",
              "options": [
                "The e5 pawn",
                "The f7 square",
                "The d5 square",
                "The c6 knight"
              ],
              "correct": 1,
              "explanation": "The f7 square is the weakest point in Black's position early in the game, protected only by the king."
            },
            {
              "question": "Which move completes the opening sequence: 1.e4 e5 2.Nf3 Nc6 3.?",
              "options": [
                "Bb5 (Ruy Lopez)",
                "Bc4 (Italian Game)",
                "d4 (Scotch Game)",
                "Nc3 (Vienna Game)"
              ],
              "correct": 1,
              "explanation": "Bc4 is the defining move of the Italian Game, developing the bishop to an active diagonal."
            },
            {
              "question": "In the Italian Game, when should you typically castle?",
              "options": [
                "After moving all pieces",
                "Never - keep king in center",
                "Early, usually by move 6-8",
                "After exchanging queens"
              ],
              "correct": 2,
              "explanation": "Early castling (around moves 6-8) is a fundamental principle, providing king safety while connecting the rooks."
            }
          ]
        },
        {
          "title": "Practical Example",
          "content": "<p>Let's see a classic Italian Game with key moments highlighted!</p><p><strong>White:</strong> Opens with e4, develops quickly<br><strong>Black:</strong> Counters with symmetrical setup<br><strong>Result:</strong> Both sides achieve good positions</p>",
          "diagram": "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1",
          "highlights": ["e4", "e5", "c4", "c5", "g1", "g8"]
        }
      ]
    }
  }
}
```

**Theory Slide Components:**

```javascript
const SLIDE_COMPONENTS = {
  content: "HTML content (supports <p>, <h3>, <ul>, <li>, <strong>, <em>)",
  diagram: "FEN position (optional)",
  highlights: "Array of squares to highlight (optional)",
  quiz: "Array of quiz objects (optional)",
  interactive_element: "Chess board with move practice (optional)"
};
```

---

## 🎯 Common Tactical Patterns Library

### **1. FORK PATTERN**

```json
{
  "title": "Double Attack: Rook Fork",
  "fen": "r3k3/8/8/8/8/3R4/8/4K3 w - - 0 1",
  "solution": ["Rd8+"],
  "pattern": "fork",
  "explanation": "The rook moves to d8, giving check and attacking the rook on a8 simultaneously."
}
```

### **2. PIN PATTERN**

```json
{
  "title": "Absolute Pin: Bishop Pins Knight",
  "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
  "solution": ["Bg5"],
  "pattern": "pin",
  "explanation": "Bg5 pins the knight to the queen. The knight cannot move without losing the queen."
}
```

### **3. SKEWER PATTERN**

```json
{
  "title": "Reverse Pin: Rook Skewers King and Queen",
  "fen": "4k3/8/8/3q4/8/8/8/3R3K w - - 0 1",
  "solution": ["Rd8+"],
  "pattern": "skewer",
  "explanation": "Rd8+ forces the king to move, then White captures the queen with Rxd5."
}
```

### **4. DISCOVERED ATTACK**

```json
{
  "title": "Discovered Attack: Knight Reveals Bishop",
  "fen": "r2qkb1r/ppp2ppp/2n5/3pp3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
  "solution": ["Nxe5"],
  "pattern": "discovered_attack",
  "explanation": "Nxe5 captures the pawn and discovers an attack on the queen by the bishop on c4."
}
```

### **5. REMOVAL OF DEFENDER**

```json
{
  "title": "Destroy the Defender",
  "fen": "r1bq1rk1/ppp2ppp/2n5/3p4/3P4/2N5/PPP2PPP/R1BQ1RK1 w - - 0 1",
  "solution": ["Nxc6", "bxc6", "Qxd5"],
  "pattern": "removal_of_defender",
  "explanation": "First remove the knight defending d5, then capture the queen."
}
```

### **6. DEFLECTION**

```json
{
  "title": "Deflect the Defender",
  "fen": "6k1/5ppp/8/8/8/8/3Q1PPP/6K1 w - - 0 1",
  "solution": ["Qd8+", "Kh7", "Qd7"],
  "pattern": "deflection",
  "explanation": "The check deflects the king away from defending the f7 pawn."
}
```

### **7. DECOY**

```json
{
  "title": "Lure into Trap",
  "fen": "r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
  "solution": ["Nxe5", "Nxe5", "d4"],
  "pattern": "decoy",
  "explanation": "Lure the knight to e5 where it becomes a target for d4."
}
```

### **8. INTERFERENCE**

```json
{
  "title": "Block the Defense",
  "fen": "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
  "solution": ["Ra4"],
  "pattern": "interference",
  "explanation": "The rook interferes with the black rook's defense along the rank."
}
```

### **9. ZUGZWANG**

```json
{
  "title": "Forced Disadvantageous Move",
  "fen": "8/8/8/8/8/1k6/2p5/2K5 b - - 0 1",
  "solution": ["Kb2", "c1=Q+", "Kxc1"],
  "pattern": "zugzwang",
  "explanation": "Any king move by Black allows White to capture the pawn. Black is in zugzwang."
}
```

### **10. BACK RANK MATE**

```json
{
  "title": "Back Rank Weakness",
  "fen": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
  "solution": ["Rd8#"],
  "pattern": "back_rank_mate",
  "explanation": "The rook delivers checkmate on the back rank because the king is trapped by its own pawns."
}
```

---

## 🔧 FEN Position Generator Guide

### **FEN Notation Format:**

```
[piece placement] [active color] [castling] [en passant] [halfmove] [fullmove]
```

**Example:** `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`

### **Piece Symbols:**
- **White:** K (King), Q (Queen), R (Rook), B (Bishop), N (Knight), P (Pawn)
- **Black:** k, q, r, b, n, p (lowercase)
- **Empty squares:** 1-8 (number represents consecutive empty squares)

### **FEN Components:**

```javascript
const FEN_PARTS = {
  piece_placement: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
  active_color: "w",      // w = white, b = black
  castling: "KQkq",       // K = white kingside, Q = white queenside, k = black kingside, q = black queenside
  en_passant: "-",        // Target square or -
  halfmove_clock: "0",    // Moves since last capture or pawn move
  fullmove_number: "1"    // Increments after Black's move
};
```

### **Common Starting Positions:**

```javascript
const COMMON_POSITIONS = {
  starting_position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  after_e4: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  after_e4_e5: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
  kings_only: "8/8/8/8/8/8/8/K6k w - - 0 1",
  king_and_queen: "8/8/8/8/8/8/8/K2Q3k w - - 0 1"
};
```

### **FEN Validation Tools:**

```javascript
// JavaScript validation using chess.js
import { Chess } from 'chess.js';

function validateFEN(fen) {
  try {
    const chess = new Chess(fen);
    return { valid: true, chess };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Example usage:
const result = validateFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
console.log(result.valid); // true
```

### **Online FEN Validators:**
- https://lichess.org/editor
- https://www.chess.com/analysis
- https://chessboardjs.com/examples#5003

---

## ✅ Validation & Testing Checklist

### **Before Submitting Challenge JSON:**

#### **1. FEN Validation**
- [ ] All FEN strings are valid positions
- [ ] Positions are legal (no impossible piece placements)
- [ ] Castling rights are correct
- [ ] En passant squares are valid (if applicable)

#### **2. Move Notation**
- [ ] Solution moves use algebraic notation (e.g., "Nf3", "e4", "O-O")
- [ ] Multi-move sequences are in correct order
- [ ] Check symbols (+) and checkmate (#) are used correctly
- [ ] Promotion moves specify piece (e.g., "e8=Q" not "e8")

#### **3. Content Quality**
- [ ] Hints are progressive (easy → medium → hard)
- [ ] Explanations are clear and educational
- [ ] XP rewards match difficulty (10-30 easy, 35-60 medium, 65-150 hard)
- [ ] Objectives are specific and achievable

#### **4. Visual Aids**
- [ ] Square names are lowercase (e.g., "e4" not "E4")
- [ ] Arrow colors are valid ("green", "red", "blue", "gold", "yellow")
- [ ] Highlights don't obscure important pieces
- [ ] Visual aids support learning, not distract

#### **5. Interactive Stages**
- [ ] Stages are in logical progression
- [ ] Goals are achievable with provided position
- [ ] Feedback messages are encouraging and informative
- [ ] Auto-reset timing is appropriate (1500-3000ms)

#### **6. Theory Lessons**
- [ ] Quiz answers use 0-based indexing
- [ ] Correct answer index is accurate
- [ ] HTML content is properly formatted
- [ ] Explanations provide value beyond the question

### **Testing Procedure:**

```javascript
// Step 1: Validate FEN
const chess = new Chess(fenString);
console.log("FEN Valid:", chess.isValid());

// Step 2: Test solution moves
challenge.solution.forEach(move => {
  const result = chess.move(move);
  console.log(`Move ${move}:`, result ? "Valid" : "Invalid");
});

// Step 3: Verify position
console.log("Final position:", chess.fen());
console.log("Checkmate:", chess.isCheckmate());
console.log("Check:", chess.inCheck());

// Step 4: Test in frontend
// - Load challenge in LessonPlayer.jsx
// - Execute solution moves
// - Verify feedback displays correctly
// - Check XP award and completion flow
```

---

## 📊 Challenge Difficulty Matrix

### **Beginner (Rating 1-3, XP 10-30)**
- **Concepts:** Piece movement, basic captures, simple checkmates
- **Move depth:** 1-2 moves
- **Hints:** 3-4 detailed hints
- **Examples:** Scholar's Mate, Back Rank Mate, Pawn Promotion

### **Intermediate (Rating 4-6, XP 35-60)**
- **Concepts:** Forks, pins, skewers, discovered attacks
- **Move depth:** 2-4 moves
- **Hints:** 2-3 progressive hints
- **Examples:** Knight Forks, Bishop Pins, Rook Skewers

### **Advanced (Rating 7-10, XP 65-150)**
- **Concepts:** Complex combinations, sacrifices, endgame technique
- **Move depth:** 4-8+ moves
- **Hints:** 1-2 subtle hints
- **Examples:** Queen Sacrifices, Smothered Mate, Zugzwang

---

## 🎨 Visual Aid Guidelines

### **Arrow Colors:**

```javascript
const ARROW_COLORS = {
  green: "Recommended move or good square",
  red: "Dangerous move or attacked square",
  blue: "Defensive move or escape square",
  gold: "Winning move or promotion path",
  yellow: "Alternative move or consideration"
};
```

### **Highlight Colors:**

```javascript
const HIGHLIGHT_MEANINGS = {
  blue_light: "Target square or goal destination",
  green_light: "Safe square or good position",
  yellow_light: "Consideration square or alternative",
  red_light: "Dangerous square or forbidden area"
};
```

### **Best Practices:**
- Use **arrows** for move suggestions and sequences
- Use **highlights** for static position features (weak squares, key squares)
- Limit to **2-4 arrows** per position (avoid clutter)
- Highlight **3-6 squares** maximum per position
- Match colors to meaning consistently across all challenges

---

## 🚀 Batch Challenge Generation Template

### **Full Module Example: Tactical Mastery**

```json
{
  "module": {
    "name": "Tactical Mastery",
    "slug": "tactical-mastery",
    "skill_tier": "intermediate",
    "description": "Master all fundamental tactical patterns through 50 progressive challenges",
    "icon": "⚔️",
    "sort_order": 5,
    "estimated_duration_minutes": 300
  },
  "lessons": [
    {
      "title": "Fork Fundamentals",
      "slug": "fork-fundamentals",
      "lesson_type": "puzzle",
      "difficulty_rating": 4,
      "xp_reward": 35,
      "content_data": {
        "type": "puzzle",
        "puzzles": [
          {
            "fen": "r3k2r/8/8/8/4N3/8/8/4K3 w KQkq - 0 1",
            "objective": "Win the rook with a knight fork",
            "solution": ["Nf6+"],
            "hints": ["Attack two pieces at once", "Give check while attacking another piece"]
          },
          {
            "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
            "objective": "Fork the king and rook",
            "solution": ["Ng5"],
            "hints": ["The knight can reach f7", "Attack f7 and threaten the king"]
          }
        ]
      }
    },
    {
      "title": "Pin Tactics",
      "slug": "pin-tactics",
      "lesson_type": "puzzle",
      "difficulty_rating": 5,
      "xp_reward": 40,
      "content_data": {
        "type": "puzzle",
        "puzzles": [
          {
            "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
            "objective": "Pin the knight to the queen",
            "solution": ["Bg5"],
            "hints": ["Use the bishop", "Pin the f6 knight"]
          }
        ]
      }
    }
  ]
}
```

---

## 📝 JSON Export Format

### **Final JSON Structure for Backend:**

```json
{
  "metadata": {
    "author": "Developer Name",
    "created_at": "2025-12-01",
    "version": "1.0",
    "total_lessons": 15,
    "total_challenges": 45,
    "estimated_completion_hours": 5
  },
  "module": {
    "name": "Advanced Tactics",
    "slug": "advanced-tactics",
    "skill_tier": "advanced",
    "description": "Master complex tactical patterns",
    "icon": "🎯",
    "sort_order": 6,
    "estimated_duration_minutes": 240
  },
  "lessons": [
    // Array of lesson objects (puzzles, interactive, theory)
  ]
}
```

### **Submission Checklist:**

- [ ] JSON is valid (use JSONLint.com)
- [ ] All FEN positions validated
- [ ] All moves tested in chess.js
- [ ] Difficulty ratings appropriate
- [ ] XP rewards balanced
- [ ] Hints are helpful not solution-revealing
- [ ] Explanations are educational
- [ ] Visual aids support learning
- [ ] Metadata is complete

---

## 🎓 Example: Complete Challenge Set

### **"Pin Mastery" - 5 Progressive Challenges**

```json
{
  "module_slug": "intermediate-tactics",
  "lesson": {
    "title": "Pin Mastery: 5 Stages",
    "slug": "pin-mastery-progressive",
    "lesson_type": "puzzle",
    "difficulty_rating": 5,
    "sort_order": 1,
    "estimated_duration_minutes": 15,
    "xp_reward": 50,
    "content_data": {
      "type": "puzzle",
      "puzzles": [
        {
          "id": 1,
          "title": "Basic Pin",
          "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
          "objective": "Pin the knight to the queen",
          "solution": ["Bg5"],
          "hints": [
            "The knight on f6 is on the same diagonal as the queen",
            "A bishop can pin along diagonals",
            "Move your bishop to create the pin"
          ],
          "explanation": "Bg5 pins the knight to the queen. If the knight moves, Black loses the queen.",
          "tags": ["pin", "bishop", "beginner"]
        },
        {
          "id": 2,
          "title": "Absolute Pin",
          "fen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
          "objective": "Create an absolute pin on the knight",
          "solution": ["Bg5"],
          "hints": [
            "An absolute pin means the piece cannot legally move",
            "Pin the knight to the king, not the queen",
            "The knight would expose the king to check if it moved"
          ],
          "explanation": "This is an absolute pin because moving the knight would put the king in check, which is illegal.",
          "tags": ["absolute_pin", "bishop", "intermediate"]
        },
        {
          "id": 3,
          "title": "Breaking a Pin",
          "fen": "r1bqk2r/pppp1ppp/2n5/2b1p1B1/2B1P3/5N2/PPPP1PPP/RN1QK2R b KQkq - 0 1",
          "objective": "Find the best way to break White's pin",
          "solution": ["h6"],
          "hints": [
            "You can break a pin by attacking the pinning piece",
            "Use a pawn to attack the bishop",
            "h6 forces the bishop to make a decision"
          ],
          "explanation": "h6 attacks the pinning bishop, forcing it to move or be captured. This breaks the pin effectively.",
          "tags": ["pin_defense", "pawn_attack", "intermediate"]
        },
        {
          "id": 4,
          "title": "Pin and Win",
          "fen": "r2qkb1r/ppp2ppp/2n2n2/3p4/2B1Pb2/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
          "objective": "Use the pin to win material",
          "solution": ["d4", "dxe4", "Nxe4"],
          "hints": [
            "The bishop on e4 is pinned",
            "Attack the pinned piece with a pawn",
            "The pinned piece cannot defend itself effectively"
          ],
          "explanation": "Because the bishop is pinned, pushing d4 wins the bishop. If Black captures with dxe4, White recaptures with Nxe4.",
          "tags": ["pin_exploitation", "multi_move", "advanced"]
        },
        {
          "id": 5,
          "title": "Complex Pin Combination",
          "fen": "r1bqk2r/pp3ppp/2n1pn2/2pp4/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 1",
          "objective": "Create a winning pin combination",
          "solution": ["Qa4", "Bd7", "Qxb4"],
          "hints": [
            "The knight on c6 is defending the bishop on b4",
            "Pin the knight to remove the defender",
            "Use your queen to create the pin"
          ],
          "explanation": "Qa4 pins the knight to the king. The knight cannot move without putting the king in check, so the bishop on b4 is undefended and can be captured.",
          "tags": ["pin", "removal_of_defender", "queen_pin", "advanced"]
        }
      ]
    }
  }
}
```

---

## 🎯 Quick Reference: Move Notation Guide

### **Algebraic Notation Basics:**

```javascript
const MOVE_NOTATION = {
  pawn_move: "e4",           // Pawn to e4
  piece_move: "Nf3",         // Knight to f3
  capture: "exd5",           // Pawn on e captures on d5
  piece_capture: "Bxf7+",    // Bishop captures on f7 with check
  castling_kingside: "O-O",  // Castle kingside
  castling_queenside: "O-O-O", // Castle queenside
  promotion: "e8=Q",         // Pawn promotes to queen
  check: "Qh5+",            // Queen to h5 with check
  checkmate: "Qf7#",        // Queen to f7, checkmate
  en_passant: "exd6"        // En passant capture (context dependent)
};
```

### **Piece Letters:**
- K = King
- Q = Queen
- R = Rook
- B = Bishop
- N = Knight
- (no letter) = Pawn

---

## 🔗 Useful Resources

### **FEN Tools:**
- https://lichess.org/editor - Visual FEN editor
- https://www.chess.com/analysis - Position analysis and FEN
- https://chessboardjs.com/ - JavaScript chess board

### **Puzzle Databases:**
- https://lichess.org/training/themes - Categorized tactics
- https://www.chesstempo.com/ - Rated puzzles
- https://chessblunders.org/ - Common mistakes

### **Learning Resources:**
- https://www.chess.com/lessons - Official lessons
- https://lichess.org/learn - Interactive learning
- https://www.youtube.com/c/ChessVibesOfficial - Video tutorials

---

## 📞 Support & Questions

If you have questions about challenge creation:

1. **Check this template** for examples
2. **Validate FEN** using online tools
3. **Test JSON** with JSONLint
4. **Test in frontend** before submitting
5. **Document edge cases** in comments

---

**End of Template**
**Version 1.0 - December 2025**
**Happy Challenge Creating! 🎉**
