package com.chess99.presentation.social

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.delay

/**
 * Game end result card shown after a game completes.
 * Displays winner/loser, rating changes, game stats, and share buttons.
 *
 * Mirrors chess-frontend/src/components/play/DefeatCard.js + VictoryCard behavior.
 */

// ── Data Classes ────────────────────────────────────────────────────────

data class GameEndData(
    val gameId: Int,
    val result: GameEndResult, // WIN, LOSS, DRAW
    val playerName: String,
    val playerAvatarUrl: String? = null,
    val playerRatingBefore: Int,
    val playerRatingAfter: Int,
    val opponentName: String,
    val opponentAvatarUrl: String? = null,
    val opponentRatingBefore: Int,
    val opponentRatingAfter: Int,
    val totalMoves: Int,
    val timeUsed: String = "", // e.g. "5:32"
    val accuracy: Float? = null, // 0.0-100.0, null if unavailable
    val timeControl: String,
    val endReason: String = "", // "checkmate", "resignation", "timeout", "draw"
    val pgn: String = "",
)

enum class GameEndResult { WIN, LOSS, DRAW }

enum class SharePlatform { WHATSAPP, TWITTER, FACEBOOK, COPY_LINK, MORE }

// ── Main Composable ─────────────────────────────────────────────────────

@Composable
fun GameEndCard(
    data: GameEndData,
    onShareClick: (SharePlatform) -> Unit,
    onPlayAgain: () -> Unit,
    onReviewGame: () -> Unit,
    onDismiss: () -> Unit,
) {
    val ratingDelta = data.playerRatingAfter - data.playerRatingBefore

    // Celebration visibility for wins
    var showCelebration by remember { mutableStateOf(false) }
    LaunchedEffect(data.result) {
        if (data.result == GameEndResult.WIN) {
            showCelebration = true
            delay(3000)
            showCelebration = false
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ── Celebration Banner ──────────────────────────────────────
            AnimatedVisibility(
                visible = showCelebration,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically(),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x1A4CAF50)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Checkmate!",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(8.dp),
                    )
                }
            }

            // ── Result Header ───────────────────────────────────────────
            val (resultText, resultColor) = when (data.result) {
                GameEndResult.WIN -> "Victory!" to Color(0xFF4CAF50)
                GameEndResult.LOSS -> "Defeat" to Color(0xFFF44336)
                GameEndResult.DRAW -> "Draw" to Color(0xFFFF9800)
            }

            Text(
                text = resultText,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = resultColor,
            )

            if (data.endReason.isNotBlank()) {
                Text(
                    text = data.endReason.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ── Player vs Opponent ──────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Player
                PlayerInfo(
                    name = data.playerName,
                    avatarUrl = data.playerAvatarUrl,
                    ratingBefore = data.playerRatingBefore,
                    ratingAfter = data.playerRatingAfter,
                    isWinner = data.result == GameEndResult.WIN,
                )

                Text(
                    text = "vs",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium,
                )

                // Opponent
                PlayerInfo(
                    name = data.opponentName,
                    avatarUrl = data.opponentAvatarUrl,
                    ratingBefore = data.opponentRatingBefore,
                    ratingAfter = data.opponentRatingAfter,
                    isWinner = data.result == GameEndResult.LOSS,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(12.dp))

            // ── Rating Change ───────────────────────────────────────────
            AnimatedRatingChange(
                ratingBefore = data.playerRatingBefore,
                ratingAfter = data.playerRatingAfter,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // ── Game Stats ──────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                StatChip(label = "Moves", value = "${data.totalMoves}")
                StatChip(
                    label = "Time",
                    value = data.timeControl.replace("|", "+"),
                )
                if (data.timeUsed.isNotBlank()) {
                    StatChip(label = "Used", value = data.timeUsed)
                }
                data.accuracy?.let { acc ->
                    StatChip(label = "Accuracy", value = "${acc.toInt()}%")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(12.dp))

            // ── Share Buttons ───────────────────────────────────────────
            Text(
                text = "Share Result",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                ShareIconButton(
                    icon = Icons.Default.Chat,
                    label = "WhatsApp",
                    color = Color(0xFF25D366),
                    onClick = { onShareClick(SharePlatform.WHATSAPP) },
                )
                ShareIconButton(
                    icon = Icons.Default.Tag,
                    label = "Twitter",
                    color = Color(0xFF1DA1F2),
                    onClick = { onShareClick(SharePlatform.TWITTER) },
                )
                ShareIconButton(
                    icon = Icons.Default.Facebook,
                    label = "Facebook",
                    color = Color(0xFF4267B2),
                    onClick = { onShareClick(SharePlatform.FACEBOOK) },
                )
                ShareIconButton(
                    icon = Icons.Default.ContentCopy,
                    label = "Copy",
                    color = MaterialTheme.colorScheme.primary,
                    onClick = { onShareClick(SharePlatform.COPY_LINK) },
                )
                ShareIconButton(
                    icon = Icons.Default.Share,
                    label = "More",
                    color = MaterialTheme.colorScheme.secondary,
                    onClick = { onShareClick(SharePlatform.MORE) },
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ── Action Buttons ──────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    onClick = onReviewGame,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        Icons.Default.Replay,
                        null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Review")
                }

                Button(
                    onClick = onPlayAgain,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        Icons.Default.PlayArrow,
                        null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Play Again")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            TextButton(onClick = onDismiss) {
                Text("Dismiss")
            }
        }
    }
}

// ── Player Info Sub-Component ───────────────────────────────────────────

@Composable
private fun PlayerInfo(
    name: String,
    avatarUrl: String?,
    ratingBefore: Int,
    ratingAfter: Int,
    isWinner: Boolean,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.widthIn(max = 120.dp),
    ) {
        Box {
            if (avatarUrl != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(avatarUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = name,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape),
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = name.take(1).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            // Winner crown
            if (isWinner) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = "Winner",
                    tint = Color(0xFFDAA520),
                    modifier = Modifier
                        .size(20.dp)
                        .align(Alignment.TopEnd)
                        .offset(x = 4.dp, y = (-4).dp),
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )

        Text(
            text = "$ratingBefore",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

// ── Animated Rating Change ──────────────────────────────────────────────

@Composable
private fun AnimatedRatingChange(
    ratingBefore: Int,
    ratingAfter: Int,
) {
    val delta = ratingAfter - ratingBefore

    // Animate the displayed rating from before to after
    val animatedRating by animateIntAsState(
        targetValue = ratingAfter,
        animationSpec = tween(
            durationMillis = 1500,
            easing = FastOutSlowInEasing,
        ),
        label = "rating_counter",
    )

    val deltaColor = when {
        delta > 0 -> Color(0xFF4CAF50)
        delta < 0 -> Color(0xFFF44336)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    val deltaIcon = when {
        delta > 0 -> Icons.Default.TrendingUp
        delta < 0 -> Icons.Default.TrendingDown
        else -> Icons.Default.TrendingFlat
    }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Rating: ",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = "$animatedRating",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.width(12.dp))
            Icon(
                deltaIcon,
                contentDescription = null,
                tint = deltaColor,
                modifier = Modifier.size(24.dp),
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = when {
                    delta > 0 -> "+$delta"
                    else -> "$delta"
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = deltaColor,
            )
        }
    }
}

// ── Stat Chip ───────────────────────────────────────────────────────────

@Composable
private fun StatChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 11.sp,
        )
    }
}

// ── Share Icon Button ───────────────────────────────────────────────────

@Composable
private fun ShareIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
    onClick: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        IconButton(
            onClick = onClick,
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.1f)),
        ) {
            Icon(
                icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(20.dp),
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
