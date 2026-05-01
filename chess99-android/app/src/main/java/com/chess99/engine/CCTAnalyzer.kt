package com.chess99.engine

/**
 * CCT (Checks, Captures, Threats) positional scanner for live learning.
 * Pure chess logic — zero latency, no engine needed.
 * Mirrors chess-frontend/src/utils/cctAnalysis.js
 */

object PieceValues {
    val VALUES = mapOf(
        Piece.PAWN to 1.0, Piece.KNIGHT to 3.0, Piece.BISHOP to 3.25,
        Piece.ROOK to 5.0, Piece.QUEEN to 9.0, Piece.KING to 0.0,
    )
    fun value(pieceType: Int): Double = VALUES[pieceType] ?: 0.0

    val NAMES = mapOf(
        Piece.PAWN to "Pawn", Piece.KNIGHT to "Knight", Piece.BISHOP to "Bishop",
        Piece.ROOK to "Rook", Piece.QUEEN to "Queen", Piece.KING to "King",
    )
    fun name(pieceType: Int): String = NAMES[pieceType] ?: "?"
}

data class CCTCheck(
    val from: Int,
    val to: Int,
    val san: String,
    val isCheckmate: Boolean,
)

data class CCTCapture(
    val from: Int,
    val to: Int,
    val san: String,
    val victimType: Int,
    val attackerType: Int,
    val victimName: String,
    val victimValue: Double,
    val attackerValue: Double,
)

data class CCTThreat(
    val from: Int,
    val to: Int,
    val san: String,
    val threatens: Int,
    val threatenedPieceType: Int,
    val victimName: String,
    val victimValue: Double,
    val attackerValue: Double,
)

data class CCTResult(
    val checks: List<CCTCheck>,
    val captures: List<CCTCapture>,
    val threats: List<CCTThreat>,
)

data class CCTArrow(
    val from: Int,
    val to: Int,
    val color: Long, // ARGB color
)

enum class CCTWarningSeverity { CRITICAL, DANGER, WARNING, CAUTION, SAFE }

data class CCTWarning(
    val severity: CCTWarningSeverity,
    val message: String,
)

object CCTAnalyzer {

    // Arrow colors matching web frontend
    private const val CHECK_COLOR = 0xD9EF4444L   // rgba(239,68,68,0.85)
    private const val CAPTURE_COLOR = 0xD9F97316L  // rgba(249,115,22,0.85)
    private const val THREAT_COLOR = 0xD9EAB308L   // rgba(234,179,8,0.85)

    // Best move colors: gold, silver, bronze
    val BEST_COLORS = longArrayOf(0xE6FFD700L, 0xE6C0C0C0L, 0xE6CD7F32L)

    /**
     * Analyze Checks, Captures, and Threats for a given position.
     * @param game   ChessGame instance at the position to analyze
     * @param perspective  "mine" = current side to move, "opponent" = flip turn
     */
    fun analyze(game: ChessGame, perspective: String = "mine"): CCTResult {
        val fen = game.fen()
        val analysisFen = if (perspective == "opponent") flipActiveTurn(fen) else fen

        val tempGame = try {
            ChessGame(analysisFen)
        } catch (_: Exception) {
            return CCTResult(emptyList(), emptyList(), emptyList())
        }

        val allMoves = try {
            tempGame.legalMoves()
        } catch (_: Exception) {
            return CCTResult(emptyList(), emptyList(), emptyList())
        }

        val checks = computeChecks(tempGame, analysisFen, allMoves)
        val captures = computeCaptures(allMoves)
        val threats = computeThreats(tempGame, analysisFen, allMoves)

        return CCTResult(checks, captures, threats)
    }

    private fun flipActiveTurn(fen: String): String {
        val parts = fen.split(" ")
        val mutable = parts.toMutableList()
        mutable[1] = if (mutable[1] == "w") "b" else "w"
        mutable[3] = "-" // clear en passant
        return mutable.joinToString(" ")
    }

    // ── CHECKS ─────────────────────────────────────────────────────────

