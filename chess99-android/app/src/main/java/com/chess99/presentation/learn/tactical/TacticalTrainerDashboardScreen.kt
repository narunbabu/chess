package com.chess99.presentation.learn.tactical

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TacticalTrainerDashboardScreen(
    onNavigateBack: () -> Unit,
    onNavigateToStage: (Int) -> Unit,
    viewModel: TacticalTrainerViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    when (state.phase) {
        TacticalScreenPhase.DASHBOARD -> DashboardContent(
            state = state,
            onNavigateBack = onNavigateBack,
            onSelectStage = { viewModel.selectStage(it); onNavigateToStage(it) },
            onDismissError = { viewModel.clearError() },
        )
        TacticalScreenPhase.PUZZLE -> TacticalPuzzleContent(
            state = state,
            onAttemptMove = { from, to, promo -> viewModel.attemptMove(from, to, promo) },
            onNextPuzzle = { viewModel.nextPuzzle() },
            onShowSolution = { viewModel.showSolution() },
            onBackToDashboard = { viewModel.backToDashboard() },
        )
        TacticalScreenPhase.SOLUTION_VIEWER -> SolutionViewerContent(
            state = state,
            onNavigateSolution = { viewModel.navigateSolution(it) },
            onNextPuzzle = { viewModel.nextPuzzle() },
            onBackToDashboard = { viewModel.backToDashboard() },
        )
        TacticalScreenPhase.STAGE_COMPLETE -> StageCompleteContent(
            state = state,
            onBackToDashboard = { viewModel.backToDashboard() },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DashboardContent(
    state: TacticalTrainerUiState,
    onNavigateBack: () -> Unit,
    onSelectStage: (Int) -> Unit,
    onDismissError: () -> Unit,
) {
    val progress = state.progress
    val overallAccuracy = if (progress.totalAttempted > 0)
        (progress.totalSolved * 100 / progress.totalAttempted) else 0
    val totalPuzzlesAcrossStages = TacticalStages.stages.sumOf { it.puzzleCount }
    val totalSolvedAcrossStages = progress.stageProgress.values.sumOf { it.solved }
    val overallProgressPct = if (totalPuzzlesAcrossStages > 0)
        totalSolvedAcrossStages.toFloat() / totalPuzzlesAcrossStages else 0f

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tactical Trainer") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Stats card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                ) {
                    Row(
                        modifier = Modifier
                            .padding(16.dp)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatBadge(
                            value = "${progress.rating}",
                            label = "Rating",
                            icon = Icons.Default.EmojiEvents,
                        )
                        VerticalDivider(modifier = Modifier.height(40.dp), color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
                        StatBadge(
                            value = "${progress.totalSolved}",
                            label = "Solved",
                            icon = Icons.Default.CheckCircle,
                        )
                        VerticalDivider(modifier = Modifier.height(40.dp), color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
                        StatBadge(
                            value = "$overallAccuracy%",
                            label = "Accuracy",
                            icon = if (overallAccuracy >= 70) Icons.Default.ThumbUp else Icons.Default.Info,
                        )
                        VerticalDivider(modifier = Modifier.height(40.dp), color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
                        StatBadge(
                            value = "${progress.streak}",
                            label = "Streak",
                            icon = Icons.Default.LocalFireDepartment,
                        )
                    }
                }
            }

            // Overall progress bar
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                "Overall Progress",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "$totalSolvedAcrossStages / $totalPuzzlesAcrossStages puzzles",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { overallProgressPct },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = Color(0xFF81B64C),
                            trackColor = Color(0xFF81B64C).copy(alpha = 0.15f),
                        )
                        if (progress.peakRating > 1000) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                "Peak rating: ${progress.peakRating} · Best streak: ${progress.bestStreak}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // Badges (if any unlocked)
            val unlockedBadges = progress.badges.filter { it.isUnlocked }
            if (unlockedBadges.isNotEmpty()) {
                item {
                    Text(
                        "Badges",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        unlockedBadges.take(6).forEach { badge ->
                            BadgeChip(badge = badge)
                        }
                        if (unlockedBadges.size > 6) {
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text(
                                    "+${unlockedBadges.size - 6}",
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }
                    }
                }
            }

            // Stage cards
            item {
                Text(
                    "Stages",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp, bottom = 4.dp),
                )
            }

            items(TacticalStages.stages, key = { it.id }) { stage ->
                val sp = progress.stageProgress[stage.id]
                val isUnlocked = sp?.unlocked ?: (stage.id == 0)
                val solved = sp?.solved ?: 0
                val attempted = sp?.attempted ?: 0
                val accuracy = if (attempted > 0) solved * 100 / attempted else null
                val progressPct = if (stage.puzzleCount > 0) solved.toFloat() / stage.puzzleCount else 0f
                val stageColor = Color(stage.colorHex)

                StageCard(
                    stage = stage,
                    isUnlocked = isUnlocked,
                    solved = solved,
                    attempted = attempted,
                    accuracy = accuracy,
                    progress = progressPct,
                    stageColor = stageColor,
                    onClick = { if (isUnlocked) onSelectStage(stage.id) },
                )
            }
        }
    }

    // Error dialog
    state.errorMessage?.let { error ->
        AlertDialog(
            onDismissRequest = onDismissError,
            title = { Text("Error") },
            text = { Text(error) },
            confirmButton = {
                TextButton(onClick = onDismissError) { Text("OK") }
            },
        )
    }
}

@Composable
private fun StatBadge(
    value: String,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
    }
}

