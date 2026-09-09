package com.chess99.presentation.game

import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.domain.model.SyntheticPlayer
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.SimulatedOpponent
import com.chess99.engine.StockfishEngine
import com.chess99.engine.StockfishResult
import com.chess99.presentation.social.ShareManager
import com.chess99.presentation.history.LocalGameReviewRecord
import com.chess99.presentation.history.LocalGameReviewStore
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * The Play vs Computer journey, driven exactly as a player drives it on the web
 * app: choose a mode and difficulty (or a bot persona), start, move, use undo,
 * resign, reach a result.
 *
 * The native engine is replaced with [SimulatedOpponent], which returns a real
 * MultiPV list for the position — so the ViewModel plays genuine legal chess
 * here, it just does not need an Android device to do it.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlayComputerViewModelTest {

    private lateinit var engine: StockfishEngine
    private lateinit var matchmakingApi: MatchmakingApi
    private lateinit var gameApi: GameApi
    private lateinit var shareManager: ShareManager
    private lateinit var localGameReviewStore: LocalGameReviewStore
    private lateinit var viewModel: PlayComputerViewModel

    private val persona = SyntheticPlayer(
        id = 7,
        name = "Rookie Rita",
        rating = 900,
        computerLevel = 3,
        personality = "Aggressive",
        bio = "Loves a good attack",
        avatarUrl = "",
        gamesPlayed = 120,
        winRate = 48.0,
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())

        engine = mockk(relaxed = true)
        matchmakingApi = mockk(relaxed = true)
        gameApi = mockk(relaxed = true)
        shareManager = mockk(relaxed = true)
        localGameReviewStore = mockk(relaxed = true)

        // The fake engine answers with a real ranked move list for the position.
        coEvery { engine.getBestMove(any(), any(), any()) } answers {
            val ranked = SimulatedOpponent.rankedMoves(ChessGame(firstArg()))
            StockfishResult(ranked.first().uci, ranked, thinkTimeMs = 12)
        }

        viewModel = PlayComputerViewModel(
            engine,
            matchmakingApi,
            gameApi,
            shareManager,
            localGameReviewStore,
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun errorResponse(code: Int = 500): Response<JsonObject> =
        Response.error(code, "".toResponseBody("application/json".toMediaType()))

    private fun jsonResponse(json: String): Response<JsonObject> =
        Response.success(JsonParser.parseString(json).asJsonObject)

    @Test
    fun `rated local game is blocked before engine starts`() = runTest {
        viewModel.setupGame(mode = GameMode.RATED)
        viewModel.startGame()
        assertEquals(GamePhase.SETUP, viewModel.uiState.value.gamePhase)
        assertNotNull(viewModel.uiState.value.error)
        coVerify(exactly = 0) { engine.initialize() }
    }

    @Test
    fun `persona request preserves each explicitly selected colour`() = runTest {
        val request = slot<JsonObject>()
        coEvery { gameApi.createComputerGame(capture(request)) } returns jsonResponse("{\"id\": 42}")
        for (color in listOf(Color.WHITE, Color.BLACK)) {
            viewModel.setupGame(playerColor = color)
            viewModel.startPersonaGame(persona)
            assertEquals(if (color == Color.WHITE) "white" else "black", request.captured.get("player_color").asString)
        }
    }

    @Test
    fun `failed rated persona cannot fall back to an unrecorded local game`() = runTest {
        coEvery { gameApi.createComputerGame(any()) } returns errorResponse()
        viewModel.setupGame(mode = GameMode.RATED)
        viewModel.startPersonaGame(persona, GameMode.RATED)
        viewModel.consumeStartGameError()
        viewModel.startGame()
        assertEquals(GamePhase.SETUP, viewModel.uiState.value.gamePhase)
        assertNotNull(viewModel.uiState.value.error)
        coVerify(exactly = 0) { engine.initialize() }
    }

    // ── Setup: the three web game modes ──────────────────────────────

    @Test
    fun `casual undo budget matches the web per-difficulty table`() {
        val expected = mapOf(2 to 15, 4 to 15, 5 to 9, 8 to 9, 9 to 6, 12 to 6, 13 to 3, 16 to 3)

        expected.forEach { (difficulty, chances) ->
            viewModel.setupGame(difficulty = difficulty, mode = GameMode.CASUAL)
            val state = viewModel.uiState.value

            assertEquals("difficulty $difficulty", chances, state.undoChancesRemaining)
            assertEquals(chances, state.maxUndoChances)
            assertFalse(state.isRated)
        }
    }

    @Test
    fun `rated mode is rated and grants no undo chances`() {
        viewModel.setupGame(difficulty = 6, mode = GameMode.RATED)
        val state = viewModel.uiState.value

        assertTrue(state.isRated)
        assertFalse(state.learningMode)
        assertEquals(0, state.undoChancesRemaining)
    }

    @Test
    fun `learning mode is unrated and its undo pool equals the helpline limit`() {
        viewModel.setupGame(difficulty = 6, mode = GameMode.LEARNING, learningHelpLimit = 3)
        val state = viewModel.uiState.value

        assertTrue(state.learningMode)
        assertFalse("learning must never be rated", state.isRated)
        assertEquals(3, state.undoChancesRemaining)

        viewModel.setupGame(difficulty = 6, mode = GameMode.LEARNING)
        assertEquals(
            PlayComputerViewModel.DEFAULT_LEARNING_HELP_LIMIT,
            viewModel.uiState.value.undoChancesRemaining,
        )
    }

    @Test
    fun `setup starts in the setup phase with a fresh board and full clocks`() {
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 5)
        val state = viewModel.uiState.value

        assertEquals(GamePhase.SETUP, state.gamePhase)
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertEquals(Color.BLACK, state.playerColor)
        assertEquals(Color.WHITE, state.computerColor)
        assertEquals(PlayComputerViewModel.DEFAULT_TIME_SECONDS, state.playerTimeSeconds)
        assertEquals(PlayComputerViewModel.DEFAULT_TIME_SECONDS, state.computerTimeSeconds)
        assertTrue(state.moveHistory.isEmpty())
    }

    // ── Playing ──────────────────────────────────────────────────────

    @Test
    fun `starting a game as white leaves the first move to the player`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        val state = viewModel.uiState.value
        assertEquals(GamePhase.PLAYING, state.gamePhase)
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertTrue(state.moveHistory.isEmpty())
        coVerify(exactly = 0) { engine.getBestMove(any(), any(), any()) }
    }

    @Test
    fun `starting a game as black makes the computer open`() = runTest {
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 4)
        viewModel.startGame()

        val state = viewModel.uiState.value
        assertEquals(1, state.moveHistory.size)
        assertEquals(Color.WHITE, state.moveHistory.first().playerColor)
        assertFalse(state.computerMoveInProgress)
    }

    @Test
    fun `start is idempotent so the clock and black opening move begin once`() = runTest {
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 4)

        viewModel.startGame()
        viewModel.startGame()

        assertEquals(1, viewModel.uiState.value.moveHistory.size)
        coVerify(exactly = 1) { engine.getBestMove(any(), any(), any()) }
    }

    @Test
    fun `a player move is applied and answered by the computer`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e4", null)

        val state = viewModel.uiState.value
        assertEquals(2, state.moveHistory.size)
        assertEquals("e4", state.moveHistory[0].san)
        assertEquals(Color.WHITE, state.moveHistory[0].playerColor)
        assertEquals(Color.BLACK, state.moveHistory[1].playerColor)
        assertTrue("board must have advanced", state.fen != ChessGame.STARTING_FEN)
        assertEquals(Color.WHITE, state.activeTimer)
    }

    @Test
    fun `new setup ignores a stale computer reply from the previous position`() = runTest {
        val result = kotlinx.coroutines.CompletableDeferred<StockfishResult>()
        coEvery { engine.getBestMove(any(), any(), any()) } coAnswers {
            kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) { result.await() }
        }
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()
        viewModel.onPlayerMove("e2", "e4", null)

        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 8)
        result.complete(
            StockfishResult("e7e5", SimulatedOpponent.rankedMoves(ChessGame()), thinkTimeMs = 12)
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(GamePhase.SETUP, state.gamePhase)
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertTrue(state.moveHistory.isEmpty())
        assertFalse(state.computerMoveInProgress)
    }

    @Test
    fun `an illegal move is ignored and does not consume the turn`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e5", null) // pawns cannot jump three squares

        assertTrue(viewModel.uiState.value.moveHistory.isEmpty())
        assertEquals(ChessGame.STARTING_FEN, viewModel.uiState.value.fen)
    }

    @Test
    fun `moves are rejected before the game starts and after it ends`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)

        viewModel.onPlayerMove("e2", "e4", null)
        assertTrue("no moves may be played from the setup screen",
            viewModel.uiState.value.moveHistory.isEmpty())

        viewModel.startGame()
        viewModel.resign()
        viewModel.onPlayerMove("e2", "e4", null)
        assertTrue("no moves may be played after resigning",
            viewModel.uiState.value.moveHistory.isEmpty())
    }

    @Test
    fun `the player cannot move for the computer`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("e7", "e5", null)

        assertTrue(viewModel.uiState.value.moveHistory.isEmpty())
    }

    // ── Undo ─────────────────────────────────────────────────────────

    @Test
    fun `undo rolls back both plies and spends one chance`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = GameMode.CASUAL)
        viewModel.startGame()
        viewModel.onPlayerMove("e2", "e4", null)
        val budget = viewModel.uiState.value.undoChancesRemaining

        viewModel.undoMove()

        val state = viewModel.uiState.value
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertTrue(state.moveHistory.isEmpty())
        assertEquals(budget - 1, state.undoChancesRemaining)
    }

    @Test
    fun `rated local setup rejects moves and undo`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = GameMode.RATED)
        viewModel.startGame()
        viewModel.onPlayerMove("e2", "e4", null)
        val fenAfterMoves = viewModel.uiState.value.fen

        viewModel.undoMove()

        assertEquals(ChessGame.STARTING_FEN, fenAfterMoves)
        assertEquals("a rejected rated game must not be rewindable", fenAfterMoves, viewModel.uiState.value.fen)
        assertEquals(GamePhase.SETUP, viewModel.uiState.value.gamePhase)
        assertTrue(viewModel.uiState.value.moveHistory.isEmpty())
    }

    @Test
    fun `undo stops once the budget is exhausted`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 6, mode = GameMode.LEARNING, learningHelpLimit = 1)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e4", null)
        viewModel.undoMove()
        assertEquals(0, viewModel.uiState.value.undoChancesRemaining)

        viewModel.onPlayerMove("d2", "d4", null)
        viewModel.undoMove()

        assertEquals("undo must be inert at zero chances",
            2, viewModel.uiState.value.moveHistory.size)
    }

    @Test
    fun `undo is a no-op before any move has been played`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.undoMove()

        assertEquals(
            "an unused undo must not be charged",
            viewModel.uiState.value.maxUndoChances,
            viewModel.uiState.value.undoChancesRemaining,
        )
    }

    // ── Shared Learning help ─────────────────────────────────

    @Test
    fun `best move in learning mode reveals a legal arrow and spends one shared chance`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = GameMode.LEARNING, learningHelpLimit = 3)
        viewModel.startGame()

        viewModel.requestBestMove()

        val state = viewModel.uiState.value
        assertNotNull(state.bestMoveUci)
        assertTrue(state.bestMoveFrom >= 0)
        assertTrue(state.bestMoveTo >= 0)
        assertEquals(2, state.undoChancesRemaining)
        assertFalse(state.bestMoveInProgress)

        viewModel.requestBestMove()
        assertEquals("showing the same hint twice must not double charge", 2, viewModel.uiState.value.undoChancesRemaining)
    }

    @Test
    fun `rated and casual games cannot request a best move`() = runTest {
        for (mode in listOf(GameMode.RATED, GameMode.CASUAL)) {
            viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = mode)
            viewModel.startGame()
            val budget = viewModel.uiState.value.undoChancesRemaining

            viewModel.requestBestMove()

            assertNull(viewModel.uiState.value.bestMoveUci)
            assertEquals(budget, viewModel.uiState.value.undoChancesRemaining)
        }
    }

    @Test
    fun `failed best move does not spend a help chance`() = runTest {
        coEvery { engine.getBestMove(any(), any(), any()) } throws java.io.IOException("engine unavailable")
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = GameMode.LEARNING, learningHelpLimit = 2)
        viewModel.startGame()

        viewModel.requestBestMove()

        val state = viewModel.uiState.value
        assertEquals(2, state.undoChancesRemaining)
        assertNull(state.bestMoveUci)
        assertNotNull(state.error)
    }

    @Test
    fun `new setup cancels stale best move without painting or charging it`() = runTest {
        val result = kotlinx.coroutines.CompletableDeferred<StockfishResult>()
        coEvery { engine.getBestMove(any(), any(), any()) } coAnswers {
            kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) { result.await() }
        }
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4, mode = GameMode.LEARNING, learningHelpLimit = 2)
        viewModel.startGame()
        viewModel.requestBestMove()

        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 7, mode = GameMode.LEARNING, learningHelpLimit = 4)
        result.complete(
            StockfishResult("e2e4", SimulatedOpponent.rankedMoves(ChessGame()), thinkTimeMs = 12)
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(4, state.undoChancesRemaining)
        assertNull(state.bestMoveUci)
        assertEquals(Color.BLACK, state.playerColor)
    }

    // ── Results ──────────────────────────────────────────────────────

    @Test
    fun `resigning ends the game as a loss by resignation`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()
        viewModel.onPlayerMove("e2", "e4", null)

        viewModel.resign()

        val result = viewModel.uiState.value.gameResult
        assertNotNull(result)
        assertEquals(ResultStatus.LOST, result!!.status)
        assertEquals(EndReason.RESIGNATION, result.endReason)
        assertEquals(Winner.OPPONENT, result.winner)
        assertEquals(GamePhase.COMPLETED, viewModel.uiState.value.gamePhase)
        assertFalse(viewModel.uiState.value.isTimerRunning)
        val savedReview = slot<LocalGameReviewRecord>()
        io.mockk.verify(exactly = 1) { localGameReviewStore.save(capture(savedReview)) }
        assertEquals(2, savedReview.captured.moves.size)
        assertEquals(viewModel.uiState.value.fen, savedReview.captured.moves.last().fen)
        assertEquals(EndReason.RESIGNATION, savedReview.captured.result.endReason)
    }

    @Test
    fun `play again preserves setup and starts a fresh board`() = runTest {
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 7, mode = GameMode.LEARNING, learningHelpLimit = 3)
        viewModel.startGame()
        viewModel.resign()

        viewModel.playAgain()

        val state = viewModel.uiState.value
        assertEquals(GamePhase.PLAYING, state.gamePhase)
        assertEquals(Color.BLACK, state.playerColor)
        assertEquals(7, state.difficulty)
        assertEquals(GameMode.LEARNING, state.gameMode)
        assertEquals(3, state.maxUndoChances)
        assertNull(state.gameResult)
    }

    @Test
    fun `resigning before the game starts does nothing`() {
        viewModel.setupGame(difficulty = 4)

        viewModel.resign()

        assertEquals(GamePhase.SETUP, viewModel.uiState.value.gamePhase)
        assertNull(viewModel.uiState.value.gameResult)
    }

    /** Makes the fake engine play a fixed script instead of its own best move. */
    private fun scriptEngine(vararg moves: String) {
        val queue = ArrayDeque(moves.toList())
        coEvery { engine.getBestMove(any(), any(), any()) } answers {
            val ranked = SimulatedOpponent.rankedMoves(ChessGame(firstArg()))
            val next = queue.removeFirstOrNull() ?: ranked.first().uci
            StockfishResult(next, ranked, thinkTimeMs = 12)
        }
    }

    @Test
    fun `checkmating the computer is reported as a win by checkmate`() = runTest {
        // Fool's mate with the player as black: 1.f3 e5 2.g4 Qh4#
        scriptEngine("f2f3", "g2g4")
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("e7", "e5", null)
        viewModel.onPlayerMove("d8", "h4", null)

        val state = viewModel.uiState.value
        assertEquals(GamePhase.COMPLETED, state.gamePhase)
        assertEquals(ResultStatus.WON, state.gameResult!!.status)
        assertEquals(EndReason.CHECKMATE, state.gameResult!!.endReason)
        assertEquals(Winner.PLAYER, state.gameResult!!.winner)
        assertFalse(state.isTimerRunning)
        assertEquals(MoveSound.GAME_END, state.soundToPlay)
    }

    @Test
    fun `being checkmated by the computer is reported as a loss`() = runTest {
        // Fool's mate against the player: the player opens 1.f3 and 2.g4.
        scriptEngine("e7e5", "d8h4")
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("f2", "f3", null)
        viewModel.onPlayerMove("g2", "g4", null)

        val state = viewModel.uiState.value
        assertEquals(GamePhase.COMPLETED, state.gamePhase)
        assertEquals(ResultStatus.LOST, state.gameResult!!.status)
        assertEquals(EndReason.CHECKMATE, state.gameResult!!.endReason)
        assertEquals(Winner.OPPONENT, state.gameResult!!.winner)
    }

    @Test
    fun `a shareable summary from a win names the player as the winner`() = runTest {
        scriptEngine("f2f3", "g2g4")
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 4)
        viewModel.startGame()
        viewModel.onPlayerMove("e7", "e5", null)
        viewModel.onPlayerMove("d8", "h4", null)

        val shareable = viewModel.buildShareableGame()

        assertEquals("black", shareable.result)
        assertEquals("You", shareable.blackPlayer)
    }

    @Test
    fun `a completed game produces a shareable summary from the player's view`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()
        viewModel.onPlayerMove("e2", "e4", null)
        viewModel.resign()

        val shareable = viewModel.buildShareableGame()

        assertEquals("You", shareable.whitePlayer)
        assertEquals("Computer", shareable.blackPlayer)
        assertEquals("resignation as white is a black win", "black", shareable.result)
        assertEquals(2, shareable.totalMoves)
        assertEquals("10|0", shareable.timeControl)
    }

    @Test
    fun `a shareable summary flips names and result when playing black`() = runTest {
        viewModel.setupGame(playerColor = Color.BLACK, difficulty = 4)
        viewModel.startGame()
        viewModel.resign()

        val shareable = viewModel.buildShareableGame()

        assertEquals("Computer", shareable.whitePlayer)
        assertEquals("You", shareable.blackPlayer)
        assertEquals("white", shareable.result)
    }

    // ── Engine failures stay kid-safe ────────────────────────────────

    @Test
    fun `an engine that will not start shows friendly copy and offers puzzles`() = runTest {
        coEvery { engine.initialize() } throws
            com.chess99.engine.EngineInitException(IllegalStateException("dlopen failed: libstockfish.so"))
        viewModel.setupGame(difficulty = 4)

        viewModel.startGame()

        val state = viewModel.uiState.value
        assertTrue(state.engineInitFailed)
        assertEquals(com.chess99.engine.EngineFailureCopy.MESSAGE, state.error)
        assertFalse("the raw linker error must never reach a child",
            state.error!!.contains("libstockfish"))
        assertEquals(GamePhase.SETUP, state.gamePhase)
    }

    @Test
    fun `a mid-game engine failure surfaces a friendly retry message`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()
        coEvery { engine.getBestMove(any(), any(), any()) } throws RuntimeException("SIGSEGV in native frame")

        viewModel.onPlayerMove("e2", "e4", null)

        val state = viewModel.uiState.value
        assertNotNull(state.error)
        assertFalse(state.error!!.contains("SIGSEGV"))
        assertFalse(state.computerMoveInProgress)
    }

    @Test
    fun `clearError resets both the message and the engine failure flag`() = runTest {
        coEvery { engine.initialize() } throws
            com.chess99.engine.EngineInitException(IllegalStateException("boom"))
        viewModel.setupGame(difficulty = 4)
        viewModel.startGame()

        viewModel.clearError()

        assertNull(viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.engineInitFailed)
    }

    // ── Bot personas (the web "nearby opponents" equivalent) ─────────

    @Test
    fun `personas load from the matchmaking endpoint`() = runTest {
        coEvery { matchmakingApi.getSyntheticPlayers() } returns jsonResponse(
            """
            {"data":[
              {"id":1,"name":"Rookie Rita","rating":900,"computer_level":3,
               "personality":"Aggressive","bio":"Loves a good attack","avatar_url":"",
               "games_played":120,"win_rate":48.0},
              {"id":2,"name":"Master Mo","rating":2100,"computer_level":10,
               "personality":"Positional","bio":"Squeezes you slowly","avatar_url":"",
               "games_played":900,"win_rate":71.5}
            ]}
            """.trimIndent(),
        )

        viewModel.loadPersonas()

        val personas = viewModel.personaState.value.personas
        assertEquals(2, personas.size)
        assertEquals("Rookie Rita", personas[0].name)
        assertEquals(900, personas[0].rating)
        assertEquals(10, personas[1].computerLevel)
        assertFalse(viewModel.personaState.value.isLoading)
    }

    @Test
    fun `a persona load failure hides the row instead of showing an error`() = runTest {
        coEvery { matchmakingApi.getSyntheticPlayers() } throws java.io.IOException("offline")

        viewModel.loadPersonas()

        assertTrue(viewModel.personaState.value.personas.isEmpty())
        assertFalse("no spinner may be left behind", viewModel.personaState.value.isLoading)
    }

    @Test
    fun `a persona error response also leaves the row empty and idle`() = runTest {
        coEvery { matchmakingApi.getSyntheticPlayers() } returns errorResponse(503)

        viewModel.loadPersonas()

        assertTrue(viewModel.personaState.value.personas.isEmpty())
        assertFalse(viewModel.personaState.value.isLoading)
    }

    @Test
    fun `selecting a persona applies its level and names the opponent`() {
        viewModel.selectPersona(persona)

        assertEquals(persona, viewModel.personaState.value.selectedPersona)
        assertEquals(persona.computerLevel, viewModel.uiState.value.difficulty)
        assertEquals("Rookie Rita", viewModel.uiState.value.opponentDisplayName)
        assertFalse("persona games are casual", viewModel.uiState.value.isRated)
    }

    @Test
    fun `clearing the persona restores the generic computer opponent`() {
        viewModel.selectPersona(persona)

        viewModel.clearPersonaSelection()

        assertNull(viewModel.personaState.value.selectedPersona)
        assertNull(viewModel.uiState.value.opponentDisplayName)
    }

    @Test
    fun `starting a persona game records it server-side and returns the game id`() = runTest {
        coEvery { gameApi.createComputerGame(any()) } returns jsonResponse("""{"game":{"id":4321}}""")
        viewModel.selectPersona(persona)

        viewModel.startPersonaGame(persona)

        assertEquals(4321, viewModel.personaState.value.startedGameId)
        assertFalse(viewModel.personaState.value.isStartingGame)
        assertEquals("Rookie Rita", viewModel.uiState.value.opponentDisplayName)

        viewModel.consumeStartedGameId()
        assertNull(viewModel.personaState.value.startedGameId)
    }

    @Test
    fun `a rated persona game is sent to the server as rated`() = runTest {
        val bodies = mutableListOf<JsonObject>()
        coEvery { gameApi.createComputerGame(capture(bodies)) } returns jsonResponse("""{"id":99}""")

        viewModel.startPersonaGame(persona, mode = GameMode.RATED)

        assertEquals(99, viewModel.personaState.value.startedGameId)
        val body = bodies.single()
        assertEquals("rated", body.get("game_mode").asString)
        assertEquals(persona.id, body.get("synthetic_player_id").asInt)
        assertEquals(persona.computerLevel, body.get("computer_level").asInt)
        assertEquals(10, body.get("time_control").asInt)
    }

    @Test
    fun `a learning persona game is sent as casual with the learning flag`() = runTest {
        val bodies = mutableListOf<JsonObject>()
        coEvery { gameApi.createComputerGame(capture(bodies)) } returns jsonResponse("""{"id":100}""")

        viewModel.startPersonaGame(persona, mode = GameMode.LEARNING)

        val body = bodies.single()
        assertEquals("casual", body.get("game_mode").asString)
        assertTrue(body.get("learning_mode").asBoolean)
    }

    @Test
    fun `an offline persona start falls back to local play instead of failing`() = runTest {
        coEvery { gameApi.createComputerGame(any()) } throws java.io.IOException("offline")
        viewModel.selectPersona(persona)

        viewModel.startPersonaGame(persona)

        assertNull(viewModel.personaState.value.startedGameId)
        assertEquals("fallback_local", viewModel.personaState.value.startGameError)
        assertEquals("the local game keeps the persona's level",
            persona.computerLevel, viewModel.uiState.value.difficulty)

        viewModel.consumeStartGameError()
        assertNull(viewModel.personaState.value.startGameError)
    }

    @Test
    fun `a server response with no game id also falls back to local play`() = runTest {
        coEvery { gameApi.createComputerGame(any()) } returns jsonResponse("""{"status":"ok"}""")

        viewModel.startPersonaGame(persona)

        assertNull(viewModel.personaState.value.startedGameId)
        assertEquals("fallback_local", viewModel.personaState.value.startGameError)
    }

    @Test
    fun `a persona game plays at the persona's rating, not the difficulty level`() = runTest {
        val elos = mutableListOf<Int?>()
        coEvery { engine.getBestMove(any(), any(), captureNullable(elos)) } answers {
            val ranked = SimulatedOpponent.rankedMoves(ChessGame(firstArg()))
            StockfishResult(ranked.first().uci, ranked, thinkTimeMs = 12)
        }
        viewModel.selectPersona(persona)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e4", null)

        assertEquals(listOf(persona.rating), elos)
    }

    @Test
    fun `a plain difficulty game passes no explicit rating so the level table applies`() = runTest {
        val elos = mutableListOf<Int?>()
        coEvery { engine.getBestMove(any(), any(), captureNullable(elos)) } answers {
            val ranked = SimulatedOpponent.rankedMoves(ChessGame(firstArg()))
            StockfishResult(ranked.first().uci, ranked, thinkTimeMs = 12)
        }
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 8)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e4", null)

        assertEquals(listOf<Int?>(null), elos)
    }

    // ── Sound cues ───────────────────────────────────────────────────

    @Test
    fun `a capture emits the capture cue and it is consumed once played`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.onPlayerMove("e2", "e4", null)
        assertNotNull(viewModel.uiState.value.soundToPlay)

        viewModel.soundPlayed()
        assertNull(viewModel.uiState.value.soundToPlay)
    }

    @Test
    fun `resigning emits the game end cue`() = runTest {
        viewModel.setupGame(playerColor = Color.WHITE, difficulty = 4)
        viewModel.startGame()

        viewModel.resign()

        assertEquals(MoveSound.GAME_END, viewModel.uiState.value.soundToPlay)
    }
}
