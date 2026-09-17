package com.chess99.presentation.history

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FirstPage
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.LastPage
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.chess99.R
import com.chess99.engine.ChessGame
import com.chess99.engine.Square
import com.chess99.presentation.common.ChessBoardView
import com.chess99.presentation.game.ResultStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class LocalGameReviewViewModel @Inject constructor(
    store: LocalGameReviewStore,
) : ViewModel() {
    val review: LocalGameReviewRecord? = store.load()
}

/** Offline-safe replay for the latest completed local/guest computer game. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalGameReviewScreen(
    onNavigateBack: () -> Unit,
    viewModel: LocalGameReviewViewModel = hiltViewModel(),
) {
    val review = viewModel.review
    var moveIndex by remember(review) { mutableIntStateOf(review?.moves?.size ?: 0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.local_review_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        if (review == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(stringResource(R.string.local_review_unavailable))
                Spacer(Modifier.height(16.dp))
                Button(onClick = onNavigateBack, modifier = Modifier.sizeIn(minHeight = 48.dp)) {
                    Text(stringResource(R.string.local_review_go_back))
                }
            }
            return@Scaffold
        }

        val fen = if (moveIndex == 0) review.startingFen else review.moves[moveIndex - 1].fen
        val currentMove = review.moves.getOrNull(moveIndex - 1)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = when (review.result.status) {
                        ResultStatus.WON -> MaterialTheme.colorScheme.primaryContainer
                        ResultStatus.LOST -> MaterialTheme.colorScheme.errorContainer
                        ResultStatus.DRAW -> MaterialTheme.colorScheme.secondaryContainer
                    }
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(
                        text = review.result.details,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(
                            R.string.local_review_summary,
                            review.opponentName,
                            review.gameMode.name.lowercase().replaceFirstChar { it.uppercase() },
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            Spacer(Modifier.height(8.dp))
            ChessBoardView(
                game = remember(fen) { ChessGame(fen) },
                boardOrientation = review.playerColor,
                isInteractive = false,
                lastMoveFrom = currentMove?.from?.let { Square.fromAlgebraic(it) } ?: -1,
                lastMoveTo = currentMove?.to?.let { Square.fromAlgebraic(it) } ?: -1,
                modifier = Modifier.fillMaxWidth(),
            )

            Text(
                text = currentMove?.let {
                    stringResource(R.string.local_review_move, moveIndex, it.san)
                } ?: stringResource(R.string.review_starting_position),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(vertical = 8.dp),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ReviewButton(stringResource(R.string.local_review_first), enabled = moveIndex > 0, onClick = { moveIndex = 0 }) {
                    Icon(Icons.Default.FirstPage, contentDescription = null)
                }
                ReviewButton(stringResource(R.string.local_review_previous), enabled = moveIndex > 0, onClick = { moveIndex-- }) {
                    Icon(Icons.Default.KeyboardArrowLeft, contentDescription = null)
                }
                ReviewButton(stringResource(R.string.local_review_next), enabled = moveIndex < review.moves.size, onClick = { moveIndex++ }) {
                    Icon(Icons.Default.KeyboardArrowRight, contentDescription = null)
                }
                ReviewButton(stringResource(R.string.local_review_last), enabled = moveIndex < review.moves.size, onClick = { moveIndex = review.moves.size }) {
                    Icon(Icons.Default.LastPage, contentDescription = null)
                }
            }

            if (review.moves.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    review.moves.forEachIndexed { index, move ->
                        Button(
                            onClick = { moveIndex = index + 1 },
                            modifier = Modifier.sizeIn(minHeight = 48.dp),
                    ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    stringResource(
                                        R.string.local_review_move_san,
                                        index + 1,
                                        move.san,
                                    )
                                )
                                move.lifelines.forEach { marker ->
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        stringResource(LifelineMarkers.labelRes(marker)),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF2E8B6D),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            icon()
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}
