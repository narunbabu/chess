# Chapter 3: Tactical Foundations -- The CCT System (ELO 400 -> 600)

*"The winner of the game is the player who makes the next-to-last mistake." -- Savielly Tartakower*

This is the most important chapter in the book. The CCT system is the same framework used by the Chess99 Tactical Progression Trainer. Master this, and you will never look at a chess position the same way again.

---

## 3.1 Why Tactics Win Games at This Level

Between ELO 400-600, games are decided by tactics -- not strategy, not positional understanding, not opening theory. The player who spots one more tactic than their opponent wins.

**The hard truth:** At this level, 80% of games are decided by:
1. One player hangs a piece
2. One player misses a simple tactic
3. One player doesn't see a checkmate in 1-2 moves

Your job is to stop being the player who misses these.

---

## 3.2 The CCT Framework

**CCT stands for Checks, Captures, Threats.** It's a systematic way to analyze any position. Think of it as a pre-move checklist that you run on every single turn.

### The CCT Scan (For YOUR Move)

Before you make a move, scan in this exact order:

```
1. CHECKS:    "Can I check my opponent's king?"
2. CAPTURES:  "What can I capture? In what order?"
3. THREATS:   "What threats can I create that my opponent must respond to?"
```

**Why this order?** Checks are the most forcing -- your opponent *must* respond to a check. Captures are next -- if the piece is valuable enough, they must recapture. Threats are third -- they give your opponent choices, but good threats still force a response.

### The CCT Scan (For THEIR Move)

After your opponent moves, run the scan from their perspective:

```
1. "What check did they just threaten?"
2. "What can they capture (especially my hanging pieces)?"
3. "What threat did they create (fork, pin, discovery)?"
```

**The golden rule:** If the opponent's move looks strange or suspicious, there's probably a tactic. Ask: "What does that move threaten that wasn't threatened before?"

---

## 3.3 Checks -- The Most Forcing Move

A check must be answered. When you give check, the opponent has only three options:
1. Move the king
2. Block the check
3. Capture the checking piece

This makes checks the ultimate "forcing move" -- you control what happens next.

### Check With a Purpose

Don't check just because you can. Every check should have a goal:

| Type of Check | Purpose |
|---------------|---------|
| **Driving check** | Force the king to a worse square |
| **Discovery check** | Uncover an attack from another piece while checking |
| **Double check** | Check from two pieces simultaneously (king must move!) |
| **Checkmate** | End the game |

### The Power of Double Check

A double check is the most powerful move in chess. The king **must move** -- you cannot block or capture two checking pieces at once.

```
White king on e1, Black rook on e8, Black bishop on a5.
White knight on d4 moves to c6 -- DOUBLE CHECK!

The king must move (to d1, d2, f1, or f2).
After the king moves... the knight captures the queen on d8.
```

---

## 3.4 Captures -- The Most Common Tactic

Captures are where most material is won or lost. The key is finding the right capture order.

### The Capture Hierarchy

When multiple captures are possible on the same square:

1. **Pawns capture first** (cheapest)
2. **Minor pieces next** (knights, bishops = 3 points)
3. **Rooks next** (5 points)
4. **Queen last** (9 points)

**Always capture with the least valuable piece first.** If you lead with the queen, you might lose her.

### The Removal of the Defender

Sometimes you can't capture the piece you want because it's defended. The solution: **capture the defender first.**

```
Black knight on f6 defends the pawn on d5. White wants the d5 pawn.
White bishop captures Black knight on f6. Black recaptures.
NOW the d5 pawn is undefended -- White captures it.
```

This is called "removing the defender" or "undermining." It's one of the most common tactical ideas at the intermediate level.

### Desperado

When one of your pieces is going to be captured, make sure it takes something with it.

```
White knight on e5 is attacked by Black's pawn on d6.
White can capture the Black queen on f7 with the knight first -- even though 
the knight will be captured next move, it dies a hero.
```

A desperado piece "sells its life dearly" by taking the most valuable enemy piece it can before being captured.

---

## 3.5 Threats -- Creating Problems for Your Opponent

A threat is a move that creates a problem your opponent must solve. The best threats are those that create multiple problems at once.

### Types of Threats

| Threat | Description | Difficulty to Spot |
|--------|-------------|-------------------|
| Fork | One piece attacks two | Easy |
| Pin | Immobilize a defender | Medium |
| Skewer | Force valuable piece to move | Medium |
| Discovered attack | Uncover attack by moving a piece | Hard |
| Zwischenzug | "In-between move" before expected recapture | Hard |

### Zwischenzug (The In-Between Move)

Your opponent expects you to recapture immediately. Instead, you throw in a check or threat first, then recapture.

