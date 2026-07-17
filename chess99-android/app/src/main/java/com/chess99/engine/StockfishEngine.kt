package com.chess99.engine

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

/**
 * Stockfish engine wrapper using JNI bridge.
 * Sends UCI commands, parses responses, provides coroutine-based API.
 *
 * Architecture:
 * - Stockfish 11 binary compiled for NDK targets (arm64-v8a, armeabi-v7a, x86_64),
 *   packaged as jniLibs/<abi>/libstockfish.so (see StockfishBridge.kt)
 * - JNI bridge in StockfishBridge.kt handles native communication
 * - This class wraps the bridge with game-level logic (difficulty, MultiPV, think time)
 *
 * Difficulty mapping matches web frontend (computerMoveUtils.js):
 * - Depth 1-16 → movetime 100-2500ms
 * - Lower depths use MultiPV to select from top N moves with weighted randomness
 * - Minimum perceived think time: 1500ms
 */
@Singleton
class StockfishEngine @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    companion object {
        const val MIN_DEPTH = 1
        const val MAX_DEPTH = 16
        const val DEFAULT_DEPTH = 2
        const val NUM_TOP_MOVES = 25   // match web (computerMoveUtils.js NUM_TOP_MOVES_TO_REQUEST)
        const val MIN_PERCEIVED_THINK_TIME_MS = 1500L

        /** Map depth (1-16) to Stockfish movetime in milliseconds. Matches web frontend. */
        fun mapDepthToMoveTime(depth: Int): Int = when (depth.coerceIn(MIN_DEPTH, MAX_DEPTH)) {
            1 -> 100; 2 -> 150; 3 -> 200; 4 -> 250
            5 -> 300; 6 -> 400; 7 -> 500; 8 -> 600
            9 -> 700; 10 -> 800; 11 -> 1000; 12 -> 1200
            13 -> 1500; 14 -> 1800; 15 -> 2200; 16 -> 2500
            else -> 150
        }

        /** Difficulty tier for undo chances. */
        fun difficultyTier(depth: Int): DifficultyTier = when {
            depth <= 4 -> DifficultyTier.EASY
            depth <= 8 -> DifficultyTier.MEDIUM
            depth <= 12 -> DifficultyTier.HARD
            else -> DifficultyTier.EXPERT
        }