@Composable
private fun BadgeChip(badge: TacticalBadge) {
    val tierColor = when (badge.tier) {
        "gold" -> Color(0xFFFFC107)
        "platinum" -> Color(0xFF5B8DD9)
        "silver" -> Color(0xFF9E9E9E)
        else -> Color(0xFFCD7F32) // bronze
    }
    Surface(
        color = tierColor.copy(alpha = 0.12f),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(
                Icons.Default.EmojiEvents,
                null,
                modifier = Modifier.size(14.dp),
                tint = tierColor,
            )
            Text(
                badge.name,
                style = MaterialTheme.typography.labelSmall,
                color = tierColor,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun StageCard(
    stage: TacticalStage,
    isUnlocked: Boolean,
    solved: Int,
    attempted: Int,
    accuracy: Int?,
    progress: Float,
    stageColor: Color,
    onClick: () -> Unit,
) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    color = if (isUnlocked) stageColor.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(44.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (isUnlocked) {
                            Text(
                                stage.icon,
                                fontSize = 22.sp,
                            )
                        } else {
                            Icon(
                                Icons.Default.Lock,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(24.dp),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stage.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isUnlocked) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        stage.eloRange,
                        style = MaterialTheme.typography.labelSmall,
                        color = stageColor,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        stage.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                if (isUnlocked) {
                    Column(horizontalAlignment = Alignment.End) {
                        if (accuracy != null) {
                            Text(
                                "$accuracy% acc",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (accuracy >= 70) Color(0xFF81B64C) else Color(0xFFFFA726),
                                fontWeight = FontWeight.Bold,
                            )
                        } else {
                            Text(
                                "Not started",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            )
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            if (isUnlocked) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier
                            .weight(1f)
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = stageColor,
                        trackColor = stageColor.copy(alpha = 0.15f),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "$solved/${stage.puzzleCount}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (stage.themes.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        stage.themes.take(3).forEach { theme ->
                            Surface(
                                color = stageColor.copy(alpha = 0.1f),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text(
                                    theme,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = stageColor,
                                    fontSize = 10.sp,
                                )
                            }
                        }
                    }
                }

                // Unlock hint for next stage
                val nextStage = TacticalStages.stages.find { it.id == stage.id + 1 }
                if (nextStage != null && solved < nextStage.unlockAfter && solved > 0) {
                    val remaining = nextStage.unlockAfter - solved
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(
                            "Solve $remaining more to unlock ${nextStage.title}",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(8.dp))
                val prevStage = TacticalStages.stages.find { it.id == stage.id - 1 }
                val required = prevStage?.unlockAfter ?: 0
                Text(
                    "Solve $required puzzles in previous stage to unlock",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StageCompleteContent(
    state: TacticalTrainerUiState,
    onBackToDashboard: () -> Unit,
) {
    val stage = state.currentStage ?: return
    val stageColor = Color(stage.colorHex)
    val solved = state.progress.stageProgress[stage.id]?.solved ?: 0

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Stage Complete!") },
                navigationIcon = {
                    IconButton(onClick = onBackToDashboard) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 32.dp),
            ) {
                Text(stage.icon, fontSize = 64.sp)
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    "Stage Complete!",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    "You've completed all ${state.puzzleCount} puzzles in",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    stage.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = stageColor,
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Stats
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier
                            .padding(16.dp)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$solved", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                            Text("Solved", style = MaterialTheme.typography.labelSmall)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${state.progress.rating}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                            Text("Rating", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Check if next stage is unlocked
                val nextStage = TacticalStages.stages.find { it.id == stage.id + 1 }
                val nextUnlocked = state.progress.stageProgress[stage.id + 1]?.unlocked ?: false

                if (nextStage != null && nextUnlocked) {
                    Text(
                        "${nextStage.icon} ${nextStage.title} is now unlocked!",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF81B64C),
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                Button(
                    onClick = onBackToDashboard,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.Dashboard, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Back to Stages")
                }
            }
        }
    }
}
