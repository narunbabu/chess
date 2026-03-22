package com.chess99.presentation.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.engine.ChessGame
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject

data class MoveParsed(
    val san: String,
    val fen: String,
)

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gameApi: GameApi,
) : ViewModel() {

    data class MovePair(
        val num: Int,
        val whiteSan: String,
        val whiteIdx: Int,
        val blackSan: String?,
        val blackIdx: Int,
    )

    data class State(
        val isLoading: Boolean = true,
        val error: String? = null,
        // Game metadata
        val result: String? = null,
        val endReason: String? = null,
        val whiteName: String = "",
        val whiteRating: Int? = null,
        val blackName: String = "",
        val blackRating: Int? = null,
        val playerColor: String = "white",
        val date: String? = null,
        val gameMode: String? = null,
        val timeControl: String? = null,
        val openingName: String? = null,
        // Replay
        val currentFen: String = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        val currentMoveIndex: Int = 0,
        val totalMoves: Int = 0,
        val isAutoPlaying: Boolean = false,
        val movePairs: List<MovePair> = emptyList(),
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private var parsedMoves: List<MoveParsed> = emptyList() // index 0 = start position
    private var autoPlayJob: Job? = null

    fun loadGame(gameId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            try {
                val response = gameApi.getGame(gameId)
                if (!response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, error = "Failed to load game") }
                    return@launch
                }

                val body = response.body() ?: run {
                    _state.update { it.copy(isLoading = false, error = "Empty response") }
                    return@launch
                }

                // Parse game data (may be nested under "data" or at root level)
                val gameData = body.getAsJsonObject("data") ?: body

                val whitePlayer = gameData.getAsJsonObject("white_player")
                val blackPlayer = gameData.getAsJsonObject("black_player")

                // Parse moves
                val movesArray = gameData.getAsJsonArray("moves")
                val engine = ChessGame()
                val moves = mutableListOf(
                    MoveParsed("Start", engine.fen()),
                )

                if (movesArray != null) {
                    for (element in movesArray) {
                        val moveObj = element.asJsonObject
                        val san = moveObj.get("san")?.asString
                            ?: moveObj.get("move")?.asString
                            ?: moveObj.get("notation")?.asString
                            ?: continue

                        // Try to apply the move
                        val from = san.take(2)
                        val to = san.drop(2).take(2)
                        // For SAN-format moves, we need to use the engine's SAN parser
                        // Since our engine uses coordinate notation, try coordinate first
                        val result = engine.move(from, to, null)
                        if (result != null) {
                            moves.add(MoveParsed(san, engine.fen()))
                        }
                        // If coordinate notation fails, the move format may differ
                        // In a production app, add SAN parsing support
                    }
                }

                parsedMoves = moves
                val totalMoves = moves.size - 1

                // Build move pairs for display
                val pairs = mutableListOf<MovePair>()
                var i = 1
                while (i < moves.size) {
                    val white = moves[i]
                    val black = moves.getOrNull(i + 1)
                    pairs.add(
                        MovePair(
                            num = (i + 1) / 2,
                            whiteSan = white.san,
                            whiteIdx = i,
                            blackSan = black?.san,
                            blackIdx = i + 1,
                        ),
                    )
                    i += 2
                }

                // Format date
                val dateStr = gameData.get("created_at")?.asString
                val formattedDate = try {
                    if (dateStr != null) {
                        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                        val date = parser.parse(dateStr)
                        val formatter = SimpleDateFormat("MMM d, yyyy", Locale.US)
                        if (date != null) formatter.format(date) else dateStr
                    } else null
                } catch (_: Exception) {
                    dateStr
                }

                // Time control
                val tc = gameData.getAsJsonObject("time_control")
                val timeControl = if (tc != null) {
                    val mins = tc.get("minutes")?.asInt
                    val inc = tc.get("increment")?.asInt
                    if (mins != null) {
                        if (inc != null && inc > 0) "${mins}+${inc}" else "${mins} min"
                    } else null
                } else null

                _state.update {
                    it.copy(
                        isLoading = false,
                        result = gameData.get("result")?.asString,
                        endReason = gameData.get("end_reason")?.asString,
                        whiteName = whitePlayer?.get("name")?.asString ?: "White",
                        whiteRating = whitePlayer?.get("rating")?.asInt,
                        blackName = blackPlayer?.get("name")?.asString ?: "Black",
                        blackRating = blackPlayer?.get("rating")?.asInt,
                        playerColor = gameData.get("player_color")?.asString ?: "white",
                        date = formattedDate,
                        gameMode = gameData.get("game_mode")?.asString,
                        timeControl = timeControl,
                        openingName = gameData.get("opening_name")?.asString,
                        currentFen = moves.firstOrNull()?.fen ?: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                        currentMoveIndex = 0,
                        totalMoves = totalMoves,
                        movePairs = pairs,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Unknown error") }
            }
        }
    }

    fun jumpToMove(index: Int) {
        if (index < 0 || index >= parsedMoves.size) return
        autoPlayJob?.cancel()
        _state.update {
            it.copy(
                currentMoveIndex = index,
                currentFen = parsedMoves[index].fen,
                isAutoPlaying = false,
            )
        }
    }

    fun stepForward() {
        val next = _state.value.currentMoveIndex + 1
        if (next < parsedMoves.size) jumpToMove(next)
    }

    fun stepBackward() {
        val prev = _state.value.currentMoveIndex - 1
        if (prev >= 0) jumpToMove(prev)
    }

    fun goToStart() = jumpToMove(0)

    fun goToEnd() = jumpToMove(parsedMoves.size - 1)

    fun toggleAutoPlay() {
        if (_state.value.isAutoPlaying) {
            autoPlayJob?.cancel()
            _state.update { it.copy(isAutoPlaying = false) }
        } else {
            if (_state.value.currentMoveIndex >= parsedMoves.size - 1) {
                jumpToMove(0)
            }
            _state.update { it.copy(isAutoPlaying = true) }
            autoPlayJob = viewModelScope.launch {
                while (isActive) {
                    delay(1000)
                    val current = _state.value.currentMoveIndex
                    val next = current + 1
                    if (next < parsedMoves.size) {
                        _state.update {
                            it.copy(
                                currentMoveIndex = next,
                                currentFen = parsedMoves[next].fen,
                            )
                        }
                    } else {
                        _state.update { it.copy(isAutoPlaying = false) }
                        break
                    }
                }
            }
        }
    }
}
