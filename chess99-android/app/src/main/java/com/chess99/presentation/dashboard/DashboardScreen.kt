package com.chess99.presentation.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage

/**
 * Full dashboard screen that serves as the primary landing surface.
 *
 * Sections (top to bottom):
 *   1. Welcome header (avatar + name)
 *   2. Rating card (current + peak + trend indicator)
 *   3. Quick stats row (Games, Win Rate, Streak)
 *   4. Quick action buttons
 *   5. Recent games (last 5 + "See All")
 *   6. Active tournaments
 *   7. Notifications (collapsible)
 *
 * Uses pull-to-refresh via Material 3 PullToRefreshBox.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToPlayComputer: () -> Unit,
    onNavigateToLobby: () -> Unit,
    onNavigateToLearn: () -> Unit,
    onNavigateToChampionships: () -> Unit,
    onNavigateToGameHistory: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    onNavigateToChampionship: (Int) -> Unit,
    onNavigateToReferrals: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val unfinishedGames by viewModel.unfinishedGames.collectAsStateWithLifecycle()

    // Unfinished game prompt
    val promptGame = unfinishedGames.firstOrNull()
    if (promptGame != null) {
        com.chess99.presentation.common.UnfinishedGamePrompt(
            opponentName = promptGame.opponentName,
            timeControl = promptGame.timeControl,
            gameId = promptGame.gameId,
            onResume = { onNavigateToGame(it) },
            onDiscard = { viewModel.dismissUnfinishedGame(it) },
            onDismiss = { /* keep showing until user acts */ },
        )
    }

    PullToRefreshBox(
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refreshDashboard() },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Loading / Error ──────────────────────────────────────
            if (uiState.isLoading && uiState.stats == null) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                return@LazyColumn
            }

            uiState.error?.let { errorMsg ->
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = errorMsg,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = { viewModel.clearError() }) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Dismiss",
                                    tint = MaterialTheme.colorScheme.onErrorContainer,
                                )
                            }
                        }
                    }
                }
            }

            // ── 1. Welcome Header ────────────────────────────────────
            item {
                WelcomeHeader(
                    userName = uiState.userName,
                    avatarUrl = uiState.userAvatarUrl,
                )
            }

            // ── 2. Rating Card ───────────────────────────────────────
            item {
                RatingCard(
                    currentRating = uiState.stats?.rating ?: uiState.userRating,
                    peakRating = uiState.stats?.peakRating ?: uiState.userPeakRating,
                )
            }

            // ── 3. Quick Stats Row ───────────────────────────────────
            uiState.stats?.let { stats ->
                item {
                    QuickStatsRow(stats = stats)
                }
            }

            // ── 4. Quick Actions ─────────────────────────────────────
            item {
                QuickActionsSection(
                    onPlayComputer = onNavigateToPlayComputer,
                    onPlayOnline = onNavigateToLobby,
                    onLearn = onNavigateToLearn,
                    onTournaments = onNavigateToChampionships,
                )
            }

            // ── 5. Recent Games ──────────────────────────────────────
            if (uiState.recentGames.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Recent Games",
                        actionLabel = "See All",
                        onAction = onNavigateToGameHistory,
                    )
                }

                items(
                    items = uiState.recentGames,
                    key = { it.id },
                ) { game ->
                    RecentGameCard(
                        game = game,
                        onClick = { onNavigateToGame(game.id) },
                    )
                }
            }

            // ── 6. Active Tournaments ────────────────────────────────
            if (uiState.activeTournaments.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Active Tournaments",
                        actionLabel = "View All",
                        onAction = onNavigateToChampionships,
                    )
                }

                items(
                    items = uiState.activeTournaments,
                    key = { it.id },
                ) { tournament ->
                    TournamentCard(
                        tournament = tournament,
                        onClick = { onNavigateToChampionship(tournament.id) },
                    )
                }
            }

            // ── 7. Notifications ─────────────────────────────────────
            if (uiState.notifications.isNotEmpty()) {
                item {
                    NotificationsSection(
                        notifications = uiState.notifications,
                        onMarkRead = { viewModel.markNotificationRead(it) },
                        onDismiss = { viewModel.dismissNotification(it) },
                    )
                }
            }
        }
    }
}

// ── Composable Components ────────────────────────────────────────────────────

