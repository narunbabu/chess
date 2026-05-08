# Chapter 2: Basic Principles (ELO 200 -> 400)

*"Chess is 99% tactics." -- Richard Teichmann*

---

## 2.1 The Three Golden Rules of the Opening

For the first 10-15 moves of every game, you have three jobs. Memorize them:

### Rule 1: Control the Center

The center squares (e4, d4, e5, d5) are the high ground. Pieces in the center attack more squares and reach both sides of the board faster.

**Good first moves:** 1. e4, 1. d4, 1. Nf3, 1. c4
**Bad first moves:** 1. a4, 1. h4, 1. Na3 (these ignore the center)

**The test:** After every move, ask yourself -- "Did this move increase my control over the center?"

### Rule 2: Develop Your Pieces (Quickly!)

"Development" means bringing your pieces off the back rank and into the game. An undeveloped piece is a soldier asleep in the barracks.

**The ideal first 10 moves:**
- Move both center pawns (e4/d4 for White, e5/d5 for Black)
- Bring out both knights (usually to c3/f3 or c6/f6)
- Bring out both bishops (to active diagonals)
- Castle to safety

**The rule of thumb:** Don't move the same piece twice in the opening unless forced. Every time you move a piece that's already developed, you waste time another piece could have used.

### Rule 3: King Safety (Castle Early!)

An uncastled king is a vulnerable king. Castle within the first 5-10 moves.

**Which side?**
- **Kingside** (O-O): Faster (only 2 pieces to move first), safer in most positions
- **Queenside** (O-O-O): Useful when you want to attack on the kingside

When in doubt, castle kingside. Until ELO 1000, castling queenside is usually overthinking it.

### What NOT to Do in the Opening

| Mistake | Why It's Bad |
|---------|-------------|
| Bringing the queen out early | She becomes a target, and you waste moves retreating |
| Moving pawns on the edge (a4, h4) | Doesn't help development or center control |
| Making too many pawn moves | Pawns don't "develop" -- pieces do |
| Not castling | Your king sits in the center, an open target |
| Opening with the rook's pawn | Literally the worst first move. Don't. |

---

## 2.2 Developing a "Board Sense"

Between ELO 200-400, most games are lost because one player simply doesn't see that their piece is being attacked.

### The Pre-Move Checklist

Before you touch a piece, ask three questions:

1. **Checks:** Can I check my opponent? Can my opponent check me?
2. **Captures:** What can I capture? What can my opponent capture (especially my undefended pieces)?
3. **Threats:** What am I threatening? What is my opponent threatening?

This is the **CCT Framework** (Checks, Captures, Threats) -- which we will dive deep into in Chapter 3. For now, get in the habit of scanning for CCT on every move.

### Hanging Pieces

A "hanging" piece is one that is undefended and can be captured for free. At the 200-400 level, most decisive advantages come from simply not hanging your pieces and capturing your opponent's hanging pieces.

**Exercise:** Before every move, scan the entire board and ask: "Does my opponent have any pieces that aren't protected? Do I have any undefended pieces they could take?"

---

## 2.3 Counting Attackers and Defenders

When pieces clash, you need to know who comes out ahead.

### The Counting Rule

Before capturing, count:
1. How many of your pieces attack the target square
2. How many of your opponent's pieces defend it
3. The value of the pieces involved

**If attackers > defenders:** You can safely capture -- your opponent will run out of pieces first.

**If attackers = defenders:** The exchange may be equal, but if you're capturing with a lesser piece first, you might win material.

### Example: Attacking a Defended Pawn

```
White wants to capture the pawn on d5.
d5 is defended by Black's knight on f6 and queen on d8.

White attacks d5 with: knight on c3, bishop on g2, pawn on e4.

Attackers (Nc3, Bg2, e-pawn) = 3
Defenders (Nf6, Qd8) = 2

3 > 2 -> White can win the pawn!
```

But be careful: the **order of captures matters**. Capture with the least valuable piece first.

In this case: pawn takes (1), then knight/queen trade (if they recapture), then bishop takes -- White ends up winning a pawn.

---

## 2.4 Introduction to Tactics

Tactics are short, forcing sequences that win material or deliver checkmate. At the 200-400 level, you need to master three basic patterns.

### The Fork

A single piece attacks two (or more) enemy pieces simultaneously. The opponent can only save one.

