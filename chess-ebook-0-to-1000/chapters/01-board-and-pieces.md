# Chapter 1: The Board and Pieces (ELO 0 -> 200)

*"You cannot play a symphony before you've tuned your instrument."*

---

## 1.1 The Chessboard

Before touching a single piece, you must know the battlefield.

### The 64 Squares

A chessboard has **64 squares** arranged in an 8x8 grid. The squares alternate between **light** and **dark**.

```
    a   b   c   d   e   f   g   h
8  |   |   |   |   |   |   |   |   |  8
7  |   |   |   |   |   |   |   |   |  7
6  |   |   |   |   |   |   |   |   |  6
5  |   |   |   |   |   |   |   |   |  5
4  |   |   |   |   |   |   |   |   |  4
3  |   |   |   |   |   |   |   |   |  3
2  |   |   |   |   |   |   |   |   |  2
1  |   |   |   |   |   |   |   |   |  1
    a   b   c   d   e   f   g   h
```

### Files and Ranks

- **Files** are vertical columns (a-h). File a is on White's left.
- **Ranks** are horizontal rows (1-8). Rank 1 is White's home row.
- Every square has a unique name: **file + rank** (e.g., e4, h1, a8).

### The Golden Rule of Setup

> **"Light square on the right."**

When sitting at the board, the bottom-right corner square (h1 for White, a8 for Black) must be a light square. If it's dark, you've set the board wrong.

### Center vs. Edge

The four center squares -- **d4, d5, e4, e5** -- are the most important real estate on the board. A piece in the center controls more squares than a piece on the edge.

- A knight on e4 attacks 8 squares
- A knight on a1 attacks only 2 squares

**Key Insight:** You want your pieces in or near the center. Always.

---

## 1.2 The Pieces

There are **6 types of pieces**, each with unique movement patterns.

### The King (K)

**Value:** The game itself. Lose the king, lose the game.

**Movement:** One square in any direction -- horizontal, vertical, or diagonal.

```
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . x x x . . .
. . x K x . . .  <- King on e4, can move to any 'x'
. . x x x . . .
. . . . . . . .
. . . . . . . .
```

**Special rules:**
- Cannot move into check (onto a square attacked by an enemy piece)
- Cannot move next to the enemy king (kings must stay one square apart)
- **Castling** (see Section 1.5): A special move with the rook

### The Queen (Q)

**Value:** 9 points. Your most powerful piece.

**Movement:** Any number of squares in any direction -- horizontally, vertically, or diagonally. Think: rook + bishop combined.

```
. . . x . . . .
x . . x . . . x
. x . x . x . .
. . x x x . . .
x x x Q x x x x  <- Queen on d4
. . x x x . . .
. x . x . x . .
x . . x . . . x
```

### The Rook (R)

**Value:** 5 points.

**Movement:** Any number of squares horizontally or vertically.

```
. . . x . . . .
. . . x . . . .
. . . x . . . .
. . . x . . . .
x x x R x x x x  <- Rook on e4
. . . x . . . .
. . . x . . . .
. . . x . . . .
```

### The Bishop (B)

**Value:** 3 points.

**Movement:** Any number of squares diagonally. Each bishop stays on squares of one color for its entire life -- a "light-squared bishop" or "dark-squared bishop."

```
x . . . . . . x
. x . . . . x .
. . x . . x . .
. . . x x . . .
. . . B x . . .  <- Bishop on d4
. . . x x . . .
. . x . . x . .
x . . . . . . x
```

### The Knight (N)

**Value:** 3 points.

**Movement:** In an "L" shape -- two squares in one direction, then one square perpendicular. The knight is the only piece that can **jump over other pieces**.

```
. . . . . . . .
. . x . x . . .
. x . . . x . .
. . . N . . . .  <- Knight on d4
. x . . . x . .
. . x . x . . .
. . . . . . . .
. . . . . . . .
```

**Memory trick:** Think of a knight move as "one-two-and-turn" -- one square straight, two squares straight, then turn to the side for one.

### The Pawn (P)

**Value:** 1 point. But don't underestimate them -- pawns are the soul of chess.

**Movement:**
- **Forward only**, one square at a time
- On its **first move only**, a pawn may advance **two squares**
- Pawns **capture diagonally** (one square forward-left or forward-right)

```
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . x x . . . .
. . . P . . . .  <- White pawn on e4
. . . . . . . .
. . . . . . . .
```

The pawn on e4 can:
- Move to e5 (one square forward)
- Capture on d5 (diagonal left)
- Capture on f5 (diagonal right)

**Critical rule:** Pawns capture differently than they move. This is the #1 mistake beginners make.

---

## 1.3 Piece Values (The Point System)

Understanding piece values helps you make good trades:

