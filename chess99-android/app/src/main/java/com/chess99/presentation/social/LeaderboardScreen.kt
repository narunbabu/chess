package com.chess99.presentation.social

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest

/**
 * Leaderboard screen with 4 category tabs and 4 period filters.
 * Categories: Most Games, Most Wins, Highest Points, By Rating.
 * Periods: Today, 7 Days, 30 Days, All Time.
 *
 * Mirrors chess-frontend/src/pages/LeaderboardPage.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardScreen(
    onNavigateBack: () -> Unit,
    viewModel: LeaderboardViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Leaderboard") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // ── Category Tabs (Most Games, Most Wins, Highest Points, By Rating) ──
            ScrollableTabRow(
                selectedTabIndex = state.selectedCategory.ordinal,
                edgePadding = 8.dp,
            ) {
                LeaderboardCategory.entries.forEach { category ->
                    Tab(
                        selected = state.selectedCategory == category,
                        onClick = { viewModel.selectCategory(category) },
                        text = { Text(category.displayName, fontSize = 13.sp) },
                        icon = {
                            Icon(
                                imageVector = when (category) {
                                    LeaderboardCategory.MOST_GAMES -> Icons.Default.SportsEsports
                                    LeaderboardCategory.MOST_WINS -> Icons.Default.EmojiEvents
                                    LeaderboardCategory.HIGHEST_POINTS -> Icons.Default.Star
                                    LeaderboardCategory.BY_RATING -> Icons.Default.Leaderboard
                                },
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                            )
                        },
                    )
                }
            }

            // ── Period Filter ─────────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val isRatingCategory = state.selectedCategory == LeaderboardCategory.BY_RATING
                LeaderboardPeriod.entries.forEach { period ->
                    FilterChip(
                        selected = state.selectedPeriod == period,
                        onClick = {
                            if (!isRatingCategory) {
                                viewModel.selectPeriod(period)
                            }
                        },
                        label = { Text(period.displayName, fontSize = 12.sp) },
                        enabled = !isRatingCategory,
                    )
                }
            }

            // ── Content ───────────────────────────────────────────────────────
            when {
                state.isLoading && state.currentEntries.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }

                state.error != null && state.currentEntries.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = state.error ?: "Unknown error",
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            OutlinedButton(onClick = { viewModel.loadLeaderboard() }) {
                                Text("Retry")
                            }
                        }
                    }
                }

                state.currentEntries.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.SportsEsports,
                                null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = when (state.selectedPeriod) {
                                    LeaderboardPeriod.TODAY -> "No games today. Be the first!"
                                    LeaderboardPeriod.SEVEN_DAYS -> "No games this week yet."
                                    LeaderboardPeriod.THIRTY_DAYS -> "No games this month yet."
                                    LeaderboardPeriod.ALL_TIME -> "No leaderboard data available."
                                },
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 32.dp),
                            )
                        }
                    }
                }

                else -> {
                    PullToRefreshBox(
                        isRefreshing = state.isRefreshing,
                        onRefresh = { viewModel.refresh() },
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 16.dp),
                        ) {
                            // Top 3 Podium
                            if (state.currentEntries.size >= 3) {
                                item {
                                    PodiumSection(
                                        top3 = state.currentEntries.take(3),
                                        category = state.selectedCategory,
                                        onShare = { entry ->
                                            viewModel.sharePlayer(entry, state.selectedCategory)
                                        },
                                    )
                                }
                            }

                            // Remaining entries (4+)
                            val remainingEntries = if (state.currentEntries.size >= 3) {
                                state.currentEntries.drop(3)
                            } else {
                                state.currentEntries
                            }

                            items(remainingEntries, key = { it.userId }) { entry ->
                                LeaderboardRow(
                                    entry = entry,
                                    category = state.selectedCategory,
                                    onShare = {
                                        viewModel.sharePlayer(entry, state.selectedCategory)
                                    },
                                )
                            }

                            // Invite Banner
                            item {
                                InviteBanner(onShare = { viewModel.shareInvite() })
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Podium Section (Top 3) ──────────────────────────────────────────────

@Composable
private fun PodiumSection(
    top3: List<LeaderboardEntry>,
    category: LeaderboardCategory,
    onShare: (LeaderboardEntry) -> Unit,
) {
    val gold = Color(0xFFFFD700)
    val silver = Color(0xFFC0C0C0)
    val bronze = Color(0xFFCD7F32)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Podium arrangement: 2nd | 1st | 3rd
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Bottom,
        ) {
            // 2nd place
            if (top3.size > 1) {
                PodiumEntry(
                    entry = top3[1],
                    medalColor = silver,
                    podiumHeight = 80.dp,
                    rank = 2,
                    category = category,
                    onShare = onShare,
                    modifier = Modifier.weight(1f),
                )
            }

            // 1st place (tallest)
            PodiumEntry(
                entry = top3[0],
                medalColor = gold,
                podiumHeight = 100.dp,
                rank = 1,
                category = category,
                onShare = onShare,
                modifier = Modifier.weight(1f),
            )

            // 3rd place
            if (top3.size > 2) {
                PodiumEntry(
                    entry = top3[2],
                    medalColor = bronze,
                    podiumHeight = 60.dp,
                    rank = 3,
                    category = category,
                    onShare = onShare,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp))
    }
}

@Composable
private fun PodiumEntry(
    entry: LeaderboardEntry,
    medalColor: Color,
    podiumHeight: androidx.compose.ui.unit.Dp,
    rank: Int,
    category: LeaderboardCategory,
    onShare: (LeaderboardEntry) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .padding(horizontal = 4.dp)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Avatar with medal
        Box {
            if (entry.avatarUrl != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(entry.avatarUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = entry.name,
                    modifier = Modifier
                        .size(if (rank == 1) 56.dp else 44.dp)
                        .clip(CircleShape)
                        .border(2.dp, medalColor, CircleShape),
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(if (rank == 1) 56.dp else 44.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .border(2.dp, medalColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = entry.name.take(1).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            // Rank badge
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(medalColor)
                    .align(Alignment.BottomEnd),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "$rank",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Name
        Text(
            text = entry.name,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )

        // Value (games/wins/points/rating)
        Text(
            text = LeaderboardViewModel.formatValue(entry.value, category),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = medalColor,
        )

        // Value label
        Text(
            text = category.valueLabel,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 10.sp,
        )

        // Rating (show if not "By Rating" category)
        if (category != LeaderboardCategory.BY_RATING) {
            Text(
                text = "${entry.rating} rated",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 10.sp,
            )
        }

        // Podium bar
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(podiumHeight)
                .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                .background(medalColor.copy(alpha = 0.2f)),
        )
    }
}

// ── Leaderboard Row (Rank 4+) ───────────────────────────────────────────

@Composable
private fun LeaderboardRow(
    entry: LeaderboardEntry,
    category: LeaderboardCategory,
    onShare: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 3.dp),
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Rank
            Text(
                text = "#${entry.rank}",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.width(40.dp),
            )

            // Avatar
            if (entry.avatarUrl != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(entry.avatarUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = entry.name,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape),
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = entry.name.take(1).uppercase(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Name + rating
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (category != LeaderboardCategory.BY_RATING) {
                    Text(
                        text = "${entry.rating} rated",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp,
                    )
                }
            }

            // Value based on category
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = LeaderboardViewModel.formatValue(entry.value, category),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = category.valueLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                )
            }

            // Share button
            IconButton(
                onClick = onShare,
                modifier = Modifier.size(32.dp),
            ) {
                Icon(
                    Icons.Default.Share,
                    contentDescription = "Share",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Invite Banner ────────────────────────────────────────────────────────

@Composable
private fun InviteBanner(onShare: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF81b64c).copy(alpha = 0.15f),
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Challenge your friends!",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Invite friends to Chess99 and see who climbs the leaderboard faster.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = onShare,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF81b64c),
                ),
            ) {
                Icon(Icons.Default.Share, null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Invite")
            }
        }
    }
}
