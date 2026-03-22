package com.chess99.presentation.championship

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Championship list screen with filter chips, search bar, and tournament cards.
 * Mirrors chess-frontend/src/pages/TournamentsPage.js
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ChampionshipListScreen(
    onNavigateBack: () -> Unit,
    onNavigateToDetail: (Int) -> Unit,
    viewModel: ChampionshipListViewModel = hiltViewModel(),
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

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Tournaments") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadChampionships() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.showCreateDialog() },
            ) {
                Icon(Icons.Default.Add, "Create Tournament")
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            // Search bar
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search tournaments...") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true,
            )

            // Status filter chips
            Text(
                "Status",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(horizontal = 16.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            FlowRow(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                FilterChip(
                    selected = state.statusFilter == null,
                    onClick = { viewModel.setStatusFilter(null) },
                    label = { Text("All") },
                )
                listOf("upcoming", "active", "completed").forEach { status ->
                    FilterChip(
                        selected = state.statusFilter == status,
                        onClick = { viewModel.setStatusFilter(status) },
                        label = { Text(status.replaceFirstChar { it.uppercase() }) },
                    )
                }
            }

            // Format filter chips
            Text(
                "Format",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            FlowRow(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                FilterChip(
                    selected = state.formatFilter == null,
                    onClick = { viewModel.setFormatFilter(null) },
                    label = { Text("All") },
                )
                listOf("swiss", "elimination", "round_robin").forEach { format ->
                    FilterChip(
                        selected = state.formatFilter == format,
                        onClick = { viewModel.setFormatFilter(format) },
                        label = { Text(formatDisplayName(format)) },
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Content
            when {
                state.isLoading && state.championships.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                state.championships.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.EmojiEvents,
                                null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "No tournaments found",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Try adjusting your filters or create a new one",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.championships, key = { it.id }) { championship ->
                            ChampionshipCard(
                                championship = championship,
                                isRegistering = state.registeringId == championship.id,
                                onTap = { onNavigateToDetail(championship.id) },
                                onRegister = { viewModel.registerForChampionship(championship.id) },
                            )
                        }
                    }
                }
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

        // Create tournament dialog
        if (state.showCreateDialog) {
            CreateChampionshipDialog(
                isCreating = state.isCreating,
                onDismiss = { viewModel.dismissCreateDialog() },
                onCreate = { name, format, maxParticipants, timeControl, entryFee, description ->
                    viewModel.createChampionship(name, format, maxParticipants, timeControl, entryFee, description)
                },
            )
        }
    }
}

// ── Championship Card ──────────────────────────────────────────────────

@Composable
private fun ChampionshipCard(
    championship: Championship,
    isRegistering: Boolean,
    onTap: () -> Unit,
    onRegister: () -> Unit,
) {
    ElevatedCard(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: name + status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = championship.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(status = championship.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Format badge + time control
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SuggestionChip(
                    onClick = {},
                    label = { Text(formatDisplayName(championship.format), fontSize = 11.sp) },
                    modifier = Modifier.height(28.dp),
                )
                Text(
                    text = championship.timeControl.replace("|", "+"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Info row: participants, prize pool, dates
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                InfoItem(
                    icon = Icons.Default.People,
                    label = "${championship.currentParticipants}/${championship.maxParticipants}",
                )
                if (championship.prizePool > 0) {
                    InfoItem(
                        icon = Icons.Default.EmojiEvents,
                        label = "\u20B9${championship.prizePool}",
                    )
                }
                if (championship.entryFee > 0) {
                    InfoItem(
                        icon = Icons.Default.ConfirmationNumber,
                        label = "\u20B9${championship.entryFee}",
                    )
                } else {
                    InfoItem(
                        icon = Icons.Default.ConfirmationNumber,
                        label = "Free",
                    )
                }
            }

            // Dates
            championship.startDate?.let { start ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = buildString {
                        append("Starts: $start")
                        championship.endDate?.let { append("  \u2022  Ends: $it") }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Register button
            if (championship.status == "upcoming" && !championship.isRegistered) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onRegister,
                    enabled = !isRegistering,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (isRegistering) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(if (isRegistering) "Registering..." else "Register")
                }
            } else if (championship.isRegistered) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CheckCircle,
                        null,
                        modifier = Modifier.size(16.dp),
                        tint = Color(0xFF4CAF50),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "Registered",
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
private fun InfoItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            icon,
            null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (backgroundColor, textColor) = when (status) {
        "upcoming" -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
        "active" -> Color(0xFF4CAF50).copy(alpha = 0.15f) to Color(0xFF2E7D32)
        "completed" -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
        "paused" -> Color(0xFFFFA726).copy(alpha = 0.15f) to Color(0xFFE65100)
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ── Create Tournament Dialog ───────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CreateChampionshipDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, format: String, maxParticipants: Int, timeControl: String, entryFee: Int, description: String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var format by remember { mutableStateOf("swiss") }
    var maxParticipants by remember { mutableStateOf("16") }
    var timeControl by remember { mutableStateOf("10|0") }
    var entryFee by remember { mutableStateOf("0") }
    var description by remember { mutableStateOf("") }

    val formats = listOf("swiss", "elimination", "round_robin")
    val timeControls = listOf("3|1", "5|0", "5|3", "10|0", "10|5", "15|10", "30|0")

    AlertDialog(
        onDismissRequest = { if (!isCreating) onDismiss() },
        title = { Text("Create Tournament") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tournament Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                // Format selector
                Text("Format", style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    formats.forEach { f ->
                        FilterChip(
                            selected = format == f,
                            onClick = { format = f },
                            label = { Text(formatDisplayName(f)) },
                        )
                    }
                }

                // Time control selector
                Text("Time Control", style = MaterialTheme.typography.labelMedium)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    timeControls.forEach { tc ->
                        FilterChip(
                            selected = timeControl == tc,
                            onClick = { timeControl = tc },
                            label = { Text(tc.replace("|", "+")) },
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = maxParticipants,
                        onValueChange = { maxParticipants = it.filter { c -> c.isDigit() } },
                        label = { Text("Max Players") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = entryFee,
                        onValueChange = { entryFee = it.filter { c -> c.isDigit() } },
                        label = { Text("Entry Fee (\u20B9)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                }

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onCreate(
                        name,
                        format,
                        maxParticipants.toIntOrNull() ?: 16,
                        timeControl,
                        entryFee.toIntOrNull() ?: 0,
                        description,
                    )
                },
                enabled = name.isNotBlank() && !isCreating,
            ) {
                if (isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(if (isCreating) "Creating..." else "Create")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isCreating,
            ) {
                Text("Cancel")
            }
        },
    )
}

// ── Helpers ─────────────────────────────────────────────────────────────

private fun formatDisplayName(format: String): String = when (format) {
    "swiss" -> "Swiss"
    "elimination" -> "Elimination"
    "round_robin" -> "Round Robin"
    "hybrid" -> "Hybrid"
    else -> format.replaceFirstChar { it.uppercase() }
}
