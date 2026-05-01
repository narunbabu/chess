package com.chess99.presentation.history

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.domain.model.*

/**
 * Full-screen game review for a single game.
 * Takes gameId from navigation args via SavedStateHandle.
 * Loads the game and its moves, then displays the replay board
 * with move list, navigation controls, and Stockfish analysis.
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

    val game = state.games.find { it.id == state.expandedGameId }
    val replayState = state.replayState
    val analysisReport = state.analysisReport

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
                    // Export/Share PGN as file
                    IconButton(
                        onClick = { viewModel.exportPgn(context) },
                        enabled = replayState != null && replayState.moves.isNotEmpty(),
                    ) {
                        Icon(Icons.Default.IosShare, contentDescription = "Export PGN")
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

                    // Board with eval bar + current move info
                    if (replayState != null) {
                        // ── Board row: eval bar + board + eval display ──
                        BoardWithEvalBar(
                            game = game,
                            replayState = replayState,
                            analysisReport = analysisReport,
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        // ── Current move info (eval + classification) ──
                        CurrentMoveInfo(
                            replayState = replayState,
                            analysisReport = analysisReport,
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        // ── Navigation controls ──
                        ReplayControls(
                            replayState = replayState,
                            onFirstMove = { viewModel.goToFirstMove() },
                            onPrevMove = { viewModel.goToPreviousMove() },
                            onNextMove = { viewModel.goToNextMove() },
                            onLastMove = { viewModel.goToLastMove() },
                            onToggleAutoPlay = { viewModel.toggleAutoPlay() },
                            modifier = Modifier.fillMaxWidth(),
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // ── Move list with classifications ──
                        AnalysisMoveList(
                            replayState = replayState,
                            analysisReport = analysisReport,
                            onMoveClick = { viewModel.goToMove(it) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 200.dp),
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // ── Copy PGN inline ──
                        OutlinedButton(
                            onClick = {
                                val pgn = viewModel.generatePgn()
                                if (pgn.isNotBlank()) {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE)
                                            as ClipboardManager
                                    val clip = ClipData.newPlainText("PGN", pgn)
                                    clipboard.setPrimaryClip(clip)
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                        ) {
                            Icon(
                                Icons.Default.ContentCopy,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Copy PGN")
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // ── Analysis section ──
                        when (analysisReport?.status) {
                            AnalysisStatus.IDLE, null -> {
                                AnalysisTriggerButton(
                                    onClick = {
                                        val gid = state.expandedGameId ?: return@AnalysisTriggerButton
                                        viewModel.triggerAnalysis(gid)
                                    },
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                            AnalysisStatus.LOADING -> {
                                AnalysisLoadingIndicator(
                                    progress = analysisReport.progress,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                            AnalysisStatus.ERROR -> {
                                AnalysisError(
                                    error = analysisReport.error ?: "Unknown error",
                                    onRetry = {
                                        val gid = state.expandedGameId ?: return@AnalysisError
                                        viewModel.triggerAnalysis(gid)
                                    },
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                            AnalysisStatus.DONE -> {
                                AnalysisResults(
                                    report = analysisReport,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))
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

// ── Board with Eval Bar ────────────────────────────────────────────────

@Composable
private fun BoardWithEvalBar(
    game: GameSummary,
    replayState: ReplayState,
    analysisReport: GameAnalysisReport?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Eval bar (left side)
        val currentEval = currentEvalForMove(replayState, analysisReport)
        if (analysisReport?.status == AnalysisStatus.DONE && currentEval != null) {
            EvalBar(
                evalCp = currentEval.evalAfterCp,
                isMate = currentEval.isMateAfter,
                width = 18.dp,
                height = 260.dp,
            )
            Spacer(modifier = Modifier.width(6.dp))
        }

        // Chess board
        val boardGame = remember(replayState.currentFen) {
            com.chess99.engine.ChessGame(replayState.currentFen)
        }
        val boardOrientation = if (game.playerColor == "black") {
            com.chess99.engine.Color.BLACK
        } else {
            com.chess99.engine.Color.WHITE
        }
        com.chess99.presentation.common.ChessBoardView(
            game = boardGame,
            boardOrientation = boardOrientation,
            isInteractive = false,
            modifier = Modifier.weight(1f),
        )
    }
}

// ── Current Move Info ──────────────────────────────────────────────────

@Composable
private fun CurrentMoveInfo(
    replayState: ReplayState,
    analysisReport: GameAnalysisReport?,
) {
    val moveIndex = replayState.currentMoveIndex
    if (moveIndex < 0) {
        // At starting position
        Text(
            text = "Starting position",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
        )
        return
    }

    val move = replayState.moves.getOrNull(moveIndex)
    if (move == null) return

    // Find analysis for this move
    val analyzedMove = analysisReport?.moveAnalyses?.getOrNull(moveIndex)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Move number + SAN
        Text(
            text = "${move.moveNumber}. ${move.san}",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
        )

        if (analyzedMove != null) {
            Spacer(modifier = Modifier.width(12.dp))

            // Classification badge
            ClassificationBadge(classification = analyzedMove.classification)

            Spacer(modifier = Modifier.width(8.dp))

            // Eval change
            val deltaCp = analyzedMove.cpLoss
            val deltaText = if (deltaCp > 0) {
                "-${"%.1f".format(deltaCp / 100.0)}"
            } else {
                "+${"%.1f".format(-deltaCp / 100.0)}"
            }
            val deltaColor = when {
                deltaCp <= 10 -> Color(0xFF81B64C)
                deltaCp <= 30 -> Color(0xFFA3D160)
                deltaCp <= 70 -> Color(0xFFE8A93E)
                deltaCp <= 200 -> Color(0xFFE07020)
                else -> Color(0xFFC33A3A)
            }
            Text(
                text = deltaText,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = deltaColor,
                fontFamily = FontFamily.Monospace,
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Position eval after move
            EvalDisplay(
                evalCp = analyzedMove.evalAfterCp,
                isMate = analyzedMove.isMateAfter,
            )
        }
    }
}

// ── Classification Badge ───────────────────────────────────────────────

private val ClassificationBadgeColors = mapOf(
    MoveClassification.BRILLIANT to Color(0xFF46BDF0),
    MoveClassification.EXCELLENT to Color(0xFF81B64C),
    MoveClassification.GOOD to Color(0xFFA3D160),
    MoveClassification.INACCURACY to Color(0xFFE8A93E),
    MoveClassification.MISTAKE to Color(0xFFE07020),
    MoveClassification.BLUNDER to Color(0xFFC33A3A),
    MoveClassification.BOOK to Color(0xFF4A90D9),
)

@Composable
private fun ClassificationBadge(classification: MoveClassification) {
    val color = ClassificationBadgeColors[classification] ?: Color.Gray
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = color.copy(alpha = 0.18f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = classification.icon,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = color,
            )
            Spacer(modifier = Modifier.width(2.dp))
            Text(
                text = classification.label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = color,
            )
        }
    }
}

// ── Analysis Move List ─────────────────────────────────────────────────

@Composable
private fun AnalysisMoveList(
    replayState: ReplayState,
    analysisReport: GameAnalysisReport?,
    onMoveClick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val moves = replayState.moves
    if (moves.isEmpty()) return

    Column(
        modifier = modifier
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Text(
            "Moves",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(modifier = Modifier.height(4.dp))

        val pairs = moves.chunked(2)
        for ((pairIndex, pair) in pairs.withIndex()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${pairIndex + 1}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(32.dp),
                )

                // White move with optional classification
                val whiteIdx = pairIndex * 2
                AnalysisMoveChip(
                    san = pair[0].san,
                    isSelected = replayState.currentMoveIndex == whiteIdx,
                    analysis = analysisReport?.moveAnalyses?.getOrNull(whiteIdx),
                    onClick = { onMoveClick(whiteIdx) },
                    modifier = Modifier.weight(1f),
                )

                Spacer(modifier = Modifier.width(4.dp))

                // Black move with optional classification
                if (pair.size > 1) {
                    val blackIdx = pairIndex * 2 + 1
                    AnalysisMoveChip(
                        san = pair[1].san,
                        isSelected = replayState.currentMoveIndex == blackIdx,
                        analysis = analysisReport?.moveAnalyses?.getOrNull(blackIdx),
                        onClick = { onMoveClick(blackIdx) },
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun AnalysisMoveChip(
    san: String,
    isSelected: Boolean,
    analysis: AnalyzedMove?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val classificationColor = analysis?.classification?.let { cls ->
        ClassificationBadgeColors[cls]
    }

    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.small,
        color = when {
            isSelected -> MaterialTheme.colorScheme.primaryContainer
            classificationColor != null -> classificationColor.copy(alpha = 0.12f)
            else -> Color.Transparent
        },
        modifier = modifier.padding(vertical = 1.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Classification icon (if analysis available)
            if (analysis != null) {
                val clsColor = ClassificationBadgeColors[analysis.classification] ?: Color.Gray
                Text(
                    text = analysis.classification.icon,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = clsColor,
                )
                Spacer(modifier = Modifier.width(2.dp))
            }

            Text(
                text = san,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                fontFamily = FontFamily.Monospace,
                color = when {
                    isSelected -> MaterialTheme.colorScheme.onPrimaryContainer
                    classificationColor != null -> classificationColor
                    else -> MaterialTheme.colorScheme.onSurface
                },
            )

            // Eval delta (if analysis available and notable)
            if (analysis != null && analysis.cpLoss > 30) {
                Spacer(modifier = Modifier.width(3.dp))
                val lossColor = when {
                    analysis.cpLoss <= 70 -> Color(0xFFE8A93E)
                    analysis.cpLoss <= 200 -> Color(0xFFE07020)
                    else -> Color(0xFFC33A3A)
                }
                Text(
                    text = "-${"%.1f".format(analysis.cpLoss / 100.0)}",
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    color = lossColor,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

// ── Helper ─────────────────────────────────────────────────────────────

private fun currentEvalForMove(
    replayState: ReplayState,
    analysisReport: GameAnalysisReport?,
): AnalyzedMove? {
    val idx = replayState.currentMoveIndex
    if (idx < 0 || analysisReport?.status != AnalysisStatus.DONE) return null
    return analysisReport.moveAnalyses.getOrNull(idx)
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
                    value = if (game.playerColor == "white") "♔ White" else "♚ Black",
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
