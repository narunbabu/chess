package com.chess99.presentation.game

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import com.chess99.domain.model.SyntheticPlayer
import com.chess99.engine.*
import com.chess99.presentation.common.*

/**
 * PlayComputer screen with full game loop.
 * Two phases: Setup (color/difficulty selection) and Playing (board + controls).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayComputerScreen(
    onNavigateBack: () -> Unit,
    onNavigateToTacticalTrainer: () -> Unit = {},
    onNavigateToMultiplayerGame: (Int) -> Unit = {},
    viewModel: PlayComputerViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val personaState by viewModel.personaState.collectAsState()
    var showLeaveDialog by remember { mutableStateOf(false) }

    // Victory-image share (G3.1): capture the current screen and share it.
    val shareView = LocalView.current
    val shareContext = LocalContext.current
    val shareScope = rememberCoroutineScope()

    // T3: a persona-backed game start (T5) that successfully created a
    // server-recorded game hands off to the multiplayer stack — the local
    // Stockfish setup below is never entered for that game.
    LaunchedEffect(personaState.startedGameId) {
        personaState.startedGameId?.let { gameId ->
            viewModel.consumeStartedGameId()
            onNavigateToMultiplayerGame(gameId)
        }
    }

    // T3 fallback path: the real-game POST failed (offline/server error) —
    // silently continue with the already-configured local Stockfish game
    // (persona's level was applied via selectPersona/setupGame already).
    LaunchedEffect(personaState.startGameError) {
        if (personaState.startGameError == "fallback_local") {
            viewModel.consumeStartGameError()
            viewModel.startGame()
        }
    }

    // Sound effects
    val soundManager = remember { SoundManager::class.java }
    LaunchedEffect(state.soundToPlay) {
        state.soundToPlay?.let {
            // In production: soundManager.playXxx() based on sound type
            viewModel.soundPlayed()
        }
    }

    // Hardware/gesture back gets the same leave-game confirmation as the
    // toolbar back arrow below — neither existed before S11 T3, so the
    // toolbar arrow popped (and gesture back exited) unconditionally,
    // silently forfeiting an active game.
    BackHandler(enabled = state.gamePhase == GamePhase.PLAYING) {
        showLeaveDialog = true
    }

    if (showLeaveDialog) {
        GameNavigationWarningDialog(
            gameType = ActiveGameType.VS_COMPUTER,
            onLeave = {
                showLeaveDialog = false
                onNavigateBack()
            },
            onStay = { showLeaveDialog = false },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.opponentDisplayName?.let { "Playing $it" } ?: "Play vs Computer"
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (state.gamePhase == GamePhase.PLAYING) {
                            showLeaveDialog = true
                        } else {
                            onNavigateBack()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        when (state.gamePhase) {
            GamePhase.SETUP -> GameSetupContent(
                modifier = Modifier.padding(padding),
                personaState = personaState,
                onLoadPersonas = { viewModel.loadPersonas() },
                onSelectPersona = { viewModel.selectPersona(it) },
                onClearPersona = { viewModel.clearPersonaSelection() },
                onStartGame = { color, difficulty, rated, persona ->
                    viewModel.setupGame(color, difficulty, rated)
                    if (persona != null && !rated) {
                        // T3: try the real, server-recorded game first; the
                        // LaunchedEffect above navigates away on success. On
                        // failure PersonaUiState.startGameError flips to
                        // "fallback_local" and we start the local engine below
                        // with the persona's level already applied — the
                        // player is never blocked by a network hiccup.
                        viewModel.startPersonaGame(persona)
                    } else {
                        viewModel.startGame()
                    }
                },
            )
            GamePhase.PLAYING, GamePhase.COMPLETED -> GamePlayContent(
                state = state,
                modifier = Modifier.padding(padding),
                onMove = { from, to, promo -> viewModel.onPlayerMove(from, to, promo) },
                onUndo = { viewModel.undoMove() },
                onResign = { viewModel.resign() },
                onNewGame = {
                    viewModel.setupGame()
                },
                onShare = {
                    val shareable = viewModel.buildShareableGame()
                    shareScope.launch {
                        viewModel.shareManager.captureAndShare(shareView, shareContext, shareable)
                    }
                },
            )
            GamePhase.REPLAY -> { /* Future: replay mode */ }
        }

        // Error dialog — engine-init failures get honest copy + a redirect to
        // Tactical Trainer instead of a dead-end "OK" (S2 T4: never show e.message).
        state.error?.let { error ->
            if (state.engineInitFailed) {
                AlertDialog(
                    onDismissRequest = { viewModel.clearError() },
                    title = { Text("Can't play the computer right now") },
                    text = { Text(error) },
                    confirmButton = {
                        TextButton(onClick = {
                            viewModel.clearError()
                            onNavigateToTacticalTrainer()
                        }) { Text(EngineFailureCopy.ACTION_LABEL) }
                    },
                    dismissButton = {
                        TextButton(onClick = { viewModel.clearError() }) { Text("Cancel") }
                    },
                )
            } else {
                AlertDialog(
                    onDismissRequest = { viewModel.clearError() },
                    title = { Text("Error") },
                    text = { Text(error) },
                    confirmButton = {
                        TextButton(onClick = { viewModel.clearError() }) { Text("OK") }
                    },
                )
            }
        }
    }
}