    private fun computeChecks(game: ChessGame, fen: String, moves: List<Move>): List<CCTCheck> {
        val checks = mutableListOf<CCTCheck>()
        for (m in moves) {
            try {
                val g = ChessGame(fen)
                val result = g.move(m.fromAlgebraic, m.toAlgebraic,
                    if (m.promotion != 0) Piece.toChar(Piece.make(m.promotion, Color.WHITE)) else null)
                if (result != null && g.isCheck()) {
                    checks.add(CCTCheck(
                        from = m.from,
                        to = m.to,
                        san = m.san(game),
                        isCheckmate = g.isCheckmate(),
                    ))
                }
            } catch (_: Exception) { /* skip */ }
        }
        return checks
    }

    // ── CAPTURES (MVV-LVA sorted) ──────────────────────────────────────

    private fun computeCaptures(moves: List<Move>): List<CCTCapture> {
        return moves
            .filter { it.captured != Piece.NONE || it.isEnPassant }
            .map { m ->
                val victimType = if (m.isEnPassant) Piece.PAWN else Piece.type(m.captured)
                val attackerType = Piece.type(m.piece)
                CCTCapture(
                    from = m.from,
                    to = m.to,
                    san = "",
                    victimType = victimType,
                    attackerType = attackerType,
                    victimName = PieceValues.name(victimType),
                    victimValue = PieceValues.value(victimType),
                    attackerValue = PieceValues.value(attackerType),
                )
            }
            .sortedWith(compareByDescending<CCTCapture> { it.victimValue }
                .thenBy { it.attackerValue })
    }

    // ── THREATS ────────────────────────────────────────────────────────
    // A non-capturing move is a "threat" when the piece that just moved can NOW
    // capture an equal-or-higher-value opponent piece.

    private fun computeThreats(game: ChessGame, fen: String, moves: List<Move>): List<CCTThreat> {
        val activeTurn = fen.split(" ")[1]
        val activeColor = if (activeTurn == "w") Color.WHITE else Color.BLACK
        val threats = mutableListOf<CCTThreat>()

        for (m in moves) {
            if (m.captured != Piece.NONE || m.isEnPassant) continue
            if (Piece.type(m.piece) == Piece.KING) continue

            try {
                val afterGame = ChessGame(fen)
                val result = afterGame.move(
                    m.fromAlgebraic, m.toAlgebraic,
                    if (m.promotion != 0) Piece.toChar(Piece.make(m.promotion, Color.WHITE)) else null
                ) ?: continue

                // Flip back to enumerate what our piece at m.to attacks
                val flipFen = flipActiveTurn(afterGame.fen())
                val flipParts = flipFen.split(" ").toMutableList()
                flipParts[1] = activeTurn
                val attackGame = ChessGame(flipParts.joinToString(" "))

                val attackMoves = attackGame.legalMoves().filter {
                    it.from == m.to && (it.captured != Piece.NONE || it.isEnPassant)
                }

                val attackerValue = PieceValues.value(Piece.type(m.piece))
                val bestVictim = attackMoves
                    .map { am ->
                        val vType = if (am.isEnPassant) Piece.PAWN else Piece.type(am.captured)
                        Pair(am, PieceValues.value(vType))
                    }
                    .filter { it.second >= attackerValue }
                    .maxByOrNull { it.second }

                if (bestVictim != null) {
                    val victimType = if (bestVictim.first.isEnPassant) Piece.PAWN
                    else Piece.type(bestVictim.first.captured)
                    threats.add(CCTThreat(
                        from = m.from,
                        to = m.to,
                        san = "", // filled lazily
                        threatens = bestVictim.first.to,
                        threatenedPieceType = victimType,
                        victimName = PieceValues.name(victimType),
                        victimValue = bestVictim.second,
                        attackerValue = attackerValue,
                    ))
                }
            } catch (_: Exception) { /* skip */ }
        }

        return threats.sortedByDescending { it.victimValue }
    }

    // ── ARROW CONVERSION ───────────────────────────────────────────────

    fun cctToArrows(cct: CCTResult): List<CCTArrow> {
        val arrows = mutableListOf<CCTArrow>()

        cct.checks.take(3).forEach { m ->
            arrows.add(CCTArrow(m.from, m.to, CHECK_COLOR))
        }
        cct.captures.take(4).forEach { m ->
            arrows.add(CCTArrow(m.from, m.to, CAPTURE_COLOR))
        }
        cct.threats.take(3).forEach { m ->
            if (m.to != -1 && m.threatens != -1) {
                arrows.add(CCTArrow(m.to, m.threatens, THREAT_COLOR))
            }
        }
        return arrows
    }

