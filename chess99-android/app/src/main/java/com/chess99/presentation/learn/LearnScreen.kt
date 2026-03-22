package com.chess99.presentation.learn

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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Learn screen with Tutorial Hub and Training tabs.
 * Mirrors chess-frontend/src/pages/LearnPage.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnScreen(
    onNavigateBack: () -> Unit,
    onNavigateToLesson: (Int) -> Unit,
    onNavigateToPuzzles: () -> Unit = {},
    onNavigateToTrainingExercise: (String) -> Unit = {},
    viewModel: LearnViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Snackbar
    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    // Back from module detail
    if (state.selectedModuleSlug != null) {
        ModuleDetailSheet(
            lessons = state.selectedModuleLessons,
            isLoading = state.isLoadingModule,
            onNavigateToLesson = onNavigateToLesson,
            onDismiss = { viewModel.clearModuleDetail() },
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Learn") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            // Stats card
            StatsCard(stats = state.stats, streak = state.stats.streak)

            // Tabs
            TabRow(selectedTabIndex = state.selectedTab.ordinal) {
                Tab(
                    selected = state.selectedTab == LearnTab.TUTORIALS,
                    onClick = { viewModel.selectTab(LearnTab.TUTORIALS) },
                    text = { Text("Tutorials") },
                    icon = { Icon(Icons.Default.School, null, modifier = Modifier.size(18.dp)) },
                )
                Tab(
                    selected = state.selectedTab == LearnTab.TRAINING,
                    onClick = { viewModel.selectTab(LearnTab.TRAINING) },
                    text = { Text("Training") },
                    icon = { Icon(Icons.Default.FitnessCenter, null, modifier = Modifier.size(18.dp)) },
                )
            }

            // Content
            when {
                state.isLoading && state.modules.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                state.selectedTab == LearnTab.TUTORIALS -> TutorialsTab(
                    beginnerModules = state.beginnerModules,
                    intermediateModules = state.intermediateModules,
                    advancedModules = state.advancedModules,
                    onModuleTap = { viewModel.loadModuleDetail(it) },
                )
                state.selectedTab == LearnTab.TRAINING -> TrainingTab(
                    dailyChallenge = state.dailyChallenge,
                    achievements = state.achievements,
                    onNavigateToPuzzles = onNavigateToPuzzles,
                    onNavigateToTrainingExercise = onNavigateToTrainingExercise,
                )
            }
        }

        // Error dialog
        state.error?.let { error ->
            AlertDialog(
                onDismissRequest = { viewModel.clearError() },
                title = { Text("Error") },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text("OK") }
                },
            )
        }
    }
}

// ── Stats Card ─────────────────────────────────────────────────────────

@Composable
private fun StatsCard(stats: TutorialStats, streak: Int) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
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
            // Completed lessons
            StatItem(
                value = "${stats.completedLessons}/${stats.totalLessons}",
                label = "Lessons",
                icon = Icons.Default.CheckCircle,
            )

            VerticalDivider(
                modifier = Modifier.height(40.dp),
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
            )

            // XP
            StatItem(
                value = "${stats.xp}",
                label = "XP",
                icon = Icons.Default.Star,
            )

            VerticalDivider(
                modifier = Modifier.height(40.dp),
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
            )

            // Level
            StatItem(
                value = "Lv ${stats.level}",
                label = "Level",
                icon = Icons.Default.MilitaryTech,
            )

            if (streak > 0) {
                VerticalDivider(
                    modifier = Modifier.height(40.dp),
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                )
                StatItem(
                    value = "$streak",
                    label = "Streak",
                    icon = Icons.Default.LocalFireDepartment,
                )
            }
        }
    }
}

@Composable
private fun StatItem(
    value: String,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            icon,
            null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            value,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
        )
    }
}

// ── Tutorials Tab ──────────────────────────────────────────────────────

@Composable
private fun TutorialsTab(
    beginnerModules: List<TutorialModule>,
    intermediateModules: List<TutorialModule>,
    advancedModules: List<TutorialModule>,
    onModuleTap: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Beginner tier
        if (beginnerModules.isNotEmpty()) {
            item {
                TierHeader(
                    tier = "Beginner",
                    color = Color(0xFF4CAF50),
                    icon = Icons.Default.EmojiPeople,
                )
            }
            items(beginnerModules, key = { it.id }) { module ->
                ModuleCard(module = module, tierColor = Color(0xFF4CAF50), onTap = { onModuleTap(module.slug) })
            }
        }

        // Intermediate tier
        if (intermediateModules.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                TierHeader(
                    tier = "Intermediate",
                    color = Color(0xFFFFA726),
                    icon = Icons.Default.TrendingUp,
                )
            }
            items(intermediateModules, key = { it.id }) { module ->
                ModuleCard(module = module, tierColor = Color(0xFFFFA726), onTap = { onModuleTap(module.slug) })
            }
        }

        // Advanced tier
        if (advancedModules.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                TierHeader(
                    tier = "Advanced",
                    color = Color(0xFFEF5350),
                    icon = Icons.Default.Whatshot,
                )
            }
            items(advancedModules, key = { it.id }) { module ->
                ModuleCard(module = module, tierColor = Color(0xFFEF5350), onTap = { onModuleTap(module.slug) })
            }
        }

        // Empty state
        if (beginnerModules.isEmpty() && intermediateModules.isEmpty() && advancedModules.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.School,
                            null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "No tutorials available yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TierHeader(
    tier: String,
    color: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(22.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            tier,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = color,
        )
    }
}

