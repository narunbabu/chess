package com.chess99.presentation.learn

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.Move
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.learn.tactical.TacticalPuzzle
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class PuzzleUiState(
    val isLoading: Boolean = false,
    val currentPuzzle: PuzzleData? = null,
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    val instruction: String = "Find the best move",
    val difficulty: String = "Medium",
    val puzzleNumber: Int = 1,
    val hint: String? = null,
    val isSolved: Boolean = false,
    val isWrongMove: Boolean = false,
    val solvedCount: Int = 0,
    val streakCount: Int = 0,
    val isOfflinePuzzle: Boolean = false,
    // Squares of the ply that produced [fen] — the opponent's reply when there
    // is one, otherwise the player's own move.
    val lastMoveFrom: Int = -1,
    val lastMoveTo: Int = -1,
    val lastMoveEffects: MoveEffects = MoveEffects.None,
)

data class PuzzleData(
    val id: String,
    val fen: String,
    val solutionMoves: List<String>,
    val difficulty: String,
    val theme: String,
    val playerColor: Color,
    val isOffline: Boolean,
)

@HiltViewModel
class PuzzleViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PuzzleUiState())
    val uiState: StateFlow<PuzzleUiState> = _uiState.asStateFlow()

    private var currentMoveIndex = 0
    private var puzzleIndex = 0
    private var puzzles = mutableListOf<PuzzleData>()
    private var initialized = false
    private val gson = Gson()

    init {
        loadPuzzles()
    }

    fun loadPuzzles() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                if (!initialized) {
                    initialized = true
                    val onlinePuzzle = try {
                        val response = tutorialApi.getDailyChallenge()
                        if (response.isSuccessful) {
                            val body = response.body()
                            val challenge = body?.getAsJsonObject("challenge") ?: body
                            if (challenge != null && challenge.has("fen")) {
                                val game = ChessGame(
                                    challenge.get("fen")?.asString ?: ChessGame.STARTING_FEN
                                )
                                PuzzleData(
                                    id = challenge.get("id")?.asString ?: "daily",
                                    fen = challenge.get("fen")?.asString ?: ChessGame.STARTING_FEN,
                                    solutionMoves = challenge.getAsJsonArray("solution")
                                        ?.map { it.asString } ?: emptyList(),
                                    difficulty = challenge.get("difficulty")?.asString ?: "Medium",
                                    theme = challenge.get("theme")?.asString ?: "tactics",
                                    playerColor = game.turn,
                                    isOffline = false,
                                )
                            } else null
                        } else null
                    } catch (e: Exception) {
                        Timber.d(e, "Daily challenge unavailable; using bundled puzzles")
                        null
                    }
                    puzzles = (listOfNotNull(onlinePuzzle) + loadBundledPuzzles()).toMutableList()
                }
                if (puzzles.isNotEmpty()) {
                    puzzleIndex %= puzzles.size
                    showPuzzle(puzzles[puzzleIndex])
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load puzzles")
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    private fun showPuzzle(puzzle: PuzzleData) {
        currentMoveIndex = 0
        _uiState.value = _uiState.value.copy(
            currentPuzzle = puzzle,
            fen = puzzle.fen,
            playerColor = puzzle.playerColor,
            instruction = "Find the best move",
            difficulty = puzzle.difficulty,
            puzzleNumber = puzzleIndex + 1,
            hint = null,
            isSolved = false,
            isWrongMove = false,
            isOfflinePuzzle = puzzle.isOffline,
            lastMoveFrom = -1,
            lastMoveTo = -1,
            lastMoveEffects = MoveEffects.None,
        )
    }

    fun attemptMove(from: String, to: String, promotion: Char?) {
        val puzzle = _uiState.value.currentPuzzle ?: return
        if (_uiState.value.isSolved) return

        val moveStr = "$from$to${promotion ?: ""}"
        val expectedMove = puzzle.solutionMoves.getOrNull(currentMoveIndex)

        if (expectedMove != null && (moveStr == expectedMove || "$from$to" == expectedMove.take(4))) {
            // Correct move
            val game = ChessGame(_uiState.value.fen)
            // The board highlights whichever ply left the position on screen,
            // so keep hold of the last one actually played.
            var lastPlayed: Move? = game.move(from, to, promotion)
            currentMoveIndex++

            if (currentMoveIndex < puzzle.solutionMoves.size) {
                puzzle.solutionMoves.getOrNull(currentMoveIndex)?.let { opponentMove ->
                    game.moveUci(opponentMove)?.let { lastPlayed = it }
                    currentMoveIndex++
                }
            }

            val played = lastPlayed
            if (currentMoveIndex >= puzzle.solutionMoves.size) {
                // Puzzle solved
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isSolved = true,
                    isWrongMove = false,
                    solvedCount = _uiState.value.solvedCount + 1,
                    streakCount = _uiState.value.streakCount + 1,
                    lastMoveFrom = played?.from ?: -1,
                    lastMoveTo = played?.to ?: -1,
                    lastMoveEffects = played?.let { MoveReplay.effectsOf(it) } ?: MoveEffects.None,
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isWrongMove = false,
                    lastMoveFrom = played?.from ?: -1,
                    lastMoveTo = played?.to ?: -1,
                    lastMoveEffects = played?.let { MoveReplay.effectsOf(it) } ?: MoveEffects.None,
                )
            }
        } else {
            // Wrong move
            _uiState.value = _uiState.value.copy(
                isWrongMove = true,
                streakCount = 0,
            )
        }
    }

    fun requestHint() {
        val puzzle = _uiState.value.currentPuzzle ?: return
        val nextMove = puzzle.solutionMoves.getOrNull(currentMoveIndex) ?: return
        val hint = "Try moving from ${nextMove.take(2)}"
        _uiState.value = _uiState.value.copy(hint = hint)
    }

    fun nextPuzzle() {
        puzzleIndex++
        loadPuzzles()
    }

    private fun loadBundledPuzzles(): List<PuzzleData> {
        val filenames = listOf(
            "beginner_puzzles.json",
            "stage1_puzzles.json",
            "stage2_puzzles.json",
            "stage3_puzzles.json",
            "stage4_puzzles.json",
        )
        val type = object : TypeToken<List<TacticalPuzzle>>() {}.type
        return filenames.flatMap { filename ->
            appContext.assets.open("tactical/$filename").bufferedReader().use { reader ->
                val tactical: List<TacticalPuzzle> = gson.fromJson(reader, type)
                tactical.mapNotNull(::normalizeBundledPuzzle)
            }
        }
    }

    /**
     * Bundled Lichess puzzles store the opponent's setup ply first. Apply that
     * move so the player receives the actual puzzle position.
     */
    private fun normalizeBundledPuzzle(puzzle: TacticalPuzzle): PuzzleData? {
        if (puzzle.moves.size < 2) return null
        return try {
            val game = ChessGame(puzzle.fen)
            if (game.moveUci(puzzle.moves.first()) == null) return null
            val normalizedMoves = puzzle.moves.drop(1)
            if (normalizedMoves.isEmpty()) return null
            PuzzleData(
                id = puzzle.id,
                fen = game.fen(),
                solutionMoves = normalizedMoves,
                difficulty = puzzle.difficulty.replaceFirstChar { it.uppercase() },
                theme = puzzle.themes.firstOrNull() ?: "tactics",
                playerColor = game.turn,
                isOffline = true,
            )
        } catch (e: Exception) {
            Timber.d(e, "Skipping malformed bundled puzzle ${puzzle.id}")
            null
        }
    }
}
