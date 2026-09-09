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
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.automirrored.filled.Undo
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
    onNavigateToLocalReview: () -> Unit = {},
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
    val soundManager = remember(shareContext) { SoundManager(shareContext.applicationContext) }
    DisposableEffect(soundManager) { onDispose { soundManager.release() } }
    LaunchedEffect(state.soundToPlay) {
        state.soundToPlay?.let {
            when (it) {
                MoveSound.MOVE -> soundManager.playMove()
                MoveSound.CAPTURE -> soundManager.playCapture()
                MoveSound.CHECK -> soundManager.playCheck()
                MoveSound.GAME_END -> soundManager.playGameEnd()
            }
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
                onStartGame = { color, difficulty, mode, persona ->
                    viewModel.setupGame(color, difficulty, mode)
                    if (persona != null) {
                        // T3: try the real, server-recorded game first; the
                        // LaunchedEffect above navigates away on success. On
                        // failure PersonaUiState.startGameError flips to
                        // "fallback_local" and we start the local engine below
                        // with the persona's level already applied — the
                        // player is never blocked by a network hiccup.
                        // A rated persona game is created server-side as a rated
                        // bot game (game_mode=rated) so Elo applies + shows at end.
                        // Learning persona games are casual server-side + learning_mode=true.
                        viewModel.startPersonaGame(persona, mode = mode)
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
                onBestMove = { viewModel.requestBestMove() },
                onResign = { viewModel.resign() },
                onReview = onNavigateToLocalReview,
                onPlayAgain = { viewModel.playAgain() },
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
    onStartGame: (Color, Int, GameMode, SyntheticPlayer?) -> Unit,
) {
    var selectedColor by remember { mutableStateOf(Color.WHITE) }
    var difficulty by remember { mutableIntStateOf(StockfishEngine.DEFAULT_DEPTH) }
    var gameMode by remember { mutableStateOf(GameMode.CASUAL) }

    // T5: cached for the VM's lifetime \u2014 only fetched once per screen visit.
    LaunchedEffect(Unit) { onLoadPersonas() }

    // Rated bot games are now supported server-side (game_mode=rated applies
    // Elo via GameController::completeGame), so a persona pick + rated toggle can
    // coexist — no longer force-clear the persona when rated is turned on.

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
        // the row simply doesn't render; the slider below still works. Shown for
        // both casual and rated: a rated persona game becomes a rated bot game.
        if (personaState.personas.isNotEmpty()) {
            Spacer(modifier = Modifier.height(24.dp))
            Text("Choose an opponent", style = MaterialTheme.typography.titleMedium)
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

        // Game mode — 3-way selector (Casual / Learning / Rated), matching web's
        // GameModeSelector.jsx. (Companion is a separate existing feature.)
        Text(
            "Game Mode",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.align(Alignment.Start),
        )
        Spacer(modifier = Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            GameMode.entries.forEachIndexed { index, mode ->
                SegmentedButton(
                    selected = gameMode == mode,
                    onClick = { gameMode = mode },
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = GameMode.entries.size),
                ) {
                    Text(
                        when (mode) {
                            GameMode.CASUAL -> "Casual"
                            GameMode.LEARNING -> "Learning"
                            GameMode.RATED -> "Rated"
                        }
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        when (gameMode) {
            GameMode.RATED -> Text(
                text = if (personaState.selectedPersona == null)
                    "Choose a named online opponent above for rated play. Custom computer games are not rated."
                else "No undo or pause. Rated play requires a server connection.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
            GameMode.LEARNING -> Text(
                text = "Best-move & undo help from a small pool " +
                    "(${PlayComputerViewModel.DEFAULT_LEARNING_HELP_LIMIT}); not rated",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            GameMode.CASUAL -> {
                val undos = StockfishEngine.undoChances(difficulty, false)
                Text(
                    text = "$undos undo chances available",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                onStartGame(selectedColor, difficulty, gameMode, personaState.selectedPersona)
            },
            enabled = !personaState.isStartingGame &&
                (gameMode != GameMode.RATED || personaState.selectedPersona != null),
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
    onBestMove: () -> Unit,
    onResign: () -> Unit,
    onReview: () -> Unit,
    onPlayAgain: () -> Unit,
    onShare: () -> Unit,
) {
    val game = remember(state.fen) { ChessGame(state.fen) }
    val isPlayerTurn = game.turn == state.playerColor && !state.computerMoveInProgress

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
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
            arrows = if (state.bestMoveFrom >= 0 && state.bestMoveTo >= 0) {
                listOf(BoardArrow(state.bestMoveFrom, state.bestMoveTo, 0xCC2E7D32L))
            } else {
                emptyList()
            },
            onMove = onMove,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
        )

        AccessibleChessMoveControls(
            game = game,
            isInteractive = isPlayerTurn && state.gamePhase == GamePhase.PLAYING,
            onMove = onMove,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
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
        if (state.computerMoveInProgress || state.bestMoveInProgress) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (state.bestMoveInProgress) "Finding a best move..." else "Computer thinking...",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            Text(
                text = when {
                    game.isCheck() && game.turn == state.playerColor -> "Your king is in check. Your turn."
                    game.isCheck() -> "Computer is in check. Computer's turn."
                    isPlayerTurn -> "Your turn"
                    else -> "Computer's turn"
                },
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // Game controls
        if (state.gamePhase == GamePhase.PLAYING) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            ) {
                if (state.learningMode && state.undoChancesRemaining > 0) {
                    OutlinedButton(
                        onClick = onBestMove,
                        enabled = isPlayerTurn && !state.bestMoveInProgress && state.bestMoveUci == null,
                        modifier = Modifier.sizeIn(minHeight = 48.dp),
                    ) {
                        Icon(Icons.Default.Lightbulb, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Best")
                    }
                }

                // Undo button
                if (!state.isRated && state.undoChancesRemaining > 0) {
                    OutlinedButton(
                        onClick = onUndo,
                        enabled = isPlayerTurn && state.moveHistory.size >= 2,
                        modifier = Modifier.sizeIn(minHeight = 48.dp),
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Undo")
                    }
                }

                // Resign button
                OutlinedButton(
                    onClick = onResign,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.sizeIn(minHeight = 48.dp),
                ) {
                    Icon(Icons.Default.Flag, contentDescription = "Resign")
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Resign")
                }
            }
            if (state.learningMode) {
                Text(
                    text = "${state.undoChancesRemaining} help ${if (state.undoChancesRemaining == 1) "chance" else "chances"} left for Best or Undo",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else if (!state.isRated && state.undoChancesRemaining > 0) {
                Text(
                    text = "${state.undoChancesRemaining} ${if (state.undoChancesRemaining == 1) "undo" else "undos"} left",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Game result
        state.gameResult?.let { result ->
            GameResultCard(
                result = result,
                onReview = onReview,
                onPlayAgain = onPlayAgain,
                onShare = onShare,
            )
        }

        // Move list
        if (state.moveHistory.isNotEmpty()) {
            MoveListDisplay(
                moves = state.moveHistory,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            )
        }
    }
}

// ── Game Result Card ─────────────────────────────────────────────────

@Composable
private fun GameResultCard(
    result: GameResultState,
    onReview: () -> Unit,
    onPlayAgain: () -> Unit,
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
            Button(
                onClick = onReview,
                modifier = Modifier
                    .fillMaxWidth()
                    .sizeIn(minHeight = 48.dp),
            ) {
                Text("Review game")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = onPlayAgain,
                modifier = Modifier
                    .fillMaxWidth()
                    .sizeIn(minHeight = 48.dp),
            ) {
                Text("Play again")
            }
            TextButton(
                onClick = onShare,
                modifier = Modifier.sizeIn(minHeight = 48.dp),
            ) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Share")
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
    Column(modifier = modifier) {
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