        /** Number of undo chances per difficulty tier. */
        fun undoChances(depth: Int, isRated: Boolean): Int {
            if (isRated) return 0
            return when (difficultyTier(depth)) {
                DifficultyTier.EASY -> 5
                DifficultyTier.MEDIUM -> 3
                DifficultyTier.HARD -> 2
                DifficultyTier.EXPERT -> 1
            }
        }
    }

    enum class DifficultyTier { EASY, MEDIUM, HARD, EXPERT }

    enum class EngineState { IDLE, INITIALIZING, THINKING, ERROR }

    private val _state = MutableStateFlow(EngineState.IDLE)
    val state: StateFlow<EngineState> = _state

    private var isInitialized = false
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    // ── Engine Lifecycle ─────────────────────────────────────────────

    /**
     * Initialize the Stockfish engine. Must be called before getBestMove.
     * Sends: uci, setoption name MultiPV value 10, isready
     */
    suspend fun initialize() {
        if (isInitialized) return
        _state.value = EngineState.INITIALIZING

        try {
            StockfishBridge.init(context)
            StockfishBridge.sendCommand("uci")
            StockfishBridge.waitForResponse("uciok")
            StockfishBridge.sendCommand("setoption name MultiPV value $NUM_TOP_MOVES")
            StockfishBridge.sendCommand("ucinewgame")
            StockfishBridge.sendCommand("isready")
            StockfishBridge.waitForResponse("readyok")
            isInitialized = true
            _state.value = EngineState.IDLE
        } catch (e: Exception) {
            _state.value = EngineState.ERROR
            // Wrapped so UI call sites can show a friendly, non-technical message
            // (never e.message — see EngineFailureCopy) instead of the raw
            // exception, whatever its source (missing .so for this ABI, process
            // start failure, UCI handshake timeout, ...).
            throw EngineInitException(cause = e)
        }
    }

    /**
     * Shutdown the engine and release resources.
     */
    fun shutdown() {
        if (isInitialized) {
            StockfishBridge.sendCommand("quit")
            StockfishBridge.destroy()
            isInitialized = false
        }
        _state.value = EngineState.IDLE
        scope.cancel()
    }

    // ── Move Generation ──────────────────────────────────────────────

    /**
     * Get the best move for a given position and difficulty.
     * Includes artificial delay to ensure minimum perceived think time (1500ms).
     *
     * @param fen Current board position in FEN notation
     * @param depth Difficulty level 1-16
     * @return StockfishResult with selected move and analysis data
     */
    suspend fun getBestMove(fen: String, depth: Int): StockfishResult =
        getBestMove(fen, depth, opponentElo = null)

    /**
     * Get the best move for a position, difficulty, and (optional) explicit ELO.
     *
     * When [opponentElo] is provided (synthetic bots — SyntheticPlayer.rating),
     * the move is chosen to match that ELO's strength curve (cp-loss budget +
     * softmax + blunder injection, matching web). When null, the ELO is inferred
     * from [depth] via COMPUTER_LEVEL_RATINGS so difficulty play is also
     * human-like. [depth] still controls Stockfish search movetime.
     *
     * @param depth Difficulty level 1-16 (search time)
     * @param opponentElo Explicit ELO to play at, or null to derive from depth
     */
    suspend fun getBestMove(
        fen: String,
        depth: Int,
        opponentElo: Int?,
    ): StockfishResult = withContext(Dispatchers.Default) {
        check(isInitialized) { "Engine not initialized. Call initialize() first." }
        _state.value = EngineState.THINKING

        val startTime = System.currentTimeMillis()
        val moveTime = mapDepthToMoveTime(depth)

        try {
            // Send position and start analysis
            StockfishBridge.sendCommand("position fen $fen")
            StockfishBridge.sendCommand("go movetime $moveTime")

            // Collect MultiPV results
            val rankedMoves = mutableListOf<RankedMove>()
            var bestMove = ""

            while (true) {
                val line = StockfishBridge.readLine() ?: continue

                if (line.startsWith("bestmove")) {
                    bestMove = line.split(" ").getOrElse(1) { "" }
                    break
                }

                if (line.startsWith("info") && "pv" in line) {
                    parseInfoLine(line)?.let { rankedMoves.add(it) }
                }
            }

            // Keep only the last (deepest) info per multipv rank — web overwrites
            // by rank so the final, most accurate eval per line wins.
            val dedupedRanked = rankedMoves
                .groupBy { it.rank }
                .mapNotNull { (_, group) -> group.maxByOrNull { it.depth } }
                .sortedBy { it.rank }

            // ELO-faithful selection (replaces the old rank-bucket lottery). Derive
            // the running half-move count from the FEN's fullmove number so the
            // opening blunder-ramp works (a FEN-loaded game has empty history()).
            val targetElo = EloMoveSelector.resolveTargetElo(depth, opponentElo)
            val game = ChessGame(fen)
            val halfMoveCount = (game.fullMoveNumber - 1) * 2 + if (game.turn == Color.BLACK) 1 else 0
            val selectedMove = EloMoveSelector.select(dedupedRanked, targetElo, halfMoveCount)
                ?: bestMove.ifEmpty { dedupedRanked.firstOrNull()?.uci ?: "" }

            // Enforce minimum perceived think time
            val elapsed = System.currentTimeMillis() - startTime
            val delay = max(0, MIN_PERCEIVED_THINK_TIME_MS - elapsed)
            if (delay > 0) delay(delay)

            _state.value = EngineState.IDLE
            StockfishResult(
                bestMove = selectedMove,
                rankedMoves = dedupedRanked,
                thinkTimeMs = System.currentTimeMillis() - startTime
            )
        } catch (e: CancellationException) {
            StockfishBridge.sendCommand("stop")
            _state.value = EngineState.IDLE
            throw e
        } catch (e: Exception) {
            _state.value = EngineState.ERROR
            throw e
        }
    }

    /**
     * Analyze a single position at a given depth. Returns evaluation and top moves.
     * No artificial delay — used for post-game analysis, not gameplay.
     *
     * @param fen Position to analyze
     * @param depth Search depth (default 18, matches backend)
     * @return PositionAnalysis with eval score and ranked moves
     */
    suspend fun analyzePosition(fen: String, depth: Int = 18): PositionAnalysis = withContext(Dispatchers.Default) {
        check(isInitialized) { "Engine not initialized. Call initialize() first." }
        _state.value = EngineState.THINKING

        try {
            StockfishBridge.sendCommand("position fen $fen")
            StockfishBridge.sendCommand("go depth $depth")

            val rankedMoves = mutableListOf<RankedMove>()
            var bestMove = ""
            var evalScore = 0
            var evalIsMate = false
            var evalDepth = 0

            while (true) {
                val line = StockfishBridge.readLine() ?: continue

                if (line.startsWith("bestmove")) {
                    bestMove = line.split(" ").getOrElse(1) { "" }
                    break
                }

                if (line.startsWith("info") && "pv" in line) {
                    parseInfoLine(line)?.let { rankedMoves.add(it) }
                    // Track the primary (multipv 1) eval
                    if ("multipv 1" in line || ("multipv" !in line && " pv " in line)) {
                        parseEvalFromInfoLine(line)?.let { (score, isMate, d) ->
                            evalScore = score
                            evalIsMate = isMate
                            evalDepth = d
                        }
                    }
                }
            }

            _state.value = EngineState.IDLE
            PositionAnalysis(
                evalCp = evalScore,
                isMate = evalIsMate,
                depth = evalDepth,
                bestMove = bestMove,
                rankedMoves = rankedMoves,
            )
        } catch (e: CancellationException) {
            StockfishBridge.sendCommand("stop")
            _state.value = EngineState.IDLE
            throw e
        } catch (e: Exception) {
            _state.value = EngineState.ERROR
            throw e
        }
    }

    /**
     * Parse evaluation score from an info line.
     * Returns (score, isMate, depth) or null.
     */
    private fun parseEvalFromInfoLine(line: String): Triple<Int, Boolean, Int>? {
        val parts = line.split(" ")
        var score = 0
        var isMate = false
        var depth = 0
        var foundScore = false

        var i = 0
        while (i < parts.size) {
            when (parts[i]) {
                "depth" -> depth = parts.getOrNull(i + 1)?.toIntOrNull() ?: 0
                "score" -> {
                    val scoreType = parts.getOrNull(i + 1)
                    val scoreVal = parts.getOrNull(i + 2)?.toIntOrNull() ?: 0
                    when (scoreType) {
                        "cp" -> { score = scoreVal; foundScore = true }
                        "mate" -> { score = scoreVal; isMate = true; foundScore = true }
                    }
                }
            }
            i++
        }
        return if (foundScore) Triple(score, isMate, depth) else null
    }

    /**
     * Reset engine state for a new game.
     */
    suspend fun newGame() {
        if (!isInitialized) return
        StockfishBridge.sendCommand("ucinewgame")
        StockfishBridge.sendCommand("isready")
        StockfishBridge.waitForResponse("readyok")
    }

    // ── Move Selection Logic ─────────────────────────────────────────
    // Moved to EloMoveSelector (ELO-faithful cp-budget model). The old
    // rank-bucket selector (ignored ELO) was removed.

    // ── UCI Response Parsing ─────────────────────────────────────────

    /**
     * Parse a UCI info line to extract MultiPV rank and principal variation.
     * Example: "info depth 12 multipv 1 score cp 35 pv e2e4 e7e5 ..."
     */
    private fun parseInfoLine(line: String): RankedMove? {
        val parts = line.split(" ")
        var multipv = 0
        var score = 0
        var isMate = false
        var pvMove = ""
        var depth = 0

        var i = 0
        while (i < parts.size) {
            when (parts[i]) {
                "multipv" -> multipv = parts.getOrNull(i + 1)?.toIntOrNull() ?: 0
                "depth" -> depth = parts.getOrNull(i + 1)?.toIntOrNull() ?: 0
                "score" -> {
                    val scoreType = parts.getOrNull(i + 1)
                    val scoreVal = parts.getOrNull(i + 2)?.toIntOrNull() ?: 0
                    when (scoreType) {
                        "cp" -> score = scoreVal
                        "mate" -> { score = scoreVal; isMate = true }
                    }
                }
                "pv" -> pvMove = parts.getOrNull(i + 1) ?: ""
            }
            i++
        }

        if (multipv == 0 || pvMove.isEmpty()) return null
        return RankedMove(rank = multipv, uci = pvMove, score = score, isMate = isMate, depth = depth)
    }
}

