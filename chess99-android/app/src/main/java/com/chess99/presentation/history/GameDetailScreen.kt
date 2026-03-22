package com.chess99.presentation.history

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.engine.ChessGame
import com.chess99.presentation.common.ChessBoardView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailScreen(
    gameId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToReview: (Int) -> Unit,
    viewModel: GameDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Game Details") },
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
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(state.error ?: "Error", color = MaterialTheme.colorScheme.error)
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Result badge
                    item {
                        ResultBadge(state.result, state.endReason)
                    }

                    // Players
                    item {
                        PlayersCard(
                            whiteName = state.whiteName,
                            whiteRating = state.whiteRating,
                            blackName = state.blackName,
                            blackRating = state.blackRating,
                        )
                    }

                    // Board with replay
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                val replayGame = remember { ChessGame() }
                                LaunchedEffect(state.currentFen) {
                                    replayGame.load(state.currentFen)
                                }
                                val orientation = if (state.playerColor == "black")
                                    com.chess99.engine.Color.BLACK else com.chess99.engine.Color.WHITE
                                ChessBoardView(
                                    game = replayGame,
                                    boardOrientation = orientation,
                                    isInteractive = false,
                                    modifier = Modifier.fillMaxWidth(),
                                )

                                Spacer(Modifier.height(8.dp))

                                // Replay controls
                                Row(
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    IconButton(onClick = { viewModel.goToStart() }) {
                                        Icon(Icons.Default.SkipPrevious, "Start")
                                    }
                                    IconButton(onClick = { viewModel.stepBackward() }) {
                                        Icon(Icons.Default.FastRewind, "Previous")
                                    }
                                    IconButton(onClick = { viewModel.toggleAutoPlay() }) {
                                        Icon(
                                            if (state.isAutoPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                            if (state.isAutoPlaying) "Pause" else "Play",
                                        )
                                    }
                                    IconButton(onClick = { viewModel.stepForward() }) {
                                        Icon(Icons.Default.FastForward, "Next")
                                    }
                                    IconButton(onClick = { viewModel.goToEnd() }) {
                                        Icon(Icons.Default.SkipNext, "End")
                                    }
                                }

                                Text(
                                    text = "Move ${state.currentMoveIndex} / ${state.totalMoves}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    // Game info
                    item {
                        GameInfoCard(
                            date = state.date,
                            mode = state.gameMode,
                            totalMoves = state.totalMoves,
                            timeControl = state.timeControl,
                            opening = state.openingName,
                        )
                    }

                    // Move list
                    if (state.movePairs.isNotEmpty()) {
                        item {
                            MoveListCard(
                                movePairs = state.movePairs,
                                currentMoveIndex = state.currentMoveIndex,
                                onMoveClick = { viewModel.jumpToMove(it) },
                            )
                        }
                    }

                    // Full review button
                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigateToReview(gameId) },
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                            ),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text(
                                text = "Full Game Review",
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Medium,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultBadge(result: String?, endReason: String?) {
    if (result == null) return
    val r = result.lowercase()
    val isWin = listOf("won", "win", "checkmate").any { r.contains(it) }
    val isDraw = listOf("draw", "stalemate", "1/2").any { r.contains(it) }

    val bgColor = when {
        isWin -> Color(0xFF81B64C)
        isDraw -> Color(0xFFE8A93E)
        else -> Color(0xFFC33A3A)
    }
    val label = when {
        isWin -> "Victory"
        isDraw -> "Draw"
        else -> "Defeat"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = bgColor.copy(alpha = 0.15f)),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = bgColor,
            )
            if (endReason != null) {
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "($endReason)",
                    style = MaterialTheme.typography.bodySmall,
                    color = bgColor.copy(alpha = 0.7f),
                )
            }
        }
    }
}

@Composable
private fun PlayersCard(
    whiteName: String,
    whiteRating: Int?,
    blackName: String,
    blackRating: Int?,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFF0D9B5)),
                )
                Text(whiteName, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                if (whiteRating != null) {
                    Text("($whiteRating)", style = MaterialTheme.typography.bodySmall)
                }
            }
            Text("vs", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF3D3A37)),
                )
                Text(blackName, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                if (blackRating != null) {
                    Text("($blackRating)", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun GameInfoCard(
    date: String?,
    mode: String?,
    totalMoves: Int,
    timeControl: String?,
    opening: String?,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Game Info", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Spacer(Modifier.height(8.dp))
            if (opening != null) InfoRow("Opening", opening)
            if (date != null) InfoRow("Date", date)
            if (mode != null) InfoRow("Mode", mode.replaceFirstChar { it.uppercase() })
            InfoRow("Moves", "$totalMoves")
            if (timeControl != null) InfoRow("Time Control", timeControl)
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun MoveListCard(
    movePairs: List<GameDetailViewModel.MovePair>,
    currentMoveIndex: Int,
    onMoveClick: (Int) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Moves", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Spacer(Modifier.height(8.dp))
            movePairs.forEach { pair ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${pair.num}.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(32.dp),
                    )
                    MoveChip(pair.whiteSan, currentMoveIndex == pair.whiteIdx) {
                        onMoveClick(pair.whiteIdx)
                    }
                    Spacer(Modifier.width(4.dp))
                    if (pair.blackSan != null) {
                        MoveChip(pair.blackSan, currentMoveIndex == pair.blackIdx) {
                            onMoveClick(pair.blackIdx)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MoveChip(san: String, isActive: Boolean, onClick: () -> Unit) {
    Text(
        text = san,
        fontSize = 13.sp,
        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
        color = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(
                if (isActive) MaterialTheme.colorScheme.primaryContainer
                else Color.Transparent,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}
