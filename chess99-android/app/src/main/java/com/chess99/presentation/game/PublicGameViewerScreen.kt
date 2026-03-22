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
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private var fens: List<String> = listOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    private var autoPlayJob: Job? = null

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

                // Parse moves
                val engine = ChessGame()
                val fenList = mutableListOf(engine.fen())
                val movesArray = gameData.getAsJsonArray("moves")
                if (movesArray != null) {
                    for (element in movesArray) {
                        val moveObj = element.asJsonObject
                        val san = moveObj.get("san")?.asString
                            ?: moveObj.get("move")?.asString
                            ?: continue
                        val from = san.take(2)
                        val to = san.drop(2).take(2)
                        val result = engine.move(from, to, null)
                        if (result != null) fenList.add(engine.fen())
                    }
                }
                fens = fenList

                val wp = gameData.getAsJsonObject("white_player")
                val bp = gameData.getAsJsonObject("black_player")

                _state.update {
                    it.copy(
                        isLoading = false,
                        currentFen = fenList.first(),
                        totalMoves = fenList.size - 1,
                        result = gameData.get("result")?.asString,
                        playerColor = gameData.get("player_color")?.asString ?: "white",
                        whiteName = wp?.get("name")?.asString ?: "White",
                        blackName = bp?.get("name")?.asString ?: "Black",
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun jumpToMove(index: Int) {
        if (index < 0 || index >= fens.size) return
        autoPlayJob?.cancel()
        _state.update { it.copy(currentMoveIndex = index, currentFen = fens[index], isAutoPlaying = false) }
    }

    fun stepForward() {
        val next = _state.value.currentMoveIndex + 1
        if (next < fens.size) jumpToMove(next)
    }

    fun stepBackward() {
        val prev = _state.value.currentMoveIndex - 1
        if (prev >= 0) jumpToMove(prev)
    }

    fun goToStart() = jumpToMove(0)
    fun goToEnd() = jumpToMove(fens.size - 1)

    fun toggleAutoPlay() {
        if (_state.value.isAutoPlaying) {
            autoPlayJob?.cancel()
            _state.update { it.copy(isAutoPlaying = false) }
        } else {
            if (_state.value.currentMoveIndex >= fens.size - 1) jumpToMove(0)
            _state.update { it.copy(isAutoPlaying = true) }
            autoPlayJob = viewModelScope.launch {
                while (isActive) {
                    delay(1000)
                    val current = _state.value.currentMoveIndex + 1
                    if (current < fens.size) {
                        _state.update { it.copy(currentMoveIndex = current, currentFen = fens[current]) }
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

                    // Board
                    val replayGame = remember { ChessGame() }
                    LaunchedEffect(state.currentFen) {
                        replayGame.load(state.currentFen)
                    }
                    val orientation = if (state.playerColor == "black")
                        com.chess99.engine.Color.BLACK else com.chess99.engine.Color.WHITE
                    ChessBoardView(
                        game = replayGame,
                        boardOrientation = orientation,
                        isInteractive = false,
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