// ── Setup Screen ─────────────────────────────────────────────────────

@Composable
private fun GameSetupContent(
    modifier: Modifier = Modifier,
    personaState: PersonaUiState,
    onLoadPersonas: () -> Unit,
    onSelectPersona: (SyntheticPlayer) -> Unit,
    onClearPersona: () -> Unit,
    onStartGame: (Color, Int, Boolean, SyntheticPlayer?) -> Unit,
) {
    var selectedColor by remember { mutableStateOf(Color.WHITE) }
    var difficulty by remember { mutableIntStateOf(StockfishEngine.DEFAULT_DEPTH) }
    var isRated by remember { mutableStateOf(false) }

    // T5: cached for the VM's lifetime \u2014 only fetched once per screen visit.
    LaunchedEffect(Unit) { onLoadPersonas() }

    // Rated overrides any persona pick (spec T3: persona games are casual only).
    LaunchedEffect(isRated) {
        if (isRated && personaState.selectedPersona != null) onClearPersona()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Game Setup", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(32.dp))

        // Color selection
        Text("Play as", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            FilterChip(
                selected = selectedColor == Color.WHITE,
                onClick = { selectedColor = Color.WHITE },
                label = { Text("\u2654 White") },
            )
            FilterChip(
                selected = selectedColor == Color.BLACK,
                onClick = { selectedColor = Color.BLACK },
                label = { Text("\u265A Black") },
            )
        }

        // T5: bot persona chip row \u2014 offline/error leaves personas empty and
        // the row simply doesn't render; the slider below still works.
        if (!isRated && personaState.personas.isNotEmpty()) {
            Spacer(modifier = Modifier.height(24.dp))
            Text("Play a bot", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            PersonaChipRow(
                personas = personaState.personas,
                selectedPersona = personaState.selectedPersona,
                onSelect = { persona ->
                    if (personaState.selectedPersona?.id == persona.id) {
                        onClearPersona()
                        difficulty = StockfishEngine.DEFAULT_DEPTH
                    } else {
                        onSelectPersona(persona)
                        difficulty = persona.computerLevel
                    }
                },
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Difficulty slider \u2014 a persona pick sets it directly; moving the
        // slider manually deselects the persona ("Custom" per spec T5).
        Text("Difficulty: $difficulty", style = MaterialTheme.typography.titleMedium)
        Text(
            text = if (personaState.selectedPersona != null) "Custom" else difficultyLabel(difficulty),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Slider(
            value = difficulty.toFloat(),
            onValueChange = {
                difficulty = it.toInt()
                if (personaState.selectedPersona != null) onClearPersona()
            },
            valueRange = 1f..16f,
            steps = 14,
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Rated toggle
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Rated Game", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.weight(1f))
            Switch(checked = isRated, onCheckedChange = { isRated = it })
        }
        if (isRated) {
            Text(
                text = "No undo, no pause, affects your rating",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        } else {
            val undos = StockfishEngine.undoChances(difficulty, false)
            Text(
                text = "$undos undo chances available",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                onStartGame(selectedColor, difficulty, isRated, personaState.selectedPersona)
            },
            enabled = !personaState.isStartingGame,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
        ) {
            if (personaState.isStartingGame) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Text("Start Game", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

// \u2500\u2500 Bot Persona Chip Row (T5) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

@Composable
private fun PersonaChipRow(
    personas: List<SyntheticPlayer>,
    selectedPersona: SyntheticPlayer?,
    onSelect: (SyntheticPlayer) -> Unit,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items(personas, key = { it.id }) { persona ->
            PersonaChip(
                persona = persona,
                selected = selectedPersona?.id == persona.id,
                onClick = { onSelect(persona) },
            )
        }
    }
}

@Composable
private fun PersonaChip(
    persona: SyntheticPlayer,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = if (selected) 2.dp else 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(
                        if (selected) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.secondaryContainer
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    persona.name.take(1).uppercase(),
                    color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSecondaryContainer,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    persona.name,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Rating: ${persona.rating}",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Game Play Screen ─────────────────────────────────────────────────

@Composable
private fun GamePlayContent(
    state: PlayComputerUiState,
    modifier: Modifier = Modifier,
    onMove: (String, String, Char?) -> Unit,
    onUndo: () -> Unit,
    onResign: () -> Unit,
    onNewGame: () -> Unit,
    onShare: () -> Unit,
) {
    val game = remember(state.fen) { ChessGame(state.fen) }
    val isPlayerTurn = game.turn == state.playerColor && !state.computerMoveInProgress

    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Opponent timer (top)
        GameTimerDisplay(
            timeSeconds = state.computerTimeSeconds,
            isActive = state.activeTimer == state.computerColor && state.isTimerRunning,
            playerName = state.opponentDisplayName ?: "Computer (Lv.${state.difficulty})",
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        )

        // Chess board
        ChessBoardView(
            game = game,
            boardOrientation = state.playerColor,
            isInteractive = isPlayerTurn && state.gamePhase == GamePhase.PLAYING,
            lastMoveFrom = state.lastMoveFrom,
            lastMoveTo = state.lastMoveTo,
            onMove = onMove,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
        )

        // Player timer (bottom)
        GameTimerDisplay(
            timeSeconds = state.playerTimeSeconds,
            isActive = state.activeTimer == state.playerColor && state.isTimerRunning,
            playerName = "You",
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Status message
        if (state.computerMoveInProgress) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Computer thinking...", style = MaterialTheme.typography.bodySmall)
            }
        }

        // Game controls
        if (state.gamePhase == GamePhase.PLAYING) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                // Undo button
                if (!state.isRated && state.undoChancesRemaining > 0) {
                    OutlinedButton(
                        onClick = onUndo,
                        enabled = isPlayerTurn && state.moveHistory.size >= 2,
                    ) {
                        Icon(Icons.Default.Undo, contentDescription = "Undo")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Undo (${state.undoChancesRemaining})")
                    }
                }

                // Resign button
                OutlinedButton(
                    onClick = onResign,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Icon(Icons.Default.Flag, contentDescription = "Resign")
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Resign")
                }
            }
        }

        // Game result
        state.gameResult?.let { result ->
            GameResultCard(result = result, onNewGame = onNewGame, onShare = onShare)
        }

        // Move list
        if (state.moveHistory.isNotEmpty()) {
            MoveListDisplay(
                moves = state.moveHistory,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
            )
        }
    }
}

// ── Game Result Card ─────────────────────────────────────────────────

@Composable
private fun GameResultCard(
    result: GameResultState,
    onNewGame: () -> Unit,
    onShare: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (result.status) {
                ResultStatus.WON -> MaterialTheme.colorScheme.primaryContainer
                ResultStatus.LOST -> MaterialTheme.colorScheme.errorContainer
                ResultStatus.DRAW -> MaterialTheme.colorScheme.secondaryContainer
            }
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = when (result.status) {
                    ResultStatus.WON -> "Victory!"
                    ResultStatus.LOST -> "Defeat"
                    ResultStatus.DRAW -> "Draw"
                },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = result.details,
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Button(onClick = onNewGame) {
                    Text("New Game")
                }
                OutlinedButton(onClick = onShare) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Share")
                }
            }
        }
    }
}

// ── Move List Display ────────────────────────────────────────────────

@Composable
private fun MoveListDisplay(
    moves: List<GameMoveRecord>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        Text("Moves", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(4.dp))

        // Display moves in pairs (white + black)
        val pairs = moves.chunked(2)
        for ((index, pair) in pairs.withIndex()) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${index + 1}.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(32.dp),
                )
                Text(
                    text = pair[0].san,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.width(64.dp),
                )
                if (pair.size > 1) {
                    Text(
                        text = pair[1].san,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.width(64.dp),
                    )
                }
            }
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

private fun difficultyLabel(depth: Int): String = when {
    depth <= 4 -> "Easy (${StockfishEngine.undoChances(depth, false)} undos)"
    depth <= 8 -> "Medium (${StockfishEngine.undoChances(depth, false)} undos)"
    depth <= 12 -> "Hard (${StockfishEngine.undoChances(depth, false)} undos)"
    else -> "Expert (${StockfishEngine.undoChances(depth, false)} undo)"
}
