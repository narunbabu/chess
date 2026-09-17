package com.chess99.presentation.game

import android.content.Context
import android.content.Intent
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
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.Button
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.GameApi
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.MoveEffects
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.common.ReplayPly
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import dagger.hilt.android.qualifiers.ApplicationContext
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
class PublicGameViewerViewModel @Inject constructor(
    private val gameApi: GameApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
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
        // Local "flip board" toggle on top of the served perspective.
        val isFlipped: Boolean = false,
        // Detail rows; each is null when the API did not send it.
        val playedAt: String? = null,
        val openingName: String? = null,
        val endReason: String? = null,
        val timeControl: String? = null,
        // Placeholders only: the ViewModel fills both from strings.xml below,
        // because a data-class default has no Context.
        val whiteName: String = "",
        val blackName: String = "",
        // Squares of the ply that produced currentFen (-1/-1 at the start).
        val lastMoveFrom: Int = -1,
        val lastMoveTo: Int = -1,
        val lastMoveEffects: MoveEffects = MoveEffects.None,
    ) {
        /** The side drawn at the bottom: the served perspective, flipped on request. */
        val bottomColor: String
            get() = if ((playerColor == "black") != isFlipped) "black" else "white"
    }

    private val _state = MutableStateFlow(
        State(
            whiteName = context.getString(R.string.player_white),
            blackName = context.getString(R.string.player_black),
        ),
    )
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
                // The public endpoint (no auth) — deep links can arrive while
                // logged out, and the authenticated getGame would 401 them.
                // It only serves completed/ended games, which is exactly the
                // replay case.
                val response = gameApi.getPublicGame(gameId)
                if (!response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, error = context.getString(R.string.public_game_not_shared)) }
                    return@launch
                }
                val body = response.body()
                val gameData = body?.getAsJsonObject("data") ?: body ?: run {
                    _state.update { it.copy(isLoading = false, error = context.getString(R.string.public_game_empty_response)) }
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
                        result = gameData.stringOrNull("result"),
                        playerColor = normalizeColor(gameData.stringOrNull("player_color")),
                        isFlipped = false,
                        playedAt = gameData.stringOrNull("played_at"),
                        openingName = gameData.stringOrNull("opening_name"),
                        endReason = gameData.stringOrNull("end_reason")?.replace('_', ' '),
                        timeControl = gameData.getAsJsonObjectOrNull("time_control")?.let { tc ->
                            val minutes = tc.stringOrNull("minutes") ?: return@let null
                            "$minutes+${tc.stringOrNull("increment") ?: "0"}"
                        },
                        whiteName = wp?.get("name")?.asString ?: context.getString(R.string.player_white),
                        blackName = bp?.get("name")?.asString ?: context.getString(R.string.player_black),
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = friendlyError(context, e, R.string.error_subject_this_game)) }
            }
        }
    }

    fun flipBoard() = _state.update { it.copy(isFlipped = !it.isFlipped) }

    /** The replay URL the web serves (App.js `/games/:id/replay`). */
    fun shareUrl(gameId: Int): String = "https://chess99.com/games/$gameId/replay"

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

    private fun normalizeColor(raw: String?): String = when (raw?.lowercase()) {
        "black", "b" -> "black"
        else -> "white"
    }

    private fun com.google.gson.JsonObject.stringOrNull(key: String): String? =
        get(key)?.takeUnless { it.isJsonNull }?.asString?.takeIf { it.isNotBlank() }

    private fun com.google.gson.JsonObject.getAsJsonObjectOrNull(key: String): com.google.gson.JsonObject? =
        get(key)?.takeIf { it.isJsonObject }?.asJsonObject

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
    onPlay: () -> Unit = {},
    viewModel: PublicGameViewerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val shareChooserTitle = stringResource(R.string.public_game_share_chooser)
    val shareText = stringResource(
        R.string.public_game_share_text,
        state.whiteName,
        state.blackName,
        viewModel.shareUrl(gameId),
    )

    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.public_game_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    if (!state.isLoading && state.error == null) {
                        IconButton(onClick = viewModel::flipBoard) {
                            Icon(Icons.Default.SwapVert, stringResource(R.string.public_game_flip_board))
                        }
                        IconButton(onClick = {
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, shareText)
                            }
                            runCatching { context.startActivity(Intent.createChooser(send, shareChooserTitle)) }
                        }) {
                            Icon(Icons.Default.Share, stringResource(R.string.action_share))
                        }
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
                        Text(stringResource(R.string.public_game_not_found), fontWeight = FontWeight.Bold, fontSize = 18.sp)
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
                    val orientation = if (state.bottomColor == "black")
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
                            Icon(Icons.Default.SkipPrevious, stringResource(R.string.a11y_start))
                        }
                        IconButton(onClick = { viewModel.stepBackward() }) {
                            Icon(Icons.Default.FastRewind, stringResource(R.string.a11y_previous_move))
                        }
                        IconButton(onClick = { viewModel.toggleAutoPlay() }) {
                            Icon(
                                if (state.isAutoPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                stringResource(
                                    if (state.isAutoPlaying) R.string.action_pause else R.string.action_play,
                                ),
                            )
                        }
                        IconButton(onClick = { viewModel.stepForward() }) {
                            Icon(Icons.Default.FastForward, stringResource(R.string.a11y_next_move))
                        }
                        IconButton(onClick = { viewModel.goToEnd() }) {
                            Icon(Icons.Default.SkipNext, stringResource(R.string.a11y_end))
                        }
                    }

                    Text(
                        stringResource(R.string.public_game_move_counter, state.currentMoveIndex, state.totalMoves),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Spacer(Modifier.height(16.dp))
                    PublicGameDetails(state)

                    Spacer(Modifier.height(16.dp))
                    PublicGamePlayCta(onPlay)
                }
            }
        }
    }
}

@Composable
private fun PublicGameDetails(state: PublicGameViewerViewModel.State) {
    val playedDate = remember(state.playedAt) { formatPlayedDate(state.playedAt) }
    val rows = listOfNotNull(
        playedDate?.let { R.string.public_game_detail_date to it },
        R.string.public_game_detail_moves to state.totalMoves.toString(),
        state.endReason?.let { R.string.public_game_detail_end_reason to it },
        state.openingName?.let { R.string.public_game_detail_opening to it },
        state.timeControl?.let { R.string.public_game_detail_time_control to it },
    )
    Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            rows.forEach { (label, value) ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        stringResource(label),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        value,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.End,
                        modifier = Modifier.padding(start = 12.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun PublicGamePlayCta(onPlay: () -> Unit) {
    Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(stringResource(R.string.public_game_cta_title), fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.public_game_cta_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            Button(onClick = onPlay) { Text(stringResource(R.string.public_game_cta_button)) }
        }
    }
}

/** `played_at` is an ISO-8601 instant; show it as a local medium date. */
internal fun formatPlayedDate(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String? {
    if (iso.isNullOrBlank()) return null
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
    return DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
        .withZone(zone)
        .format(instant)
}
