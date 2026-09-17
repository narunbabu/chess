package com.chess99.presentation.learn

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView

/**
 * Puzzle screen with daily puzzles and practice mode.
 * Mirrors chess-frontend/src/components/Puzzles.js
 *
 * [track] selects which daily-challenge track to solve (null = default
 * track); the Daily hub passes its selected track through the nav arg.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PuzzleScreen(
    onNavigateBack: () -> Unit,
    track: String? = null,
    viewModel: PuzzleViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(track) {
        viewModel.loadPuzzles(track)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.puzzle_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    if (state.currentPuzzle != null) {
                        IconButton(onClick = { viewModel.requestHint() }) {
                            Icon(Icons.Default.Lightbulb, stringResource(R.string.action_hint))
                        }
                        IconButton(onClick = { viewModel.nextPuzzle() }) {
                            Icon(Icons.Default.SkipNext, stringResource(R.string.local_review_next))
                        }
                    }
                },
            )
        },
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

            state.currentPuzzle == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Extension,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            stringResource(R.string.puzzle_none_available),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = { viewModel.loadPuzzles() }) {
                            Text(stringResource(R.string.action_retry))
                        }
                    }
                }
            }

            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Puzzle info
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            stringResource(R.string.puzzle_number, state.puzzleNumber),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        AssistChip(
                            onClick = { },
                            label = {
                                Text(
                                    if (state.isOfflinePuzzle) {
                                        stringResource(R.string.puzzle_difficulty_offline, state.difficulty)
                                    } else {
                                        state.difficulty
                                    }
                                )
                            },
                        )
                    }

                    // Instruction
                    Text(
                        text = state.instruction,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Board
                    val game = remember(state.fen) { ChessGame(state.fen) }
                    ChessBoardView(
                        game = game,
                        boardOrientation = state.playerColor,
                        isInteractive = !state.isSolved,
                        lastMoveFrom = state.lastMoveFrom,
                        lastMoveTo = state.lastMoveTo,
                        lastMoveEffects = state.lastMoveEffects,
                        onMove = { from, to, promo -> viewModel.attemptMove(from, to, promo) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Hint text
                    state.hint?.let { hint ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            ),
                        ) {
                            Text(
                                text = hint,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }

                    // Solved state
                    if (state.isSolved) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                            ),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(32.dp),
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    stringResource(R.string.tactical_correct),
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                state.dailyReview?.let { review ->
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = when {
                                            !review.persisted -> stringResource(R.string.daily_review_save_failed)
                                            review.alreadyCompleted ->
                                                stringResource(R.string.daily_review_already_completed)
                                            review.xpAwarded > 0 -> stringResource(
                                                R.string.daily_review_saved_xp,
                                                review.xpAwarded,
                                            )
                                            else -> stringResource(R.string.daily_review_saved)
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(onClick = { viewModel.nextPuzzle() }) {
                            Text(stringResource(R.string.tactical_next_puzzle))
                        }
                    }

                    // Wrong move feedback
                    if (state.isWrongMove) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            stringResource(R.string.tactical_incorrect),
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Stats bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${state.solvedCount}", fontWeight = FontWeight.Bold)
                            Text(stringResource(R.string.puzzle_solved), style = MaterialTheme.typography.bodySmall)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${state.streakCount}", fontWeight = FontWeight.Bold)
                            Text(stringResource(R.string.puzzle_streak), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
