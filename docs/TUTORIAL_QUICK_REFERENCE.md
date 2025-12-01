# 🚀 Tutorial Challenge Creation - Quick Reference Card

**One-Page Cheat Sheet for Frontend Developers**

---

## 📦 Basic JSON Template (Copy & Paste)

```json
{
  "module_slug": "basic-tactics",
  "lessons": [{
    "title": "Your Lesson Title",
    "slug": "your-lesson-slug",
    "lesson_type": "puzzle",
    "difficulty_rating": 3,
    "sort_order": 1,
    "estimated_duration_minutes": 5,
    "xp_reward": 25,
    "content_data": {
      "type": "puzzle",
      "puzzles": [{
        "fen": "PASTE_FEN_HERE",
        "objective": "Win material with a fork",
        "solution": ["Nf6+"],
        "hints": ["Hint 1", "Hint 2", "Hint 3"],
        "explanation": "Why this works..."
      }]
    }
  }]
}
```

---

## 🎯 Quick Workflow (5 Steps)

1. **Create Position** → https://lichess.org/editor
2. **Copy FEN** → Paste into template
3. **Test Moves** → Use chess.js or test-challenge.html
4. **Validate** → `node validate-challenge.js file.json`
5. **Done** ✅

---

## 📊 Difficulty & XP Guide

| Rating | Level | XP | Moves | Example |
|--------|-------|-----|-------|---------|
| 1-3 | Beginner | 10-30 | 1-2 | Basic fork, Back rank mate |
| 4-6 | Intermediate | 35-60 | 2-4 | Pin + win, Skewer combo |
| 7-10 | Advanced | 65-150 | 4-8+ | Queen sacrifice, Smothered mate |

---

## 🧩 Lesson Types

### Puzzle (Most Common)
```json
"lesson_type": "puzzle",
"content_data": {
  "type": "puzzle",
  "puzzles": [{ "fen": "...", "solution": ["move1", "move2"] }]
}
```

### Theory (Educational)
```json
"lesson_type": "theory",
"content_data": {
  "type": "theory",
  "slides": [{ "title": "...", "content": "<p>...</p>", "quiz": [...] }]
}
```

### Interactive (Multi-stage)
```json
"lesson_type": "interactive",
"stages": [{ "stage_order": 1, "initial_fen": "...", "goals": [...] }]
```

---

## 🔍 FEN Notation Quick Guide

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
└─────────┬─────────┘ │ └┬─┘ │ │ │
    Piece placement    │  │   │ │ └─ Fullmove number
                       │  │   │ └─── Halfmove clock
                       │  │   └───── En passant square
                       │  └───────── Castling rights
                       └──────────── Active color (w/b)
```

**Pieces:** `K Q R B N P` (white), `k q r n b p` (black)
**Empty squares:** `1-8` (consecutive empty)

---

## 📝 Move Notation

```javascript
Pawn:    "e4"         // No piece letter
Knight:  "Nf3"        // N + square
Bishop:  "Bc4"        // B + square
Rook:    "Rd1"        // R + square
Queen:   "Qh5"        // Q + square
King:    "Ke2"        // K + square

Capture: "exd5"       // piece x square
         "Nxf7"       // piece x square

Special: "O-O"        // Castle kingside
         "O-O-O"      // Castle queenside
         "e8=Q"       // Promotion
         "Qf7+"       // Check
         "Qf7#"       // Checkmate
```

---

## ✅ Validation Checklist

Before submitting:

- [ ] FEN tested on https://lichess.org/editor
- [ ] All moves work in chess.js
- [ ] Quiz `correct` index is 0-based
- [ ] Hints are progressive (easy → hard)
- [ ] XP matches difficulty
- [ ] JSON is valid (use JSONLint)
- [ ] Ran `node validate-challenge.js`

---

## 🎨 Visual Aids

### Arrows
```json
"visual_aids": {
  "arrows": [
    {"from": "e2", "to": "e4", "color": "green"}
  ]
}
```

**Colors:** `green`, `red`, `blue`, `gold`, `yellow`

### Highlights
```json
"visual_aids": {
  "highlights": ["e4", "d4", "e5", "d5"]
}
```

---

## 🐛 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Invalid FEN" | Use lichess.org/editor |
| "Invalid move" | Check piece can legally make that move |
| "Quiz index out of range" | Use 0-based (0, 1, 2, 3 for 4 options) |
| "JSON parse error" | Validate at jsonlint.com |

---

## 📞 Tools

| Tool | URL | Purpose |
|------|-----|---------|
| FEN Editor | https://lichess.org/editor | Create positions |
| Analysis | https://chess.com/analysis | Test positions |
| JSON Validator | https://jsonlint.com | Validate JSON |
| Puzzles | https://lichess.org/training | Find ideas |

---

## 🎯 Common Tactical Patterns (Copy FEN)

### Fork
```
r3k2r/8/8/8/4N3/8/8/4K3 w KQkq - 0 1
Solution: Nf6+
```

### Pin
```
r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1
Solution: Bg5
```

### Skewer
```
4k3/8/8/3q4/8/8/8/3R3K w - - 0 1
Solution: Rd8+
```

### Back Rank Mate
```
6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
Solution: Rd8#
```

---

## 💻 Quick Validation (Copy & Run)

**validate.js:**
```javascript
const { Chess } = require('chess.js');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
data.lessons.forEach(lesson => {
  lesson.content_data.puzzles.forEach(puzzle => {
    const chess = new Chess(puzzle.fen);
    puzzle.solution.forEach(move => {
      const result = chess.move(move);
      console.log(move, result ? '✅' : '❌');
    });
  });
});
```

**Run:** `node validate.js your-file.json`

---

## 📈 Daily Goal

**Target:** 10 challenges/day = 100 challenges in 10 days

**Breakdown:**
- Morning: 3-4 challenges (2 hours)
- Afternoon: 3-4 challenges (2 hours)
- Evening: 2-3 challenges (1 hour)
- Validation & testing: 30 min

---

## 🎉 Completion Checklist

Final delivery includes:

- [ ] All JSON files validated
- [ ] `merged-challenges.json` created
- [ ] `GeneratedTutorialSeeder.php` generated
- [ ] `validation-report.txt` created
- [ ] `README.md` for backend team
- [ ] ZIP package created
- [ ] Sent to backend team

---

**🚀 You're Ready! Start Creating Challenges!**

**For detailed guides, see:**
- `CHALLENGE_GENERATION_TEMPLATE.md` - Complete templates
- `TUTORIAL_DEVELOPER_WORKFLOW.md` - Step-by-step workflow
