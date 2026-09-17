package com.chess99.presentation.history

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.GameApi
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.common.ReplayPly
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gameApi: GameApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
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
        // Squares of the ply that produced currentFen, for the board highlight
        // and slide. -1/-1 at the starting position.
        val lastMoveFrom: Int = -1,
        val lastMoveTo: Int = -1,
        val lastMoveEffects: MoveEffects = MoveEffects.None,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    // One entry per ply; index 0 is the first move, so the position shown at
    // currentMoveIndex N was produced by plies[N - 1] and 0 is the start.
    private var plies: List<ReplayPly> = emptyList()
    private var autoPlayJob: Job? = null

    private val startFen = ChessGame.STARTING_FEN

    /** FEN of the position reached after [position] plies. */
    private fun fenAt(position: Int): String =
        if (position <= 0) startFen else plies[position - 1].fenAfter

    fun loadGame(gameId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            try {
                val response = gameApi.getGame(gameId)
                if (!response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, error = context.getString(R.string.detail_load_failed)) }
                    return@launch
                }

                val body = response.body() ?: run {
                    _state.update { it.copy(isLoading = false, error = context.getString(R.string.detail_empty_response)) }
                    return@launch
                }

                // Parse game data (may be nested under "data" or at root level)
                val gameData = body.getAsJsonObject("data") ?: body

                val whitePlayer = gameData.getAsJsonObject("white_player")
                val blackPlayer = gameData.getAsJsonObject("black_player")

                // Parse moves. The API sends SAN on some endpoints and
                // coordinates on others; MoveReplay accepts either and reports
                // the squares each ply touched.
                val movesArray = gameData.getAsJsonArray("moves")
                val tokens = movesArray?.mapNotNull { element ->
                    val moveObj = element.asJsonObject
                    moveObj.get("san")?.asString
                        ?: moveObj.get("move")?.asString
                        ?: moveObj.get("notation")?.asString
                } ?: emptyList()

                val replayed = MoveReplay.replay(tokens, startFen)
                plies = replayed
                val totalMoves = replayed.size

                // Build move pairs for display. Indices are replay positions
                // (1 = after the first ply), matching currentMoveIndex.
                val pairs = mutableListOf<MovePair>()
                var i = 1
                while (i <= replayed.size) {
                    val white = replayed[i - 1]
                    val black = replayed.getOrNull(i)
                    pairs.add(
                        MovePair(
                            num = (i + 1) / 2,
                            whiteSan = white.token,
                            whiteIdx = i,
                            blackSan = black?.token,
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
                        whiteName = whitePlayer?.get("name")?.asString ?: context.getString(R.string.player_white),
                        whiteRating = whitePlayer?.get("rating")?.asInt,
                        blackName = blackPlayer?.get("name")?.asString ?: context.getString(R.string.player_black),
                        blackRating = blackPlayer?.get("rating")?.asInt,
                        playerColor = gameData.get("player_color")?.asString ?: "white",
                        date = formattedDate,
                        gameMode = gameData.get("game_mode")?.asString,
                        timeControl = timeControl,
                        openingName = gameData.get("opening_name")?.asString,
                        currentFen = startFen,
                        currentMoveIndex = 0,
                        totalMoves = totalMoves,
                        movePairs = pairs,
                        lastMoveFrom = -1,
                        lastMoveTo = -1,
                        lastMoveEffects = MoveEffects.None,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = friendlyError(context, e, R.string.error_subject_this_game)) }
            }
        }
    }

    fun jumpToMove(index: Int) {
        if (index < 0 || index > plies.size) return
        autoPlayJob?.cancel()
        // Highlight the ply that produced this position, not the one undone by
        // stepping back to it.
        val ply = MoveReplay.plyAtPosition(plies, index)
        _state.update {
            it.copy(
                currentMoveIndex = index,
                currentFen = fenAt(index),
                isAutoPlaying = false,
                lastMoveFrom = ply?.from ?: -1,
                lastMoveTo = ply?.to ?: -1,
                lastMoveEffects = ply?.effects ?: MoveEffects.None,
            )
        }
    }

    fun stepForward() {
        val next = _state.value.currentMoveIndex + 1
        if (next <= plies.size) jumpToMove(next)
    }

    fun stepBackward() {
        val prev = _state.value.currentMoveIndex - 1
        if (prev >= 0) jumpToMove(prev)
    }

    fun goToStart() = jumpToMove(0)

    fun goToEnd() = jumpToMove(plies.size)

    fun toggleAutoPlay() {
        if (_state.value.isAutoPlaying) {
            autoPlayJob?.cancel()
            _state.update { it.copy(isAutoPlaying = false) }
        } else {
            if (_state.value.currentMoveIndex >= plies.size) {
                jumpToMove(0)
            }
            _state.update { it.copy(isAutoPlaying = true) }
            autoPlayJob = viewModelScope.launch {
                while (isActive) {
                    delay(1000)
                    val next = _state.value.currentMoveIndex + 1
                    if (next <= plies.size) {
                        val ply = MoveReplay.plyAtPosition(plies, next)
                        _state.update {
                            it.copy(
                                currentMoveIndex = next,
                                currentFen = fenAt(next),
                                lastMoveFrom = ply?.from ?: -1,
                                lastMoveTo = ply?.to ?: -1,
                                lastMoveEffects = ply?.effects ?: MoveEffects.None,
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
