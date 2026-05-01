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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TacticalPuzzleContent(
    state: TacticalTrainerUiState,
    onAttemptMove: (String, String, Char?) -> Unit,
    onNextPuzzle: () -> Unit,
    onShowSolution: () -> Unit,
    onBackToDashboard: () -> Unit,
) {
    val puzzle = state.currentPuzzle ?: return

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            state.currentStage?.title ?: "Tactical Trainer",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            "Puzzle ${state.puzzleIndex + 1}/${state.puzzleCount}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackToDashboard) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { onShowSolution() }, enabled = !state.isSolved && !state.solutionShown) {
                        Icon(Icons.Default.Lightbulb, "Show Solution")
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
                    Text("Rating: ${puzzle.rating}", style = MaterialTheme.typography.labelSmall)
                }
            }

            // Instruction
            val instruction = when {
                state.isSolved -> "Correct!"
                else -> {
                    val color = if (state.playerColor == com.chess99.engine.Color.WHITE) "White" else "Black"
                    "$color to move. Find the best continuation."
                }
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
                        text = "Hint: Try moving from $hintSq",
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
                        "Incorrect. Try again!",
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
            Text("Correct!", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = Color(0xFF4CAF50))

            ratingDelta?.let { delta ->
                Spacer(modifier = Modifier.height(4.dp))
                val ratingText = if (delta.sign == "+") "+${delta.value}" else "-${delta.value}"
                val ratingColor = if (delta.sign == "+") Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
                Text("Rating $ratingText", style = MaterialTheme.typography.bodyMedium, color = ratingColor, fontWeight = FontWeight.SemiBold)
            }

            score?.let { s ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Score: ${s.combined ?: s.execScore}/100",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onNextPuzzle) {
                Icon(Icons.Default.SkipNext, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Next Puzzle")
            }
        }
    }
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
                title = { Text("Solution") },
                navigationIcon = {
                    IconButton(onClick = onBackToDashboard) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Previous")
                }
                Text(
                    "Move ${state.solutionMoveIndex + 1}/${puzzle.moves.size}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                IconButton(onClick = { onNavigateSolution(1) }, enabled = state.solutionMoveIndex < puzzle.moves.lastIndex) {
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, "Next")
                }
            }

            // Board
            val game = remember(state.fen) { ChessGame(state.fen) }
            ChessBoardView(
                game = game,
                boardOrientation = state.playerColor,
                isInteractive = false,
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
            state.lastRatingDelta?.let { delta ->
                Spacer(modifier = Modifier.height(8.dp))
                val ratingText = if (delta.sign == "+") "+${delta.value}" else "-${delta.value}"
                val ratingColor = if (delta.sign == "+") Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
                Text(
                    "Rating $ratingText",
                    style = MaterialTheme.typography.bodyMedium,
                    color = ratingColor,
                    fontWeight = FontWeight.SemiBold,
                )
            }

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
                    Text("Dashboard")
                }
                Button(
                    onClick = onNextPuzzle,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Default.SkipNext, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Next")
                }
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}
