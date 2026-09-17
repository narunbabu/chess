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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R

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
                title = { Text(stringResource(R.string.championship_list_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadChampionships() }) {
                        Icon(Icons.Default.Refresh, stringResource(R.string.a11y_refresh))
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.showCreateDialog() },
            ) {
                Icon(Icons.Default.Add, stringResource(R.string.a11y_create_tournament))
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
                placeholder = { Text(stringResource(R.string.championship_search)) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true,
            )

            // Status filter chips
            Text(
                stringResource(R.string.championship_filter_status),
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
                    label = { Text(stringResource(R.string.filter_all)) },
                )
                listOf("upcoming", "active", "completed").forEach { status ->
                    FilterChip(
                        selected = state.statusFilter == status,
                        onClick = { viewModel.setStatusFilter(status) },
                        label = { Text(championshipStatusLabel(status)) },
                    )
                }
            }

            // Format filter chips
            Text(
                stringResource(R.string.championship_filter_format),
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
                    label = { Text(stringResource(R.string.filter_all)) },
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
                                stringResource(R.string.championship_none_found),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                stringResource(R.string.championship_none_found_body),
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
                title = { Text(stringResource(R.string.error_title)) },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text(stringResource(R.string.action_ok)) }
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
                    label = stringResource(
                        R.string.championship_participants_ratio,
                        championship.currentParticipants,
                        championship.maxParticipants,
                    ),
                )
                if (championship.prizePool > 0) {
                    InfoItem(
                        icon = Icons.Default.EmojiEvents,
                        label = stringResource(R.string.championship_fee_value, championship.prizePool),
                    )
                }
                if (championship.entryFee > 0) {
                    InfoItem(
                        icon = Icons.Default.ConfirmationNumber,
                        label = stringResource(R.string.championship_fee_value, championship.entryFee),
                    )
                } else {
                    InfoItem(
                        icon = Icons.Default.ConfirmationNumber,
                        label = stringResource(R.string.championship_fee_free),
                    )
                }
            }

            // Dates
            championship.startDate?.let { start ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = championship.endDate?.let { end ->
                        stringResource(R.string.championship_dates_start_end, start, end)
                    } ?: stringResource(R.string.championship_dates_start, start),
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
                    Text(
                        stringResource(
                            if (isRegistering) R.string.championship_registering
                            else R.string.championship_register
                        )
                    )
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
                        stringResource(R.string.championship_registered_badge),
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
            text = championshipStatusLabel(status),
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
        title = { Text(stringResource(R.string.championship_create_title)) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.championship_name_label)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                // Format selector
                Text(
                    stringResource(R.string.championship_filter_format),
                    style = MaterialTheme.typography.labelMedium,
                )
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
                Text(
                    stringResource(R.string.championship_time_control),
                    style = MaterialTheme.typography.labelMedium,
                )
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
                        label = { Text(stringResource(R.string.championship_max_players)) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = entryFee,
                        onValueChange = { entryFee = it.filter { c -> c.isDigit() } },
                        label = { Text(stringResource(R.string.championship_entry_fee_label)) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                }

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(stringResource(R.string.championship_description_optional)) },
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
                Text(
                    stringResource(
                        if (isCreating) R.string.championship_creating
                        else R.string.championship_create
                    )
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isCreating,
            ) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

// ── Helpers ─────────────────────────────────────────────────────────────

@Composable
internal fun formatDisplayName(format: String): String = when (format) {
    "swiss" -> stringResource(R.string.championship_format_swiss)
    "elimination" -> stringResource(R.string.championship_format_elimination)
    "round_robin" -> stringResource(R.string.championship_format_round_robin)
    "hybrid" -> stringResource(R.string.championship_format_hybrid)
    else -> format.replaceFirstChar { it.uppercase() }
}

/** Display label for a tournament status key; unknown keys keep the server value. */
@Composable
internal fun championshipStatusLabel(status: String): String = when (status) {
    "upcoming" -> stringResource(R.string.championship_status_upcoming)
    "active" -> stringResource(R.string.championship_status_active)
    "completed" -> stringResource(R.string.championship_status_completed)
    "paused" -> stringResource(R.string.championship_status_paused)
    else -> status.replaceFirstChar { it.uppercase() }
}
