package com.chess99.engine

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
 * - Stockfish binary compiled for NDK targets (arm64-v8a, armeabi-v7a, x86_64)
 * - JNI bridge in StockfishBridge.kt handles native communication
 * - This class wraps the bridge with game-level logic (difficulty, MultiPV, think time)
 *
 * Difficulty mapping matches web frontend (computerMoveUtils.js):
 * - Depth 1-16 → movetime 100-2500ms
 * - Lower depths use MultiPV to select from top N moves with weighted randomness
 * - Minimum perceived think time: 1500ms
 */
@Singleton
class StockfishEngine @Inject constructor() {

    companion object {
        const val MIN_DEPTH = 1
        const val MAX_DEPTH = 16
        const val DEFAULT_DEPTH = 2
        const val NUM_TOP_MOVES = 10
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
            StockfishBridge.init()
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
            throw e
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
    suspend fun getBestMove(fen: String, depth: Int): StockfishResult = withContext(Dispatchers.Default) {
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

            // Select move based on difficulty
            val selectedMove = selectMoveFromRankedList(rankedMoves, depth, bestMove)

            // Enforce minimum perceived think time
            val elapsed = System.currentTimeMillis() - startTime
            val delay = max(0, MIN_PERCEIVED_THINK_TIME_MS - elapsed)
            if (delay > 0) delay(delay)

            _state.value = EngineState.IDLE
            StockfishResult(
                bestMove = selectedMove,
                rankedMoves = rankedMoves,
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
     * Reset engine state for a new game.
     */
    suspend fun newGame() {
        if (!isInitialized) return
        StockfishBridge.sendCommand("ucinewgame")
        StockfishBridge.sendCommand("isready")
        StockfishBridge.waitForResponse("readyok")
    }

    // ── Move Selection Logic ─────────────────────────────────────────

    /**
     * Select a move from ranked list based on difficulty.
     * Matches web frontend selectMoveFromRankedList logic:
     * - Easy (1-4): Pick from ranks 5-8 (mediocre moves)
     * - Medium (5-8): Pick from ranks 2-4 (decent moves)
     * - Hard (9-12): Pick from ranks 1-2 (strong moves)
     * - Expert (13-16): Always pick rank 1 (best move)
     */
    private fun selectMoveFromRankedList(
        rankedMoves: List<RankedMove>,
        depth: Int,
        fallbackBestMove: String
    ): String {
        if (rankedMoves.isEmpty()) return fallbackBestMove

        // Sort by rank (1 = best)
        val sorted = rankedMoves.sortedBy { it.rank }
        val tier = difficultyTier(depth)

        val selectedRange: IntRange = when (tier) {
            DifficultyTier.EASY -> {
                val start = (4).coerceAtMost(sorted.size - 1)
                val end = (7).coerceAtMost(sorted.size - 1)
                start..end
            }
            DifficultyTier.MEDIUM -> {
                val start = (1).coerceAtMost(sorted.size - 1)
                val end = (3).coerceAtMost(sorted.size - 1)
                start..end
            }
            DifficultyTier.HARD -> {
                val end = (1).coerceAtMost(sorted.size - 1)
                0..end
            }
            DifficultyTier.EXPERT -> 0..0
        }

        // If range is empty or out of bounds, fall back
        if (selectedRange.isEmpty()) return sorted.first().uci

        val candidates = sorted.slice(selectedRange)
        return if (candidates.isNotEmpty()) {
            candidates.random().uci
        } else {
            sorted.first().uci
        }
    }

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