    // ── MOVE CLASSIFICATION ────────────────────────────────────────────

    fun classifyMoveAgainstCCT(uciMove: String, cct: CCTResult): String {
        if (uciMove.length < 4) return "Positional"
        val from = Square.fromAlgebraic(uciMove.substring(0, 2))
        val to = Square.fromAlgebraic(uciMove.substring(2, 4))

        val isCheck = cct.checks.any { it.from == from && it.to == to }
        val isCapture = cct.captures.any { it.from == from && it.to == to }
        val isThreat = cct.threats.any { it.from == from && it.to == to }

        return when {
            isCheck && isCapture -> "Check+Capture"
            isCheck -> "Check"
            isCapture -> "Capture"
            isThreat -> "Threat"
            else -> "Positional"
        }
    }

    // ── WARNING SYSTEM ─────────────────────────────────────────────────

    private val CHECK_MESSAGES = listOf(
        "Check alert! Your opponent can deliver check — secure your king first.",
        "King in danger! Opponent has a checking move — don't ignore it.",
        "Opponent can give check. Resolve king vulnerability before anything else.",
        "Check threat detected! Move your king or block the check immediately.",
    )

    private val CAPTURE_MESSAGES = listOf(
        "Material at risk! Opponent can capture one of your pieces this turn.",
        "A piece is hanging! Defend it or move it before your opponent strikes.",
        "Watch out — opponent has a winning capture. Protect your pieces.",
        "Piece under attack! Defend it or trade favorably right now.",
    )

    private val THREAT_MESSAGES = listOf(
        "Subtle threat — opponent's next move could attack your pieces.",
        "Danger ahead: opponent may be setting up a fork, pin, or skewer.",
        "Look one move ahead! Opponent threatens to win material next turn.",
        "Positional threat detected — anticipate your opponent's plan.",
    )

    private val MULTIPLE_CHECK_CAPTURE_MESSAGES = listOf(
        "High danger! Opponent can check AND capture — king safety is priority one.",
        "Critical position: check threats and material threats both exist. Defend your king first.",
    )

    private val MULTIPLE_ALL_MESSAGES = listOf(
        "Maximum pressure! Checks, captures, and threats are all on the table.",
        "Serious danger — your opponent has multiple attacking options. Calculate carefully.",
    )

    private val SAFE_MESSAGES = listOf(
        "No immediate threats — position looks balanced. Stick to your plan.",
        "You're safe this turn. Good time to improve your pieces or castle.",
        "Quiet position — use this move to strengthen your setup.",
        "Opponent has no forcing moves. Stay alert and keep developing.",
    )

    fun getWarning(opponentCct: CCTResult, fen: String): CCTWarning {
        val hasChecks = opponentCct.checks.isNotEmpty()
        val hasCaptures = opponentCct.captures.isNotEmpty()
        val hasThreats = opponentCct.threats.isNotEmpty()

        return when {
            hasChecks && (hasCaptures || hasThreats) ->
                CCTWarning(CCTWarningSeverity.CRITICAL, pickMessage(MULTIPLE_CHECK_CAPTURE_MESSAGES, fen))
            hasChecks ->
                CCTWarning(CCTWarningSeverity.DANGER, pickMessage(CHECK_MESSAGES, fen))
            hasCaptures ->
                CCTWarning(CCTWarningSeverity.WARNING, pickMessage(CAPTURE_MESSAGES, fen))
            hasThreats ->
                CCTWarning(CCTWarningSeverity.CAUTION, pickMessage(THREAT_MESSAGES, fen))
            else ->
                CCTWarning(CCTWarningSeverity.SAFE, pickMessage(SAFE_MESSAGES, fen))
        }
    }

    private fun pickMessage(messages: List<String>, fen: String): String {
        val hash = fen.fold(0u) { acc, c -> (acc * 31u + c.code.toUInt()) }
        return messages[(hash % messages.size.toUInt()).toInt()]
    }
}
