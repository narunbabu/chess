package com.chess99.presentation.learn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
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
)

data class PuzzleData(
    val id: Int,
    val fen: String,
    val solutionMoves: List<String>,
    val difficulty: String,
    val theme: String,
)

@HiltViewModel
class PuzzleViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PuzzleUiState())
    val uiState: StateFlow<PuzzleUiState> = _uiState.asStateFlow()

    private var currentMoveIndex = 0
    private var puzzleIndex = 0
    private var puzzles = mutableListOf<PuzzleData>()

    init {
        loadPuzzles()
    }

    fun loadPuzzles() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = tutorialApi.getDailyChallenge()
                if (response.isSuccessful) {
                    val body = response.body()
                    val challenge = body?.getAsJsonObject("challenge") ?: body
                    if (challenge != null && challenge.has("fen")) {
                        val puzzle = PuzzleData(
                            id = challenge.get("id")?.asInt ?: 1,
                            fen = challenge.get("fen")?.asString ?: ChessGame.STARTING_FEN,
                            solutionMoves = challenge.getAsJsonArray("solution")
                                ?.map { it.asString } ?: emptyList(),
                            difficulty = challenge.get("difficulty")?.asString ?: "Medium",
                            theme = challenge.get("theme")?.asString ?: "tactics",
                        )
                        puzzles.add(puzzle)
                        showPuzzle(puzzle)
                    }
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
        val game = ChessGame(puzzle.fen)
        _uiState.value = _uiState.value.copy(
            currentPuzzle = puzzle,
            fen = puzzle.fen,
            playerColor = game.turn,
            instruction = "Find the best move",
            difficulty = puzzle.difficulty,
            puzzleNumber = puzzleIndex + 1,
            hint = null,
            isSolved = false,
            isWrongMove = false,
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
            game.move(from, to, promotion)
            currentMoveIndex++

            if (currentMoveIndex >= puzzle.solutionMoves.size) {
                // Puzzle solved
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isSolved = true,
                    isWrongMove = false,
                    solvedCount = _uiState.value.solvedCount + 1,
                    streakCount = _uiState.value.streakCount + 1,
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    isWrongMove = false,
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
}
