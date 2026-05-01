package com.chess99.presentation.game

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.domain.model.SkillGroup
import com.chess99.domain.model.SyntheticPlayer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanionBottomSheet(
    companions: List<SyntheticPlayer>,
    selectedCompanion: SyntheticPlayer?,
    isLoading: Boolean,
    error: String?,
    isContinuousPlay: Boolean,
    moveCount: Int,
    isMyTurn: Boolean,
    isGameActive: Boolean,
    companionThinking: Boolean,
    onSelect: (SyntheticPlayer) -> Unit,
    onPlayOneMove: () -> Unit,
    onToggleContinuous: () -> Unit,
    onDismiss: () -> Unit,
    onRelease: () -> Unit,
    onRetry: () -> Unit,
    sheetState: SheetState,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        if (selectedCompanion != null) {
            CompanionControlPanel(
                companion = selectedCompanion,
                isContinuousPlay = isContinuousPlay,
                moveCount = moveCount,
                isMyTurn = isMyTurn,
                isGameActive = isGameActive,
                companionThinking = companionThinking,
                onPlayOneMove = onPlayOneMove,
                onToggleContinuous = onToggleContinuous,
                onRelease = onRelease,
            )
        } else {
            CompanionSelectorPanel(
                companions = companions,
                isLoading = isLoading,
                error = error,
                onSelect = onSelect,
                onRetry = onRetry,
            )
        }
    }
}

@Composable
private fun CompanionSelectorPanel(
    companions: List<SyntheticPlayer>,
    isLoading: Boolean,
    error: String?,
    onSelect: (SyntheticPlayer) -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .navigationBarsPadding(),
    ) {
        Text(
            "Choose a Companion",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "An AI will play moves on your behalf. Casual games only.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(12.dp))

        when {
            isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            error != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(error, color = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.height(8.dp))
                    TextButton(onClick = onRetry) { Text("Retry") }
                }
            }
            else -> {
                val grouped = companions.groupBy { it.skillGroup }
                val groupOrder = listOf(SkillGroup.BEGINNER, SkillGroup.INTERMEDIATE, SkillGroup.ADVANCED)

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    groupOrder.forEach { group ->
                        val players = grouped[group] ?: return@forEach
                        item {
                            Text(
                                group.label,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                            )
                        }
                        items(players, key = { it.id }) { player ->
                            CompanionCard(
                                companion = player,
                                onClick = { onSelect(player) },
                            )
                        }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun CompanionCard(
    companion: SyntheticPlayer,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.tertiary,
                            )
                        )
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    companion.name.firstOrNull()?.uppercase() ?: "?",
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Info
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        companion.name,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        companion.personalityEmoji,
                        fontSize = 14.sp,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "Lv${companion.computerLevel}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    companion.bio,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Rating: ${companion.rating}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "${companion.gamesPlayed} games",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Win: ${companion.winRate.toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun CompanionControlPanel(
    companion: SyntheticPlayer,
    isContinuousPlay: Boolean,
    moveCount: Int,
    isMyTurn: Boolean,
    isGameActive: Boolean,
    companionThinking: Boolean,
    onPlayOneMove: () -> Unit,
    onToggleContinuous: () -> Unit,
    onRelease: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .navigationBarsPadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Companion header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.tertiary,
                            )
                        )
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    companion.name.firstOrNull()?.uppercase() ?: "?",
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    companion.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Lv${companion.computerLevel} • ${companion.rating} ELO • ${companion.personalityEmoji} ${companion.personality}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Move count
        if (moveCount > 0) {
            Text(
                "$moveCount move${if (moveCount != 1) "s" else ""} played",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        // Thinking indicator
        if (companionThinking) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "${companion.name} is thinking...",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Status
        if (!isGameActive) {
            Text(
                "Game not active",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 4.dp),
            )
        } else if (!isMyTurn && !companionThinking) {
            Text(
                "Waiting for opponent's turn...",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 4.dp),
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Play One Move
            Button(
                onClick = onPlayOneMove,
                enabled = isGameActive && isMyTurn && !companionThinking,
                modifier = Modifier.weight(1f),
            ) {
                Text("Play One Move", fontSize = 13.sp)
            }

            // Continuous Play toggle
            Button(
                onClick = onToggleContinuous,
                enabled = isGameActive && !companionThinking,
                modifier = Modifier.weight(1f),
                colors = if (isContinuousPlay) {
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    )
                } else {
                    ButtonDefaults.buttonColors()
                },
            ) {
                Text(
                    if (isContinuousPlay) "Stop" else "Auto Play",
                    fontSize = 13.sp,
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Release companion
        OutlinedButton(
            onClick = onRelease,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
        ) {
            Text("Release Companion", fontSize = 13.sp)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}
