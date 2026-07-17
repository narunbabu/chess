package com.chess99.presentation.daily

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Daily Challenges hub — mirrors the web /daily-challenges page: selectable tracks
 * (starter/improvement/endgame/master, tier-gated), today's challenge, streak, and
 * the daily leaderboard. Solving routes into the existing puzzle solver.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DailyChallengesScreen(
    onNavigateBack: () -> Unit,
    onSolve: () -> Unit,
    viewModel: DailyChallengesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Daily Challenges", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Streak banner
            if (state.streak > 0) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.LocalFireDepartment,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "${state.streak}-day streak",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            // Track selector
            if (state.tracks.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    state.tracks.forEach { track ->
                        FilterChip(
                            selected = track.slug == state.selectedTrack,
                            onClick = { viewModel.selectTrack(track.slug) },
                            label = { Text(track.label) },
                            leadingIcon = if (track.isLocked) {
                                {
                                    Icon(
                                        Icons.Default.Lock,
                                        contentDescription = "Locked",
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            } else {
                                null
                            },
                        )
                    }
                }
            }

            if (state.isLocked) {
                // Tier-gated track. No upgrade CTA — the app has no purchase
                // flow (Play policy); premium unlocks follow the account plan.
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Default.WorkspacePremium,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "This track is part of ${
                                state.requiredTier?.replaceFirstChar { it.uppercase() } ?: "a premium"
                            }",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "This daily challenge track is available on premium plans.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            } else {
                // Today's challenge
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                state.challenge?.title ?: "Today's Challenge",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            if (state.challenge?.isCompleted == true) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    contentDescription = "Completed",
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            state.challenge?.description ?: "Solve today's puzzle to keep your streak alive.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(8.dp))
                        state.challenge?.let { c ->
                            AssistChip(
                                onClick = {},
                                label = { Text("${c.difficulty.replaceFirstChar { it.uppercase() }} • +${c.xpReward} XP") },
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = onSolve,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state.challenge?.isCompleted != true,
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(if (state.challenge?.isCompleted == true) "Completed Today" else "Solve Today's Challenge")
                        }
                    }
                }
            }

            // Daily leaderboard
            if (state.leaders.isNotEmpty()) {
                Text("Leaderboard", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column {
                        state.leaders.forEach { l ->
                            ListItem(
                                leadingContent = { Text("#${l.rank}", fontWeight = FontWeight.Bold) },
                                headlineContent = { Text(l.name) },
                                trailingContent = { Text(l.score) },
                            )
                        }
                    }
                }
            }

            if (state.isLoading) {
                Box(Modifier.fillMaxWidth(), Alignment.Center) { CircularProgressIndicator() }
            }
        }
    }
}
