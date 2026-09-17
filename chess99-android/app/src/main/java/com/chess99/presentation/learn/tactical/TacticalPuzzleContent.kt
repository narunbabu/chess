package com.chess99.presentation.learn.tactical

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.chess99.R
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.common.MoveEffects

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TacticalPuzzleContent(
    state: TacticalTrainerUiState,
    onAttemptMove: (String, String, Char?) -> Unit,
    onNextPuzzle: () -> Unit,
    onRequestHint: () -> Unit,
    onDismissHintDialog: () -> Unit,
    onConfirmShowSolution: () -> Unit,
    onBackToDashboard: () -> Unit,
) {
    val puzzle = state.currentPuzzle ?: return

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            state.currentStage?.let { stringResource(it.title) } ?: stringResource(R.string.tactical_trainer_title),
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            stringResource(R.string.tactical_puzzle_index, state.puzzleIndex + 1, state.puzzleCount),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackToDashboard) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    IconButton(onClick = { onRequestHint() }, enabled = !state.isSolved && !state.solutionShown) {
                        Icon(Icons.Default.Lightbulb, stringResource(R.string.action_hint))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Puzzle info row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val diffColor = when (puzzle.difficulty) {
                    "easy" -> Color(0xFF4CAF50)
                    "medium" -> Color(0xFFFFA726)
                    "hard" -> Color(0xFFEF5350)
                    "very hard" -> Color(0xFF9C27B0)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Surface(
                    color = diffColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        puzzle.difficulty.replaceFirstChar { it.uppercase() },
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = diffColor,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Star, null, modifier = Modifier.size(14.dp), tint = Color(0xFFFFC107))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.tactical_puzzle_rating, puzzle.rating), style = MaterialTheme.typography.labelSmall)
                }
            }

            // Instruction
            val instruction = if (state.isSolved) {
                stringResource(R.string.tactical_correct)
            } else {
                val color = stringResource(
                    if (state.playerColor == com.chess99.engine.Color.WHITE) {
                        R.string.color_white_name
                    } else {
                        R.string.color_black_name
                    },
                )
                stringResource(R.string.tactical_to_move, color)
            }
            Text(
                text = instruction,
                style = MaterialTheme.typography.bodyMedium,
                color = if (state.isSolved) Color(0xFF4CAF50) else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                fontWeight = if (state.isSolved) FontWeight.Bold else FontWeight.Normal,
            )

            // Hint
            state.hintSquare?.let { hintSq ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                ) {
                    Text(
                        text = stringResource(R.string.tactical_hint_square, hintSq),
                        modifier = Modifier.padding(8.dp),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Board
            val game = remember(state.fen) { ChessGame(state.fen) }
            ChessBoardView(
                game = game,
                boardOrientation = state.playerColor,
                isInteractive = !state.isSolved && !state.solutionShown,
                lastMoveFrom = state.lastMoveFrom,
                lastMoveTo = state.lastMoveTo,
                lastMoveEffects = state.lastMoveEffects,
                onMove = { from, to, promo -> onAttemptMove(from, to, promo) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Wrong move feedback
            if (state.isWrongMove && !state.isSolved) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Close, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        stringResource(R.string.tactical_incorrect),
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            // Solved state
            if (state.isSolved) {
                SolvedCard(
                    score = state.lastScore,
                    ratingDelta = state.lastRatingDelta,
                    onNextPuzzle = onNextPuzzle,
                )
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }

    // Second hint tap: confirm before revealing the solution (0 points for this puzzle).
    if (state.showHintConfirmDialog) {
        AlertDialog(
            onDismissRequest = onDismissHintDialog,
            title = { Text(stringResource(R.string.tactical_show_solution_title)) },
            text = { Text(stringResource(R.string.tactical_show_solution_body)) },
            confirmButton = {
                TextButton(onClick = onConfirmShowSolution) { Text(stringResource(R.string.tactical_show_solution_confirm)) }
            },
            dismissButton = {
                TextButton(onClick = onDismissHintDialog) { Text(stringResource(R.string.tactical_keep_trying)) }
            },
        )
    }
}

@Composable
private fun SolvedCard(
    score: PuzzleScoreResult?,
    ratingDelta: RatingDelta?,
    onNextPuzzle: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF4CAF50).copy(alpha = 0.1f)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(32.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(stringResource(R.string.tactical_correct), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = Color(0xFF4CAF50))

            RatingDeltaChip(ratingDelta, modifier = Modifier.padding(top = 4.dp))

            score?.let { s ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    stringResource(R.string.tactical_score, s.combined ?: s.execScore),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onNextPuzzle) {
                Icon(Icons.Default.SkipNext, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(stringResource(R.string.tactical_next_puzzle))
            }
        }
    }
}

/**
 * Renders a rating delta chip, never "-0": delta > 0 -> "+N" (green), delta < 0 ->
 * "-N" (red), delta == 0 -> nothing (no chip at all).
 */
@Composable
private fun RatingDeltaChip(delta: RatingDelta?, modifier: Modifier = Modifier) {
    if (delta == null || delta.value == 0) return
    val signedValue = if (delta.sign == "+") delta.value else -delta.value
    val ratingText = if (signedValue > 0) "+$signedValue" else "$signedValue"
    val ratingColor = if (signedValue > 0) Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
    Text(
        stringResource(R.string.tactical_rating_delta, ratingText),
        style = MaterialTheme.typography.bodyMedium,
        color = ratingColor,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SolutionViewerContent(
    state: TacticalTrainerUiState,
    onNavigateSolution: (Int) -> Unit,
    onNextPuzzle: () -> Unit,
    onBackToDashboard: () -> Unit,
) {
    val puzzle = state.currentPuzzle ?: return

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tactical_solution_title)) },
                navigationIcon = {
                    IconButton(onClick = onBackToDashboard) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Move navigator
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { onNavigateSolution(-1) }, enabled = state.solutionMoveIndex > 0) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.a11y_previous_move))
                }
                Text(
                    stringResource(R.string.tactical_solution_move, state.solutionMoveIndex + 1, puzzle.moves.size),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                IconButton(onClick = { onNavigateSolution(1) }, enabled = state.solutionMoveIndex < puzzle.moves.lastIndex) {
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, stringResource(R.string.a11y_next_move))
                }
            }

            // Board
            val game = remember(state.fen) { ChessGame(state.fen) }
            ChessBoardView(
                game = game,
                boardOrientation = state.playerColor,
                isInteractive = false,
                lastMoveFrom = state.lastMoveFrom,
                lastMoveTo = state.lastMoveTo,
                lastMoveEffects = state.lastMoveEffects,
                onMove = { _, _, _ -> },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Explanation
            if (puzzle.explanation.isNotBlank()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                ) {
                    Text(
                        text = puzzle.explanation,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            // Rating delta
            RatingDeltaChip(state.lastRatingDelta, modifier = Modifier.padding(top = 8.dp))

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    onClick = onBackToDashboard,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Default.Dashboard, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.drawer_dashboard))
                }
                Button(
                    onClick = onNextPuzzle,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Default.SkipNext, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.local_review_next))
                }
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}
