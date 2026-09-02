package com.chess99.presentation.common

import com.chess99.engine.ChessGame
import com.chess99.engine.Move
import com.chess99.engine.Piece
import com.chess99.engine.Square

/**
 * Extra things the board animates on top of the plain from -> to slide.
 *
 * Kept as one value rather than three loose parameters so a call site that has
 * no move to show can pass [None], and so [ChessBoardView] can key its
 * animation on it without a three-way comparison.
 */
data class MoveEffects(
    /** Piece code that left the board, or [Piece.NONE]. */
    val capturedPiece: Int = Piece.NONE,
    /**
     * Square the captured piece was standing on. Equal to the move's
     * destination for an ordinary capture, but *not* for en passant, where the
     * captured pawn sits on the mover's origin rank.
     */
    val capturedSquare: Int = -1,
    /** True when the arriving pawn turned into another piece. */
    val isPromotion: Boolean = false,
) {
    val hasCapture: Boolean get() = capturedPiece != Piece.NONE && capturedSquare >= 0

    companion object {
        /** Nothing to animate beyond the slide itself. */
        val None = MoveEffects()
    }
}

/**
 * One ply of a replayed game, resolved down to the board squares it touched so
 * a replay screen can hand them straight to [ChessBoardView].
 */
data class ReplayPly(
    /** The move exactly as the caller supplied it (SAN, UCI, whatever). */
    val token: String,
    /** SAN as this engine renders it — useful when the source was coordinates. */
    val san: String,
    /** 0x88 origin square. */
    val from: Int,
    /** 0x88 destination square. */
    val to: Int,
    val effects: MoveEffects = MoveEffects.None,
    /** Position after this ply. */
    val fenAfter: String = "",
)

/**
 * Turns a game's move list into per-ply square pairs.
 *
 * Replay screens (game detail, public replay, full review, puzzle solutions)
 * know *which position* they are showing but not *which move* produced it.
 * Replaying the moves once through a [ChessGame] answers that for every ply at
 * a fraction of the cost of re-deriving it on each recomposition.
 */
object MoveReplay {

    /**
     * Finds the legal move a token refers to **without playing it**, so the
     * caller can read the pre-move board (what got captured) before advancing.
     *
     * Accepts SAN ("Nf3", "exd6", "O-O", check/annotation suffixes tolerated),
     * UCI ("e2e4", "e7e8q") and bare coordinates ("e2e4").
     */
    fun findLegal(game: ChessGame, token: String): Move? {
        val trimmed = token.trim()
        if (trimmed.isEmpty()) return null
        val legal = game.legalMoves()
        if (legal.isEmpty()) return null

        val wantedSan = normalizeSan(trimmed)
        legal.firstOrNull { normalizeSan(it.san(game)) == wantedSan }?.let { return it }

        val lower = trimmed.lowercase()
        legal.firstOrNull { it.uci() == lower }?.let { return it }

        // Coordinates without (or with an unusable) promotion suffix.
        val (from, to) = coordinates(lower) ?: return null
        return legal.firstOrNull { it.from == from && it.to == to }
    }

    /** What [ChessBoardView] needs to animate beyond the slide for [move]. */
    fun effectsOf(move: Move): MoveEffects {
        val capturedSquare = when {
            move.captured == Piece.NONE -> -1
            // The en-passant victim is on the destination file but the mover's
            // origin rank, never on the destination square itself.
            move.isEnPassant -> Square.rank(move.from) * 16 + Square.file(move.to)
            else -> move.to
        }
        return MoveEffects(
            capturedPiece = if (capturedSquare < 0) Piece.NONE else move.captured,
            capturedSquare = capturedSquare,
            isPromotion = move.promotion != 0,
        )
    }

    /**
     * Replays [tokens] from [startFen] and returns one entry per ply.
     *
     * Stops at the first token that cannot be played: once a game desynchronises
     * every later ply is about a position that never happened, and a half-wrong
     * highlight is worse than none.
     */
    fun replay(
        tokens: List<String>,
        startFen: String = ChessGame.STARTING_FEN,
    ): List<ReplayPly> {
        val game = try {
            ChessGame(startFen)
        } catch (_: Exception) {
            return emptyList()
        }
        val plies = mutableListOf<ReplayPly>()
        for (token in tokens) {
            val move = findLegal(game, token) ?: break
            val san = move.san(game)
            val effects = effectsOf(move)
            if (game.moveUci(move.uci()) == null) break
            plies += ReplayPly(
                token = token,
                san = san,
                from = move.from,
                to = move.to,
                effects = effects,
                fenAfter = game.fen(),
            )
        }
        return plies
    }

    /**
     * The ply that produced the position reached after [positionIndex] plies,
     * where 0 is the starting position.
     *
     * Stepping backwards therefore highlights the move that led to what is on
     * screen, not the move that was just undone.
     */
    fun plyAtPosition(plies: List<ReplayPly>, positionIndex: Int): ReplayPly? =
        plies.getOrNull(positionIndex - 1)

    /** SAN with check/mate/annotation marks and `0-0` spelling smoothed out. */
    private fun normalizeSan(san: String): String =
        san.trim()
            .trimEnd('+', '#', '!', '?')
            .replace('0', 'O')

    private fun coordinates(token: String): Pair<Int, Int>? {
        if (token.length < 4) return null
        val from = squareOrNull(token[0], token[1]) ?: return null
        val to = squareOrNull(token[2], token[3]) ?: return null
        return from to to
    }

    private fun squareOrNull(file: Char, rank: Char): Int? {
        if (file !in 'a'..'h' || rank !in '1'..'8') return null
        return Square.fromAlgebraic("$file$rank")
    }
}
