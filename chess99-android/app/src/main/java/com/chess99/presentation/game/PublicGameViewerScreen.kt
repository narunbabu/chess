package com.chess99.presentation.game

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.common.ReplayPly
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PublicGameViewerViewModel @Inject constructor(
    private val gameApi: GameApi,
) : ViewModel() {

    data class State(
        val isLoading: Boolean = true,
        val error: String? = null,
        val currentFen: String = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        val currentMoveIndex: Int = 0,
        val totalMoves: Int = 0,
        val isAutoPlaying: Boolean = false,
        val result: String? = null,
        val playerColor: String = "white",
        val whiteName: String = "White",
        val blackName: String = "Black",
        // Squares of the ply that produced currentFen (-1/-1 at the start).
        val lastMoveFrom: Int = -1,
        val lastMoveTo: Int = -1,
        val lastMoveEffects: MoveEffects = MoveEffects.None,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    // One entry per ply. Position N on screen was produced by plies[N - 1].
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
                    _state.update { it.copy(isLoading = false, error = "Game not found or not publicly shared.") }
                    return@launch
                }
                val body = response.body()
                val gameData = body?.getAsJsonObject("data") ?: body ?: run {
                    _state.update { it.copy(isLoading = false, error = "Empty response") }
                    return@launch
                }

                // Parse moves — SAN or coordinates, whichever the API sent.
                val movesArray = gameData.getAsJsonArray("moves")
                val tokens = movesArray?.mapNotNull { element ->
                    val moveObj = element.asJsonObject
                    moveObj.get("san")?.asString ?: moveObj.get("move")?.asString
                } ?: emptyList()
                plies = MoveReplay.replay(tokens, startFen)

                val wp = gameData.getAsJsonObject("white_player")
                val bp = gameData.getAsJsonObject("black_player")

                _state.update {
                    it.copy(
                        isLoading = false,
                        currentFen = startFen,
                        currentMoveIndex = 0,
                        totalMoves = plies.size,
                        lastMoveFrom = -1,
                        lastMoveTo = -1,
                        lastMoveEffects = MoveEffects.None,
                        result = gameData.get("result")?.asString,
                        playerColor = gameData.get("player_color")?.asString ?: "white",
                        whiteName = wp?.get("name")?.asString ?: "White",
                        blackName = bp?.get("name")?.asString ?: "Black",
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = friendlyError(e, "this game")) }
            }
        }
    }

    fun jumpToMove(index: Int) {
        if (index < 0 || index > plies.size) return
        autoPlayJob?.cancel()
        // The highlight belongs to the ply that produced this position, so
        // stepping back lands on the previous move rather than the undone one.
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
            if (_state.value.currentMoveIndex >= plies.size) jumpToMove(0)
            _state.update { it.copy(isAutoPlaying = true) }
            autoPlayJob = viewModelScope.launch {
                while (isActive) {
                    // Comfortably longer than the board's move animation, so
                    // each ply has settled before the next one starts.
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicGameViewerScreen(
    gameId: Int,
    onNavigateBack: () -> Unit,
    viewModel: PublicGameViewerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Game Replay") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Game Not Found", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            state.error ?: "",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Players
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(state.whiteName, fontWeight = FontWeight.Medium)
                        Text("vs", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(state.blackName, fontWeight = FontWeight.Medium)
                    }

                    if (state.result != null) {
                        Text(
                            state.result ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // Board — rebuilt per position so the board and the
                    // last-move highlight always describe the same ply.
                    val replayGame = remember(state.currentFen) { ChessGame(state.currentFen) }
                    val orientation = if (state.playerColor == "black")
                        com.chess99.engine.Color.BLACK else com.chess99.engine.Color.WHITE
                    ChessBoardView(
                        game = replayGame,
                        boardOrientation = orientation,
                        isInteractive = false,
                        lastMoveFrom = state.lastMoveFrom,
                        lastMoveTo = state.lastMoveTo,
                        lastMoveEffects = state.lastMoveEffects,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Spacer(Modifier.height(12.dp))

                    // Controls
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        IconButton(onClick = { viewModel.goToStart() }) {
                            Icon(Icons.Default.SkipPrevious, "Start")
                        }
                        IconButton(onClick = { viewModel.stepBackward() }) {
                            Icon(Icons.Default.FastRewind, "Previous")
                        }
                        IconButton(onClick = { viewModel.toggleAutoPlay() }) {
                            Icon(
                                if (state.isAutoPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                if (state.isAutoPlaying) "Pause" else "Play",
                            )
                        }
                        IconButton(onClick = { viewModel.stepForward() }) {
                            Icon(Icons.Default.FastForward, "Next")
                        }
                        IconButton(onClick = { viewModel.goToEnd() }) {
                            Icon(Icons.Default.SkipNext, "End")
                        }
                    }

                    Text(
                        "Move ${state.currentMoveIndex} / ${state.totalMoves}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
