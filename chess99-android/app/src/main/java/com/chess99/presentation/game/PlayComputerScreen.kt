package com.chess99.presentation.game

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
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
    viewModel: PlayComputerViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    // Sound effects
    val soundManager = remember { SoundManager::class.java }
    LaunchedEffect(state.soundToPlay) {
        state.soundToPlay?.let {
            // In production: soundManager.playXxx() based on sound type
            viewModel.soundPlayed()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Play vs Computer") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        }
    ) { padding ->
        when (state.gamePhase) {
            GamePhase.SETUP -> GameSetupContent(
                modifier = Modifier.padding(padding),
                onStartGame = { color, difficulty, rated ->
                    viewModel.setupGame(color, difficulty, rated)
                    viewModel.startGame()
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
            )
            GamePhase.REPLAY -> { /* Future: replay mode */ }
        }

        // Error dialog
        state.error?.let { error ->
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

// ── Setup Screen ─────────────────────────────────────────────────────

@Composable
private fun GameSetupContent(
    modifier: Modifier = Modifier,
    onStartGame: (Color, Int, Boolean) -> Unit,
) {
    var selectedColor by remember { mutableStateOf(Color.WHITE) }
    var difficulty by remember { mutableIntStateOf(StockfishEngine.DEFAULT_DEPTH) }
    var isRated by remember { mutableStateOf(false) }

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

        Spacer(modifier = Modifier.height(24.dp))

        // Difficulty slider
        Text("Difficulty: $difficulty", style = MaterialTheme.typography.titleMedium)
        Text(
            text = difficultyLabel(difficulty),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Slider(
            value = difficulty.toFloat(),
            onValueChange = { difficulty = it.toInt() },
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
            onClick = { onStartGame(selectedColor, difficulty, isRated) },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
        ) {
            Text("Start Game", style = MaterialTheme.typography.titleMedium)
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
            playerName = "Computer (Lv.${state.difficulty})",
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
            GameResultCard(result = result, onNewGame = onNewGame)
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
            Button(onClick = onNewGame) {
                Text("New Game")
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