// ── Result Types ────────────────────────────────────────────────────

data class StockfishResult(
    val bestMove: String, // UCI format, e.g., "e2e4"
    val rankedMoves: List<RankedMove>,
    val thinkTimeMs: Long,
)

data class RankedMove(
    val rank: Int,      // 1 = best
    val uci: String,    // UCI move string
    val score: Int,     // centipawn score (or mate distance)
    val isMate: Boolean,
    val depth: Int,
)

data class PositionAnalysis(
    val evalCp: Int,            // centipawn eval from white's perspective
    val isMate: Boolean,        // true if eval is a mate score
    val depth: Int,             // search depth reached
    val bestMove: String,       // UCI format best move
    val rankedMoves: List<RankedMove>,  // MultiPV top moves
)

/**
 * Thrown by [StockfishEngine.initialize] when the native engine process fails
 * to start or complete its UCI handshake, for any reason (binary missing for
 * this ABI, exec() blocked, process crash, handshake timeout, ...).
 *
 * Callers should catch this specifically to show [EngineFailureCopy.MESSAGE]
 * instead of the raw [cause] — never surface `cause.message`, a class name, or
 * a stack trace to the user (this is a kids app).
 */
class EngineInitException(cause: Throwable) : Exception(cause)

/** Shared, honest, kid-safe copy for engine-init failures. See EngineInitException. */
object EngineFailureCopy {
    const val MESSAGE = "The chess engine couldn't start on this device."
    const val ACTION_LABEL = "Try a puzzle instead"
}
