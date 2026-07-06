package com.chess99.presentation.parent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

private val ChessGreen = Color(0xFF81B64C)
private val AccentAmber = Color(0xFFE8A93E)
private val LossRed = Color(0xFFE05B5B)

/**
 * Parent dashboard / "My Kids" screen.
 * Mirrors chess-frontend/src/pages/MyKidsPage.js — link a child, view weekly report
 * cards (rating, W/L/D, puzzles, lessons, learning time, recent games), email the
 * report card, and manage the child's display name / password.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyKidsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToGame: (Int) -> Unit = {},
    viewModel: MyKidsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    var childEmail by remember { mutableStateOf("") }
    var relationshipLabel by remember { mutableStateOf("") }
    var managing by remember { mutableStateOf<ChildReport?>(null) }

    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    managing?.let { child ->
        ManageChildDialog(
            child = child,
            isManaging = state.isManaging,
            error = state.manageError,
            success = state.manageSuccess,
            onSave = { name, password -> viewModel.updateChildProfile(child.relationshipId, name, password) },
            onDismiss = {
                managing = null
                viewModel.clearManageState()
            },
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("My Kids") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.loadDashboard(refresh = true) },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    item {
                        Text(
                            "Track your child's chess progress — ratings, puzzles, lessons and recent " +
                                "games — and get a weekly report card by email.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    // Guardian requests addressed to me (I was invited as a child)
                    if (state.guardianRequests.isNotEmpty()) {
                        items(state.guardianRequests) { req ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = AccentAmber.copy(alpha = 0.12f),
                                ),
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${req.displayName} wants to be your guardian.", fontWeight = FontWeight.Medium)
                                        Text(
                                            "They'll be able to see your progress reports.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    TextButton(onClick = { viewModel.revokeLink(req.id) }) { Text("Decline") }
                                    Button(
                                        onClick = { viewModel.acceptGuardian(req.id) },
                                        enabled = state.busyRelationshipId != req.id,
                                    ) { Text("Accept") }
                                }
                            }
                        }
                    }

                    // Link a child
                    item {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Link a child account", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(8.dp))
                                state.linkError?.let {
                                    Text(it, color = LossRed, style = MaterialTheme.typography.bodySmall)
                                    Spacer(Modifier.height(6.dp))
                                }
                                state.linkNotice?.let {
                                    Text(it, color = ChessGreen, style = MaterialTheme.typography.bodySmall)
                                    Spacer(Modifier.height(6.dp))
                                }
                                OutlinedTextField(
                                    value = childEmail,
                                    onValueChange = {
                                        childEmail = it
                                        if (state.linkError != null || state.linkNotice != null) viewModel.clearLinkNotice()
                                    },
                                    label = { Text("Child's Chess99 account email") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                Spacer(Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = relationshipLabel,
                                    onValueChange = { relationshipLabel = it },
                                    label = { Text("Relationship (optional)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                Spacer(Modifier.height(12.dp))
                                Button(
                                    onClick = {
                                        viewModel.linkChild(childEmail, relationshipLabel)
                                        childEmail = ""
                                        relationshipLabel = ""
                                    },
                                    enabled = !state.isLinking && childEmail.isNotBlank(),
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    if (state.isLinking) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    } else {
                                        Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Send invite")
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    "Your child must already have a Chess99 account and approve the link " +
                                        "from their own account.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    // Pending children (invited, not yet accepted)
                    if (state.pendingChildren.isNotEmpty()) {
                        item {
                            Text("Awaiting confirmation", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        }
                        items(state.pendingChildren) { pending ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 14.dp, end = 6.dp, top = 4.dp, bottom = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "${pending.displayName} — invitation pending",
                                        modifier = Modifier.weight(1f),
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                    TextButton(
                                        onClick = { viewModel.revokeLink(pending.id) },
                                        enabled = state.busyRelationshipId != pending.id,
                                    ) { Text("Cancel") }
                                }
                            }
                        }
                    }

                    // Active children
                    if (state.children.isNotEmpty()) {
                        items(state.children) { report ->
                            ChildReportCard(
                                report = report,
                                isEmailing = state.emailingRelationshipId == report.relationshipId,
                                onEmailReport = { viewModel.emailReport(report.relationshipId) },
                                onManage = { managing = report },
                                onOpenGame = onNavigateToGame,
                            )
                        }
                    } else if (state.pendingChildren.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        Icons.Default.FamilyRestroom,
                                        contentDescription = null,
                                        modifier = Modifier.size(48.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        "No linked children yet. Add your child's account email above " +
                                            "to start tracking their progress.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center,
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
private fun ChildReportCard(
    report: ChildReport,
    isEmailing: Boolean,
    onEmailReport: () -> Unit,
    onManage: () -> Unit,
    onOpenGame: (Int) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(ChessGreen.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Face, contentDescription = null, tint = ChessGreen)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(report.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(
                        report.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("${report.rating}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text("Rating", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(Modifier.height(14.dp))
            Text("This week", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))

            // Week stats row
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                MiniStat("Games", "${report.weekGames}", Modifier.weight(1f))
                MiniStat("W/L/D", report.weekResults, Modifier.weight(1f))
                MiniStat("Puzzles", "${report.weekPuzzlesSolved}", Modifier.weight(1f), ChessGreen)
                MiniStat("Lessons", "${report.weekLessons}", Modifier.weight(1f), AccentAmber)
                MiniStat(
                    "Rating",
                    report.ratingChangeLabel,
                    Modifier.weight(1f),
                    if (report.weekRatingChange >= 0) ChessGreen else LossRed,
                )
            }

            Spacer(Modifier.height(12.dp))
            Text(
                "Learning time ${report.learningTimeLabel} · " +
                    "Lifetime: ${report.lifetimeLessons} lessons, ${report.lifetimePuzzles} puzzles · " +
                    "Tactical ${report.tacticalRating}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            // Recent games
            if (report.recentGames.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Text("Recent games", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(6.dp))
                report.recentGames.forEach { game ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ResultBadge(game.result)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            buildString {
                                append("vs ")
                                append(game.opponentName)
                                game.opponentRating?.let { append(" ($it)") }
                            },
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                        )
                        if (game.gameId != null) {
                            TextButton(
                                onClick = { onOpenGame(game.gameId) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(2.dp))
                                Text("Replay", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            // Actions
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onEmailReport, enabled = !isEmailing) {
                    if (isEmailing) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Email report")
                    }
                }
                OutlinedButton(onClick = onManage) {
                    Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Manage")
                }
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color? = null) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = MaterialTheme.shapes.small,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                value,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleSmall,
                color = valueColor ?: MaterialTheme.colorScheme.onSurface,
            )
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ResultBadge(result: String) {
    val (bg, fg) = when (result) {
        "win" -> ChessGreen.copy(alpha = 0.2f) to ChessGreen
        "loss" -> LossRed.copy(alpha = 0.2f) to LossRed
        "draw" -> Color.Gray.copy(alpha = 0.25f) to Color.Gray
        else -> Color.Gray.copy(alpha = 0.15f) to Color.Gray
    }
    Surface(color = bg, shape = MaterialTheme.shapes.small) {
        Text(
            result.uppercase(),
            color = fg,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun ManageChildDialog(
    child: ChildReport,
    isManaging: Boolean,
    error: String?,
    success: Boolean,
    onSave: (name: String?, password: String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(child.name) }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(success) {
        if (success) onDismiss()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Manage ${child.name}") },
        text = {
            Column {
                (localError ?: error)?.let {
                    Text(it, color = LossRed, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Display name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("New password (optional)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = confirm,
                    onValueChange = { confirm = it },
                    label = { Text("Confirm new password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    localError = null
                    if (password.isNotBlank() && password != confirm) {
                        localError = "Passwords do not match."
                        return@Button
                    }
                    if (password.isNotBlank() && password.length < 8) {
                        localError = "Password must be at least 8 characters."
                        return@Button
                    }
                    onSave(
                        name.takeIf { it.isNotBlank() && it != child.name },
                        password.takeIf { it.isNotBlank() },
                    )
                },
                enabled = !isManaging,
            ) {
                if (isManaging) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Text("Save")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
