package com.chess99.engine

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * On-device coverage for the one layer JVM unit tests cannot reach: the bundled
 * Stockfish binary and the JNI bridge that talks to it.
 *
 * The JVM suite proves that a MultiPV list becomes play of the requested
 * strength ([EloMoveSelectorTest], [EloLadderSimulationTest]). This suite proves
 * the other half on real hardware — that the native engine actually starts for
 * this device's ABI, completes its UCI handshake, and returns legal, ELO-shaped
 * moves. Run it on the emulator before release and again on the physical phone:
 *
 *   ./gradlew :app:connectedDebugAndroidTest
 */
@RunWith(AndroidJUnit4::class)
class StockfishEngineInstrumentedTest {

    private lateinit var engine: StockfishEngine

    /** Generous: a cold engine start on a slow device still has to unpack and exec. */
    private val initTimeoutMs = 30_000L
    private val moveTimeoutMs = 20_000L

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        engine = StockfishEngine(context)
    }

    @After
    fun tearDown() {
        runCatching { engine.shutdown() }
    }

    private fun initEngine() = runBlocking {
        withTimeout(initTimeoutMs) {
            engine.initialize()
            engine.newGame()
        }
    }

    @Test
    fun engineStartsOnThisDevice() {
        initEngine()

        assertEquals(StockfishEngine.EngineState.IDLE, engine.state.value)
    }

    @Test
    fun returnsALegalMoveFromTheStartingPosition() = runBlocking {
        initEngine()

        val result = withTimeout(moveTimeoutMs) {
            engine.getBestMove(ChessGame.STARTING_FEN, depth = 4)
        }

        assertTrue("engine returned no move", result.bestMove.length >= 4)
        val game = ChessGame()
        assertNotNull(
            "engine returned an illegal move: ${result.bestMove}",
            game.moveUci(result.bestMove),
        )
        assertTrue("MultiPV list came back empty", result.rankedMoves.isNotEmpty())
    }

    @Test
    fun honoursTheMinimumPerceivedThinkTime() = runBlocking {
        initEngine()

        val result = withTimeout(moveTimeoutMs) {
            engine.getBestMove(ChessGame.STARTING_FEN, depth = 1)
        }

        // Even the fastest level must not snap back instantly — the web app
        // enforces the same floor so the bot feels like it is thinking.
        assertTrue(
            "level 1 replied in ${result.thinkTimeMs}ms, below the perceived floor",
            result.thinkTimeMs >= StockfishEngine.MIN_PERCEIVED_THINK_TIME_MS - 150,
        )
    }

    @Test
    fun playsLegalMovesAcrossEveryDifficultyTier() = runBlocking {
        initEngine()

        listOf(1, 4, 8, 12, 16).forEach { difficulty ->
            val game = ChessGame()
            val result = withTimeout(moveTimeoutMs) {
                engine.getBestMove(game.fen(), difficulty)
            }

            assertNotNull(
                "difficulty $difficulty returned illegal move ${result.bestMove}",
                game.moveUci(result.bestMove),
            )
        }
    }

    @Test
    fun playsAtAnExplicitSyntheticPlayerRating() = runBlocking {
        initEngine()

        listOf(600, 1200, 1800, 2400).forEach { elo ->
            val game = ChessGame()
            val result = withTimeout(moveTimeoutMs) {
                engine.getBestMove(game.fen(), depth = 6, opponentElo = elo)
            }

            assertNotNull(
                "rating $elo returned illegal move ${result.bestMove}",
                game.moveUci(result.bestMove),
            )
        }
    }

    @Test
    fun findsMateInOneEvenAtTheLowestRating() = runBlocking {
        initEngine()

        // Back-rank mate: Ra1-a8 is the only mating move.
        val fen = "6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1"
        val result = withTimeout(moveTimeoutMs) {
            engine.getBestMove(fen, depth = 6, opponentElo = 400)
        }

        val game = ChessGame(fen)
        game.moveUci(result.bestMove)
        assertTrue(
            "a 400-rated bot missed mate in one, played ${result.bestMove}",
            game.isCheckmate(),
        )
    }

    @Test
    fun playsAFullGameAgainstItselfWithoutDesyncing() = runBlocking {
        initEngine()
        val game = ChessGame()
        var plies = 0

        while (plies < 30 && !game.isGameOver()) {
            val result = withTimeout(moveTimeoutMs) {
                engine.getBestMove(game.fen(), depth = 2, opponentElo = 1200)
            }
            assertNotNull(
                "ply $plies: engine returned illegal move ${result.bestMove} in ${game.fen()}",
                game.moveUci(result.bestMove),
            )
            plies++
        }

        assertTrue("engine stalled after $plies plies", plies >= 20)
    }

    @Test
    fun analysePositionReturnsAnEvaluationForGameReview() = runBlocking {
        initEngine()

        val analysis = withTimeout(moveTimeoutMs) {
            engine.analyzePosition(ChessGame.STARTING_FEN, depth = 10)
        }

        assertTrue("no search depth reached", analysis.depth > 0)
        assertTrue("no best move for review", analysis.bestMove.length >= 4)
        assertFalse("the start position is not a forced mate", analysis.isMate)
        assertTrue(
            "the start position should be near equal, got ${analysis.evalCp}cp",
            kotlin.math.abs(analysis.evalCp) < 200,
        )
    }

    @Test
    fun aSecondNewGameResetsCleanly() = runBlocking {
        initEngine()
        withTimeout(moveTimeoutMs) { engine.getBestMove(ChessGame.STARTING_FEN, depth = 2) }

        withTimeout(initTimeoutMs) { engine.newGame() }
        val result = withTimeout(moveTimeoutMs) {
            engine.getBestMove(ChessGame.STARTING_FEN, depth = 2)
        }

        assertNotNull(ChessGame().moveUci(result.bestMove))
    }
}
