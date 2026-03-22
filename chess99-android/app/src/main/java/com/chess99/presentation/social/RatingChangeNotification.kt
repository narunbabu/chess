package com.chess99.presentation.social

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Temporary notification banner that shows rating changes after a game.
 * Auto-dismisses after 3 seconds with animated number counter.
 *
 * Mirrors the rating change toast from chess-frontend/src/components/play/GameContainer.js
 */
@Composable
fun RatingChangeNotification(
    oldRating: Int,
    newRating: Int,
    onDismiss: () -> Unit,
) {
    val delta = newRating - oldRating
    var visible by remember { mutableStateOf(true) }

    // Auto-dismiss after 3 seconds
    LaunchedEffect(Unit) {
        delay(3000)
        visible = false
        delay(300) // Wait for exit animation
        onDismiss()
    }

    // Animate the displayed rating from old to new
    val animatedRating by animateIntAsState(
        targetValue = if (visible) newRating else oldRating,
        animationSpec = tween(
            durationMillis = 1200,
            easing = FastOutSlowInEasing,
        ),
        label = "rating_notification_counter",
    )

    val isIncrease = delta > 0
    val deltaColor = when {
        delta > 0 -> Color(0xFF4CAF50)
        delta < 0 -> Color(0xFFF44336)
        else -> Color(0xFFFF9800)
    }

    val backgroundColor = when {
        delta > 0 -> Color(0xFF4CAF50).copy(alpha = 0.1f)
        delta < 0 -> Color(0xFFF44336).copy(alpha = 0.1f)
        else -> Color(0xFFFF9800).copy(alpha = 0.1f)
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(
            animationSpec = tween(300),
        ),
        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(
            animationSpec = tween(300),
        ),
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            shape = RoundedCornerShape(12.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(backgroundColor)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Rating icon
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(deltaColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = if (isIncrease) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                        contentDescription = null,
                        tint = deltaColor,
                        modifier = Modifier.size(24.dp),
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Rating info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Rating Updated",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Animated rating counter
                        AnimatedContent(
                            targetState = animatedRating,
                            transitionSpec = {
                                if (targetState > initialState) {
                                    // Count up
                                    slideInVertically { -it } + fadeIn() togetherWith
                                            slideOutVertically { it } + fadeOut()
                                } else {
                                    // Count down
                                    slideInVertically { it } + fadeIn() togetherWith
                                            slideOutVertically { -it } + fadeOut()
                                }.using(SizeTransform(clip = false))
                            },
                            label = "rating_anim",
                        ) { rating ->
                            Text(
                                text = "$rating",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium,
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        // Delta badge
                        val deltaText = when {
                            delta > 0 -> "+$delta"
                            else -> "$delta"
                        }

                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = deltaColor.copy(alpha = 0.15f),
                        ) {
                            Text(
                                text = deltaText,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = deltaColor,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }

                // Dismiss button
                IconButton(
                    onClick = {
                        visible = false
                        onDismiss()
                    },
                    modifier = Modifier.size(32.dp),
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Dismiss",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