| Piece | Points | Nickname |
|-------|--------|----------|
| Queen | 9 | The Powerhouse |
| Rook | 5 | The Tower |
| Bishop | 3 | The Sniper |
| Knight | 3 | The Trickster |
| Pawn | 1 | The Soldier |

**The king has no point value** -- it's priceless. You can never trade your king.

### Good Trades, Bad Trades

- **Winning a trade:** Trading a knight (3) for a rook (5) = +2 advantage
- **Losing a trade:** Trading a rook (5) for a bishop (3) = -2 disadvantage
- **Equal trade:** Bishop (3) for knight (3) = even

**The Rule of Thumb:** Don't trade a stronger piece for a weaker one unless you get something concrete in return (checkmate, a winning attack, or a soon-to-be-promoted pawn).

---

## 1.4 The Starting Position

```
    a   b   c   d   e   f   g   h
8  | r   n   b   q   k   b   n   r |  8  Black
7  | p   p   p   p   p   p   p   p |  7
6  | .   .   .   .   .   .   .   . |  6
5  | .   .   .   .   .   .   .   . |  5
4  | .   .   .   .   .   .   .   . |  4
3  | .   .   .   .   .   .   .   . |  3
2  | P   P   P   P   P   P   P   P |  2
1  | R   N   B   Q   K   B   N   R |  1  White
    a   b   c   d   e   f   g   h
```

**Setup checklist:**
1. Rooks in the corners (a1, h1, a8, h8)
2. Knights next to rooks (b1, g1, b8, g8)
3. Bishops next to knights (c1, f1, c8, f8)
4. Queen on her own color: White queen on d1 (light), Black queen on d8 (dark)
5. King on the remaining center square
6. Pawns fill the second rank for each side

**Memory trick:** "Queen on her own color." If White's queen is on a dark square, something is wrong.

---

## 1.5 Special Moves

### Castling

The only move where you move two pieces at once -- the king moves two squares toward a rook, and the rook jumps over the king.

**Requirements (all must be true):**
1. Neither the king nor the castling rook has moved yet
2. No pieces between the king and the rook
3. The king is not in check
4. The king does not move through or into check

**Kingside castling (O-O):** King moves to g1/g8, rook to f1/f8

**Queenside castling (O-O-O):** King moves to c1/c8, rook to d1/d8

### En Passant

French for "in passing." If a pawn moves two squares forward (using its first-move privilege) and lands beside an enemy pawn, the enemy pawn can capture it *as if it had only moved one square*.

This capture must be made **immediately** on the very next move -- or the opportunity is lost forever.

### Pawn Promotion

When a pawn reaches the opposite end of the board (rank 8 for White, rank 1 for Black), it must promote to a queen, rook, bishop, or knight of the same color. Nearly always, you promote to a **queen**.

---

## 1.6 Check, Checkmate, and Stalemate

### Check

The king is under attack. The player in check **must** get out of check on their next move. There are three ways:

1. **Move** the king to a safe square
2. **Block** the check by putting a piece between the king and attacker (doesn't work against knights)
3. **Capture** the checking piece

### Checkmate

The king is in check and **none of the three escape methods work**. The game ends immediately -- the player who delivered checkmate wins.

The fastest possible checkmate is **Fool's Mate** (two moves):
```
1. f3?  e5
2. g4?? Qh4#
```

### Stalemate

The king is **not** in check, but the player has **no legal moves**. The game ends in a draw (tie). Stalemate is a common pitfall for beginners -- you must always give the opponent's king a legal square when you're winning!

---

## 1.7 Your First Goal: The Ladder Mate

Before you learn anything else, learn to checkmate with **king + queen vs. king** (or king + rook). This is called the "ladder mate" because you push the enemy king to the edge like climbing rungs of a ladder.

**The Method (with Queen):**
1. Use your queen to cut off the enemy king -- place it a "knight's move away"
2. When the enemy king is on the edge, bring your own king close
3. Deliver checkmate with the queen protected by your king

**Practice this 20 times.** If you can't do this in your sleep, you're not ready for ELO 200.

---

## Chapter 1 Summary

| Concept | What You Must Know |
|---------|-------------------|
| Board layout | Files a-h, ranks 1-8, light square on right |
| Piece movement | All 6 pieces, how they move and capture |
| Piece values | Q=9, R=5, B=3, N=3, P=1 |
| Special moves | Castling, en passant, promotion |
| Check vs. Checkmate vs. Stalemate | Know the difference cold |
| Ladder mate | K+Q vs K checkmate pattern |

**Checkpoint:** Can you set up the board from memory? Do you know how every piece moves without hesitation? Can you checkmate a lone king with king + queen? If yes, proceed to Chapter 2.