**The Knight Fork** is the most common and dangerous fork because knights jump in unexpected ways.

```
White knight on e5:
  - Checks Black king on g8
  - Attacks Black queen on d7
  
Black must move the king, losing the queen.
```

**Position to remember:** A knight on e5 (or e4 for Black) forking king + rook is one of the most common tactical wins at beginner level.

### The Pin

A piece is "pinned" when moving it would expose a more valuable piece behind it to attack.

**Absolute pin:** The pinned piece **cannot** legally move (because it would expose the king to check).

**Relative pin:** The piece *can* move, but doing so loses material.

```
Black bishop on b4 pins White knight on c3 to the king on e1.
The knight cannot move -- it's absolutely pinned.
```

**Exploiting a pin:** Attack the pinned piece with a pawn or lesser piece. It can't run away!

### The Skewer

Like a pin, but the more valuable piece is in front. The front piece must move, exposing the piece behind to capture.

```
White rook on e1, Black king on e8, Black queen on a8 (same rank).
The rook checks the king -- the king must move, and then rook captures queen.

This is an "X-ray" attack through the king to the queen.
```

### The Discovered Attack

When you move a piece and uncover an attack from another piece behind it. Devastating when combined with check.

```
White bishop on c4, White knight on d5, Black queen on a5, Black king on g8.
Knight moves from d5 to f6 -- DISCOVERED CHECK from the bishop!
After king moves, knight captures the queen on a5 (if she moved to h5, say).
```

---

## 2.5 Basic Checkmate Patterns

At ELO 200-400, you must be able to recognize and execute these checkmates without thinking.

### Back Rank Mate

The enemy king is trapped on the back rank by its own pawns. A rook or queen delivers checkmate along that rank.

```
    a   b   c   d   e   f   g   h
8  | .   .   .   .   .   R   .   k |  8
7  | .   .   .   .   .   .   .   p |  7
6  | .   .   .   .   .   .   p   . |  6
    (White rook to e8 is checkmate)
```

**Prevention:** Give your king "luft" (air) by moving a pawn in front of the castled king (h3/h6 or g3/g6).

### Smothered Mate

A knight delivers checkmate to a king completely surrounded by its own pieces.

```
Black king on g8, surrounded by rook on f8 and pawns on g7, h7.
White knight on h6 checks. The king can't move -- smothered mate!
```

### Queen + Knight/Bishop Mate

Queen protected by a knight or bishop, delivering checkmate to a king on the edge:

```
White king on g6, White queen on h7, Black king on h8.
The queen delivers checkmate defended by the king -- king can't capture.
```

---

## 2.6 Common Beginner Mistakes (And How to Fix Them)

### Mistake 1: Copycat Chess

Just mirroring the opponent's moves. This is dangerous because the player who copies moves *second* is always one move behind when the original player breaks the pattern with a capture or check.

**Fix:** Play your own plan. Don't just mirror.

### Mistake 2: Premature Attacks

Attacking before you've finished development. You bring 2-3 pieces while the opponent has all pieces developed -- your attack fizzles, and they counter-attack.

**Fix:** Complete development first. Castle. Then attack.

### Mistake 3: Trading for No Reason

Capturing pieces just because you can, without asking if the trade benefits you.

**Fix:** Before every capture, ask: "Does this trade improve my position?" If you're not sure, don't capture.

### Mistake 4: Neglecting King Safety

Leaving the king in the center past move 10, or pushing pawns in front of a castled king without purpose.

**Fix:** Castle early. Think twice before moving pawns in front of your king.

### Mistake 5: Resigning Too Early

At the 200-400 level, comebacks happen constantly. Opponents blunder, stalemate you, or flag in time trouble.

**Fix:** Never resign. Make your opponent prove they can win.

---

## Chapter 2 Summary

| Principle | Key Takeaway |
|-----------|-------------|
| Three opening rules | Center, develop, castle |
| Pre-move checklist | Checks -> Captures -> Threats |
| Counting | Attackers vs. Defenders |
| Basic tactics | Fork, pin, skewer, discovered attack |
| Checkmate patterns | Back rank, smothered, queen support |
| Common mistakes | Don't mirror, don't attack undeveloped, castle early |

**Checkpoint:** Can you name the three opening rules? Can you spot a fork, pin, or skewer when it's on the board? Do you count attackers and defenders before capturing? If yes, proceed to Chapter 3.