@Composable
private fun ModuleCard(
    module: TutorialModule,
    tierColor: Color,
    onTap: () -> Unit,
) {
    ElevatedCard(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Module icon / placeholder
                Surface(
                    color = tierColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.MenuBook,
                            null,
                            tint = tierColor,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        module.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        module.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                // Completion indicator
                if (module.isComplete) {
                    Icon(
                        Icons.Default.CheckCircle,
                        "Completed",
                        tint = Color(0xFF4CAF50),
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Progress bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LinearProgressIndicator(
                    progress = { module.progress },
                    modifier = Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = tierColor,
                    trackColor = tierColor.copy(alpha = 0.15f),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "${module.completedLessons}/${module.lessonsCount}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Training Tab ───────────────────────────────────────────────────────

@Composable
private fun TrainingTab(
    dailyChallenge: DailyChallenge?,
    achievements: List<Achievement>,
    onNavigateToPuzzles: () -> Unit = {},
    onNavigateToTrainingExercise: (String) -> Unit = {},
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Daily challenge card
        item {
            Text(
                "Daily Challenge",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            if (dailyChallenge != null) {
                DailyChallengeCard(challenge = dailyChallenge)
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "No daily challenge available",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        // Achievements
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "Achievements",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        if (achievements.isEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Complete lessons to earn achievements",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        } else {
            items(achievements, key = { it.id }) { achievement ->
                AchievementCard(achievement = achievement)
            }
        }

        // Training exercises placeholder
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "Practice",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            PracticeCard(
                title = "Tactics Trainer",
                description = "Solve chess puzzles to sharpen your tactical vision",
                icon = Icons.Default.Extension,
                onClick = onNavigateToPuzzles,
            )
        }
        item {
            PracticeCard(
                title = "Endgame Drills",
                description = "Master essential endgame techniques",
                icon = Icons.Default.Flag,
                onClick = { onNavigateToTrainingExercise("endgame") },
            )
        }
        item {
            PracticeCard(
                title = "Opening Explorer",
                description = "Study popular opening lines and variations",
                icon = Icons.Default.AutoStories,
                onClick = { onNavigateToTrainingExercise("opening") },
            )
        }
    }
}

@Composable
private fun DailyChallengeCard(challenge: DailyChallenge) {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    color = if (challenge.isCompleted)
                        Color(0xFF4CAF50).copy(alpha = 0.12f)
                    else
                        MaterialTheme.colorScheme.tertiaryContainer,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            if (challenge.isCompleted) Icons.Default.CheckCircle else Icons.Default.Today,
                            null,
                            tint = if (challenge.isCompleted) Color(0xFF4CAF50) else MaterialTheme.colorScheme.onTertiaryContainer,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        challenge.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        challenge.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Difficulty badge
                val difficultyColor = when (challenge.difficulty) {
                    "easy" -> Color(0xFF4CAF50)
                    "medium" -> Color(0xFFFFA726)
                    "hard" -> Color(0xFFEF5350)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Surface(
                    color = difficultyColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        challenge.difficulty.replaceFirstChar { it.uppercase() },
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = difficultyColor,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                // XP reward
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Star,
                        null,
                        modifier = Modifier.size(14.dp),
                        tint = Color(0xFFFFC107),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "+${challenge.xpReward} XP",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            if (challenge.isCompleted) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "Completed",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

@Composable
private fun AchievementCard(achievement: Achievement) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = if (achievement.isUnlocked)
                    Color(0xFFFFC107).copy(alpha = 0.15f)
                else
                    MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        if (achievement.isUnlocked) Icons.Default.EmojiEvents else Icons.Default.Lock,
                        null,
                        tint = if (achievement.isUnlocked)
                            Color(0xFFFFC107)
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    achievement.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (achievement.isUnlocked)
                        MaterialTheme.colorScheme.onSurface
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    achievement.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun PracticeCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit = {},
) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.secondaryContainer,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.size(40.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        icon,
                        null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Icon(
                Icons.Default.ChevronRight,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// ── Module Detail Bottom Sheet ─────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ModuleDetailSheet(
    lessons: List<Lesson>,
    isLoading: Boolean,
    onNavigateToLesson: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
        ) {
            Text(
                "Lessons",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp),
            )

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else if (lessons.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "No lessons in this module yet",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                lessons.forEach { lesson ->
                    LessonRow(
                        lesson = lesson,
                        onTap = { onNavigateToLesson(lesson.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun LessonRow(
    lesson: Lesson,
    onTap: () -> Unit,
) {
    Surface(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Completion icon
            if (lesson.isCompleted) {
                Icon(
                    Icons.Default.CheckCircle,
                    "Completed",
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(24.dp),
                )
            } else {
                Icon(
                    Icons.Default.RadioButtonUnchecked,
                    "Not completed",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp),
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    lesson.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                if (lesson.description.isNotBlank()) {
                    Text(
                        lesson.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            // XP reward
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Star,
                    null,
                    modifier = Modifier.size(12.dp),
                    tint = Color(0xFFFFC107),
                )
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    "${lesson.xpReward}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp,
                )
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
}
