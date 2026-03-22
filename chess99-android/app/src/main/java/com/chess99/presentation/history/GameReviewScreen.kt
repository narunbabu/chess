package com.chess99.presentation.history

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Full-screen game review for a single game.
 * Takes gameId from navigation args via SavedStateHandle.
 * Loads the game and its moves, then displays the replay board
 * with move list and navigation controls.
 *
 * Navigation route: "game_review/{gameId}"
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameReviewScreen(
    onNavigateBack: () -> Unit,
    viewModel: GameHistoryViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    // Load single game on first composition if games list is empty
    // The gameId is extracted from SavedStateHandle in the ViewModel
    val gameId = state.expandedGameId
    LaunchedEffect(Unit) {
        val navGameId = viewModel.uiState.value.expandedGameId
        if (navGameId == null && state.games.isEmpty()) {
            // The ViewModel was created for this route; the gameId should
            // be passed via nav args. Since SavedStateHandle is injected,
            // we call loadSingleGame from the route's composable setup.
        }
    }

    val game = state.games.find { it.id == state.expandedGameId }
    val replayState = state.replayState

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Game Review",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        if (game != null) {
                            Text(
                                text = "vs ${game.opponentName}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Copy PGN
                    IconButton(
                        onClick = {
                            val pgn = viewModel.generatePgn()
                            if (pgn.isNotBlank()) {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                        as ClipboardManager
                                val clip = ClipData.newPlainText("PGN", pgn)
                                clipboard.setPrimaryClip(clip)
                            }
                        },
                        enabled = replayState != null && replayState.moves.isNotEmpty(),
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = "Copy PGN")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        when {
            state.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            state.error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = state.error ?: "Unknown error",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onNavigateBack) {
                            Text("Go Back")
                        }
                    }
                }
            }
            game == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Game not found",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState()),
                ) {
                    // Game info header
                    GameReviewHeader(game = game)

                    // Replay content (board + controls + move list)
                    if (replayState != null) {
                        ReplayContent(
                            game = game,
                            replayState = replayState,
                            onNavigateToReview = null, // Already in review
                            onFirstMove = { viewModel.goToFirstMove() },
                            onPrevMove = { viewModel.goToPreviousMove() },
                            onNextMove = { viewModel.goToNextMove() },
                            onLastMove = { viewModel.goToLastMove() },
                            onMoveClick = { viewModel.goToMove(it) },
                            onToggleAutoPlay = { viewModel.toggleAutoPlay() },
                            onCopyPgn = {
                                val pgn = viewModel.generatePgn()
                                if (pgn.isNotBlank()) {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                            as ClipboardManager
                                    val clip = ClipData.newPlainText("PGN", pgn)
                                    clipboard.setPrimaryClip(clip)
                                }
                            },
                            modifier = Modifier.padding(16.dp),
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }
            }
        }
    }
}

// ── Game Review Header ────────────────────────────────────────────────

@Composable
private fun GameReviewHeader(game: GameSummary) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (game.result) {
                GameResult.WON -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                GameResult.LOST -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                GameResult.DRAW -> MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
            }
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
        ) {
            // Result
            Row(
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = when (game.result) {
                        GameResult.WON -> "Victory"
                        GameResult.LOST -> "Defeat"
                        GameResult.DRAW -> "Draw"
                    },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )

                if (game.ratingChange != 0) {
                    Spacer(modifier = Modifier.width(12.dp))
                    val color = when {
                        game.ratingChange > 0 -> MaterialTheme.colorScheme.primary
                        game.ratingChange < 0 -> MaterialTheme.colorScheme.error
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    Text(
                        text = if (game.ratingChange > 0) "+${game.ratingChange}" else "${game.ratingChange}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = color,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Details
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                DetailItem(
                    label = "Opponent",
                    value = game.opponentName + if (game.opponentRating > 0) " (${game.opponentRating})" else "",
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                DetailItem(
                    label = "Color",
                    value = if (game.playerColor == "white") "\u2654 White" else "\u265A Black",
                )
                if (game.timeControl.isNotBlank()) {
                    DetailItem(label = "Time", value = game.timeControl)
                }
                DetailItem(
                    label = "Mode",
                    value = game.gameMode.replaceFirstChar { it.uppercaseChar() },
                )
                if (game.totalMoves > 0) {
                    DetailItem(label = "Moves", value = "${game.totalMoves}")
                }
            }

            if (game.endReason.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatEndReason(game.endReason),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun DetailItem(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
        )
    }
}

// ── Helpers ───────────────────────────────────────────────────────────

private fun formatEndReason(reason: String): String {
    return when (reason.lowercase()) {
        "checkmate" -> "Ended by checkmate"
        "resignation", "resign" -> "Ended by resignation"
        "timeout", "time" -> "Ended on time"
        "stalemate" -> "Ended in stalemate"
        "draw", "agreed_draw" -> "Draw by agreement"
        "insufficient_material" -> "Draw by insufficient material"
        "threefold_repetition", "repetition" -> "Draw by threefold repetition"
        "fifty_move_rule", "50_move" -> "Draw by 50-move rule"
        "abandonment", "abandoned" -> "Game abandoned"
        else -> reason.replace("_", " ").replaceFirstChar { it.uppercaseChar() }
    }
}
