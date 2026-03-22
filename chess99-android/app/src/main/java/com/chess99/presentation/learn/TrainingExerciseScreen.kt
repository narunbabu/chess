package com.chess99.presentation.learn

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView

/**
 * Interactive training exercise screen with chess board.
 * Mirrors chess-frontend/src/components/TrainingExercise.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrainingExerciseScreen(
    exerciseId: String,
    onNavigateBack: () -> Unit,
    viewModel: TrainingExerciseViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(exerciseId) {
        viewModel.loadExercise(exerciseId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.title) },
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
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Progress bar
                    LinearProgressIndicator(
                        progress = { state.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    )

                    // Instruction
                    Text(
                        text = state.instruction,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        textAlign = TextAlign.Center,
                    )

                    // Board
                    val game = remember(state.fen) { ChessGame(state.fen) }
                    ChessBoardView(
                        game = game,
                        boardOrientation = state.playerColor,
                        isInteractive = !state.isStepComplete,
                        onMove = { from, to, promo -> viewModel.onMove(from, to, promo) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Feedback
                    state.feedback?.let { feedback ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (state.isCorrect)
                                    MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Text(
                                text = feedback,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Continue button
                    if (state.isStepComplete) {
                        Button(
                            onClick = { viewModel.nextStep() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                                .height(50.dp),
                        ) {
                            Text(if (state.isExerciseComplete) "Finish" else "Next")
                        }
                    }
                }
            }
        }
    }
}