```
Sequence: White captures Black knight on c6. Black's natural reply is to recapture.
But before recapturing... Black checks White's king with Qa5+!
After White blocks or moves... NOW Black recaptures on c6.
```

This in-between check won the tempo and possibly material.

### Creating a Fork

The most common way to create a fork: put a piece on a square where it attacks two valuable enemy pieces.

**The Knight Fork Checklist:**
1. Scan for squares where a knight could attack two valuable pieces
2. Especially squares that fork the king and queen, or queen and rook
3. Knights on e5/e4 (for White) and e4/e5 (for Black) are common fork squares

---

## 3.6 The Blunder Check -- The Most Important Habit

Every time you're about to make a move, do a **blunder check:**

1. **What will my opponent's best reply be?**
2. **Am I moving a piece to an attacked square?**
3. **Am I leaving something undefended?**

This takes 2-3 seconds and will save you more pieces than any other single habit.

### Sitting on Your Hands

A practical tip: when you've decided on a move, sit on your hands for 5 seconds. Look at the board one more time. Ask: "Is there a check? A capture? A threat I've missed?"

Many blunders happen because players move instantly after deciding -- without doing a final blunder check.

---

## 3.7 Common Tactical Themes at the 400-600 Level

### Theme 1: The f7/f2 Square

The f7 square (for Black) and f2 square (for White) are the weakest squares on the board at the start of the game. They're only defended by the king!

**Scholar's Mate:** The classic 4-move checkmate targeting f7:
```
1. e4  e5
2. Bc4 Nc6
3. Qh5 Nf6??
4. Qxf7#
```

At ELO 400-600, opponents still fall for this. But more importantly, the **threat** of Scholar's Mate often forces weakening moves.

### Theme 2: The Knight on the Rim

"Knight on the rim is dim." A knight on the edge of the board controls half as many squares. Look for opportunities to trap a knight on the edge (a-file or h-file).

### Theme 3: Overloaded Defender

A piece that's defending two things simultaneously is "overloaded." Attack one of the things it's defending, and the defender can't protect both.

```
Black queen on d8 defends both the rook on a8 and the knight on f6.
White plays Bxf6 -- Black wants to recapture with the queen, but if she moves,
White plays Rxa8 winning the rook. The queen is overloaded!
```

### Theme 4: Discovered Attack With Tempo

Moving a piece to reveal an attack, while the moving piece also creates a threat:

```
White bishop on c4, White knight on d4, Black queen on a5, Black rook on h8.
Nf5! (threatening Nxg7+, forking king and rook)
Black must deal with the knight's threat, but meanwhile...
The bishop on c4 now attacks f7! Two threats at once.
```

---

## 3.8 Building the CCT Habit

This chapter is useless if you don't build the CCT scan into your thinking process. Here's how to practice:

### Training Method: The 30-Second CCT Scan

1. Go to any chess puzzle position
2. Set a timer for 30 seconds
3. Count: "Checks: ___ possible from me. Captures: ___ possible from me. Threats: ___ possible from me."
4. Now do the same for your opponent
5. Only AFTER the full scan, start calculating

Do this 50 times. By puzzle 50, you'll do the CCT scan in 10 seconds automatically.

### Training Method: Blind CCT

Take a chess position, study it for 30 seconds, then look away. From memory:
- Name every check you have
- Name every capture you have  
- Name every undefended enemy piece

This builds visualization -- the ability to "see" the board in your mind.

---

## 3.9 Connecting to the Chess99 Tactical Trainer

The Chess99 Tactical Progression Trainer uses exactly this CCT framework. When solving puzzles:

1. **CCT Phase 1 (Your Turn):** Click your pieces to identify your checks, captures, and threats
2. **CCT Phase 2 (Opponent's Turn):** Click enemy pieces to identify their checks, captures, and threats
3. **Solving Phase:** Only after completing both CCT phases, solve the puzzle

This mirrors exactly how you should think in a real game. Practice this in the trainer, and it becomes automatic over the board.

**Pro tip:** In the trainer, you must identify at least 50% of CCTs to proceed. This teaches you to be thorough -- don't stop after finding just one thing!

---

## Chapter 3 Summary

| Skill | What You Must Master |
|-------|---------------------|
| CCT Scan | Checks -> Captures -> Threats (every move, both sides) |
| Blunder Check | 5-second final scan before moving |
| Capture Order | Least valuable piece first |
| Removal of Defender | Capture the defender, then the target |
| Tactical Themes | f7/f2 weakness, overloaded defender, knight on rim, discovered attacks |
| CCT Practice | 50 puzzles minimum, 30-second scan each |

**Checkpoint:** Do you automatically scan for checks, captures, and threats on every move? Can you spot a fork, pin, skewer, and discovered attack? Do you do a blunder check before every move? If yes, proceed to Chapter 4.