@Composable
private fun WelcomeHeader(
    userName: String,
    avatarUrl: String?,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (avatarUrl != null) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = "Avatar",
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            Surface(
                modifier = Modifier.size(56.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column {
            Text(
                text = "Welcome back,",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = userName.ifEmpty { "Player" },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun RatingCard(
    currentRating: Int,
    peakRating: Int,
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
        ) {
            Text(
                text = "Rating",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    text = currentRating.toString(),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "Peak",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.TrendingUp,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.secondary,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = peakRating.toString(),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.secondary,
                        )
                    }
                }
            }

            if (currentRating >= peakRating) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.tertiaryContainer,
                ) {
                    Text(
                        text = "All-time high!",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer,
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickStatsRow(stats: DashboardStats) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StatMiniCard(
            modifier = Modifier.weight(1f),
            label = "Games",
            value = stats.gamesPlayed.toString(),
            icon = Icons.Default.SportsEsports,
        )
        StatMiniCard(
            modifier = Modifier.weight(1f),
            label = "Win Rate",
            value = "${String.format("%.0f", stats.winRate)}%",
            icon = Icons.Default.EmojiEvents,
        )
        StatMiniCard(
            modifier = Modifier.weight(1f),
            label = "Streak",
            value = when {
                stats.currentStreak > 0 -> "+${stats.currentStreak}"
                stats.currentStreak < 0 -> "${stats.currentStreak}"
                else -> "0"
            },
            icon = Icons.Default.LocalFireDepartment,
        )
    }
}

@Composable
private fun StatMiniCard(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    OutlinedCard(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun QuickActionsSection(
    onPlayComputer: () -> Unit,
    onPlayOnline: () -> Unit,
    onLearn: () -> Unit,
    onTournaments: () -> Unit,
) {
    Column {
        Text(
            text = "Quick Actions",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            QuickActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Computer,
                label = "Computer",
                onClick = onPlayComputer,
            )
            QuickActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Wifi,
                label = "Online",
                onClick = onPlayOnline,
            )
            QuickActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.School,
                label = "Learn",
                onClick = onLearn,
            )
            QuickActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.EmojiEvents,
                label = "Tournaments",
                onClick = onTournaments,
            )
        }
    }
}

@Composable
private fun QuickActionButton(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.height(72.dp),
        shape = MaterialTheme.shapes.medium,
        contentPadding = PaddingValues(4.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        TextButton(onClick = onAction) {
            Text(text = actionLabel)
            Spacer(modifier = Modifier.width(4.dp))
            Icon(
                Icons.Default.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun RecentGameCard(
    game: RecentGame,
    onClick: () -> Unit,
) {
    val isWin = game.result.lowercase().contains("win") ||
        game.result.lowercase().contains("won")
    val isLoss = game.result.lowercase().contains("loss") ||
        game.result.lowercase().contains("lost")

    val resultColor = when {
        isWin -> MaterialTheme.colorScheme.primary
        isLoss -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val resultLabel = when {
        isWin -> "Win"
        isLoss -> "Loss"
        else -> "Draw"
    }

    OutlinedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Result indicator
            Surface(
                shape = CircleShape,
                color = resultColor.copy(alpha = 0.15f),
                modifier = Modifier.size(40.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = resultLabel.first().toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = resultColor,
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "vs ${game.opponent}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "${game.timeControl} - $resultLabel",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Rating change
            if (game.ratingChange != 0) {
                val changeColor = if (game.ratingChange > 0) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                }
                Text(
                    text = if (game.ratingChange > 0) "+${game.ratingChange}"
                    else "${game.ratingChange}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = changeColor,
                )
            }
        }
    }
}

@Composable
private fun TournamentCard(
    tournament: ActiveTournament,
    onClick: () -> Unit,
) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.EmojiEvents,
                contentDescription = null,
                modifier = Modifier.size(36.dp),
                tint = MaterialTheme.colorScheme.secondary,
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tournament.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = buildString {
                        append(tournament.format.replaceFirstChar { it.uppercase() })
                        if (tournament.totalRounds > 0) {
                            append(" - Round ${tournament.currentRound}/${tournament.totalRounds}")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.secondaryContainer,
            ) {
                Text(
                    text = "${tournament.playerCount} players",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
        }
    }
}

@Composable
private fun NotificationsSection(
    notifications: List<DashboardNotification>,
    onMarkRead: (String) -> Unit,
    onDismiss: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val unreadCount = notifications.count { !it.isRead }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Notifications",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                if (unreadCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Badge {
                        Text(unreadCount.toString())
                    }
                }
            }
            IconButton(onClick = { expanded = !expanded }) {
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                )
            }
        }

        if (expanded) {
            notifications.forEach { notification ->
                NotificationItem(
                    notification = notification,
                    onMarkRead = { onMarkRead(notification.id) },
                    onDismiss = { onDismiss(notification.id) },
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

@Composable
private fun NotificationItem(
    notification: DashboardNotification,
    onMarkRead: () -> Unit,
    onDismiss: () -> Unit,
) {
    val containerColor = if (notification.isRead) {
        MaterialTheme.colorScheme.surface
    } else {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = containerColor),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            val icon = when (notification.type) {
                "game" -> Icons.Default.SportsEsports
                "tournament" -> Icons.Default.EmojiEvents
                "social" -> Icons.Default.People
                else -> Icons.Default.Notifications
            }
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary,
            )

            Spacer(modifier = Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.SemiBold,
                )
                Text(
                    text = notification.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            IconButton(
                onClick = {
                    if (!notification.isRead) onMarkRead() else onDismiss()
                },
                modifier = Modifier.size(24.dp),
            ) {
                Icon(
                    if (notification.isRead) Icons.Default.Close else Icons.Default.MarkEmailRead,
                    contentDescription = if (notification.isRead) "Dismiss" else "Mark read",
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}
