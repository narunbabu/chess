package com.chess99.engine

import kotlin.math.max
import kotlin.random.Random

/**
 * A deterministic, dependency-free stand-in for Stockfish, used to play whole
 * games in JVM unit tests.
 *
 * The native engine ([StockfishBridge]) needs an Android device, so it cannot
 * run in a JVM test. What we actually want to verify, though, is not
 * Stockfish's strength — it is that *our* layer on top of it ([EloMoveSelector])
 * turns a ranked move list into play of the requested strength. So this class
 * supplies the one thing Stockfish supplies at runtime: a MultiPV list of legal
 * moves with centipawn scores, best first. Everything downstream is production
 * code.
 *
 * The evaluation is intentionally simple but not naive — material plus a
 * static-exchange-style penalty for whatever the opponent can win in reply —
 * which is enough to separate a good move from a piece blunder, and therefore
 * enough for rating strength to show up as a result.
 */
object SimulatedOpponent {

    const val MATE_SCORE = 100_000

    private fun value(piece: Int): Int = when (Piece.type(piece)) {
        Piece.PAWN -> 100
        Piece.KNIGHT -> 320
        Piece.BISHOP -> 330
        Piece.ROOK -> 500
        Piece.QUEEN -> 900
        else -> 0
    }

    /** Material balance from [us]'s point of view, in centipawns. */
    fun material(game: ChessGame, us: Color): Int {
        var total = 0
        for (rank in 0..7) for (file in 0..7) {
            val piece = game.get(rank * 16 + file)
            if (piece == Piece.NONE) continue
            total += if (Piece.color(piece) == us) value(piece) else -value(piece)
        }
        return total
    }

    /**
     * Static evaluation of a position *after* [us] has moved, so the side to
     * move is the opponent. Material minus the best exchange the opponent can
     * win immediately (discounted when we can recapture on that square).
     */
    private fun evaluate(game: ChessGame, us: Color): Int {
        if (game.isCheckmate()) return MATE_SCORE          // opponent is to move and mated
        if (game.isStalemate() || game.isInsufficientMaterial()) return 0

        val threat = game.legalMoves()
            .filter { it.captured != Piece.NONE || it.isEnPassant }
            .maxOfOrNull { move ->
                val won = if (move.isEnPassant) 100 else value(move.captured)
                val risked = if (game.isSquareAttacked(move.to, us)) value(move.piece) else 0
                max(0, won - risked)
            } ?: 0

        return material(game, us) - threat
    }

    /**
     * The MultiPV list Stockfish would return for [game]: every legal move,
     * scored from the side-to-move's perspective, ranked best first.
     */
    fun rankedMoves(game: ChessGame): List<RankedMove> {
        val us = game.turn
        val scored = game.legalMoves().map { move ->
            val uci = move.uci()
            game.moveUci(uci) ?: error("generated move $uci was rejected in ${game.fen()}")
            val score = evaluate(game, us)
            game.undo()
            uci to score
        }
        return scored
            .sortedByDescending { it.second }
            .mapIndexed { index, (uci, score) ->
                RankedMove(rank = index + 1, uci = uci, score = score, isMate = false, depth = 6)
            }
    }

    /** One bot: a rating plus the production selector. */
    class Bot(val elo: Int, private val rng: Random) {
        var movesPlayed: Int = 0; private set
        var totalCpLoss: Long = 0L; private set

        val averageCpLoss: Double get() = if (movesPlayed == 0) 0.0 else totalCpLoss.toDouble() / movesPlayed

        /** Chooses and plays a move, recording how much it cost against the top move. */
        fun playMove(game: ChessGame, halfMoveCount: Int): Move? {
            val ranked = rankedMoves(game)
            if (ranked.isEmpty()) return null

            val uci = EloMoveSelector.select(ranked, elo, halfMoveCount, rng) ?: return null
            val chosen = ranked.first { it.uci == uci }
            // Mate scores would swamp the average; cap the per-move loss.
            totalCpLoss += (ranked.first().score - chosen.score).coerceIn(0, 1_000).toLong()
            movesPlayed++
            return game.moveUci(uci)
        }
    }

    enum class Outcome { WHITE_WINS, BLACK_WINS, DRAW }

    data class GameLog(
        val outcome: Outcome,
        val plies: Int,
        val finalFen: String,
        val adjudicated: Boolean,
        val reason: String,
    )

    /**
     * Plays a full game between two bots. If the ply cap is reached the game is
     * adjudicated on material (a two-pawn edge wins), which keeps the test
     * bounded without letting a shuffling draw hide a strength difference.
     */
    fun playGame(white: Bot, black: Bot, maxPlies: Int = 140): GameLog {
        val game = ChessGame()
        var plies = 0

        while (plies < maxPlies) {
            if (game.isGameOver()) break
            val mover = if (game.turn == Color.WHITE) white else black
            mover.playMove(game, plies) ?: break
            plies++
        }

        if (game.isCheckmate()) {
            val winner = if (game.turn == Color.WHITE) Outcome.BLACK_WINS else Outcome.WHITE_WINS
            return GameLog(winner, plies, game.fen(), adjudicated = false, reason = "checkmate")
        }
        if (game.isDraw()) {
            return GameLog(Outcome.DRAW, plies, game.fen(), adjudicated = false, reason = "draw")
        }

        val balance = material(game, Color.WHITE)
        val outcome = when {
            balance >= 200 -> Outcome.WHITE_WINS
            balance <= -200 -> Outcome.BLACK_WINS
            else -> Outcome.DRAW
        }
        return GameLog(outcome, plies, game.fen(), adjudicated = true, reason = "material $balance")
    }

    /**
     * Plays a [games]-game match with alternating colours and returns the score
     * of the [eloA] side in points (win = 1, draw = 0.5).
     */
    fun match(eloA: Int, eloB: Int, games: Int, seed: Int): MatchResult {
        var score = 0.0
        var decisive = 0
        val botA = Bot(eloA, Random(seed))
        val botB = Bot(eloB, Random(seed + 1))

        repeat(games) { index ->
            val aIsWhite = index % 2 == 0
            val log = if (aIsWhite) playGame(botA, botB) else playGame(botB, botA)
            score += when (log.outcome) {
                Outcome.DRAW -> 0.5
                Outcome.WHITE_WINS -> if (aIsWhite) 1.0 else 0.0
                Outcome.BLACK_WINS -> if (aIsWhite) 0.0 else 1.0
            }
            if (log.outcome != Outcome.DRAW) decisive++
        }

        return MatchResult(
            eloA = eloA,
            eloB = eloB,
            games = games,
            scoreA = score,
            decisive = decisive,
            averageCpLossA = botA.averageCpLoss,
            averageCpLossB = botB.averageCpLoss,
        )
    }

    data class MatchResult(
        val eloA: Int,
        val eloB: Int,
        val games: Int,
        val scoreA: Double,
        val decisive: Int,
        val averageCpLossA: Double,
        val averageCpLossB: Double,
    ) {
        val scoreRateA: Double get() = scoreA / games
        override fun toString() =
            "$eloA vs $eloB: ${scoreA}/$games (${"%.1f".format(scoreRateA * 100)}%), " +
                "cpLoss $eloA=${"%.1f".format(averageCpLossA)} $eloB=${"%.1f".format(averageCpLossB)}"
    }
}
