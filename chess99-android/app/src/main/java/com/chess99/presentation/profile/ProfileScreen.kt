package com.chess99.presentation.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.layout.ContentScale
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
 * Profile screen with 3 tabs: Settings, Friends, Stats.
 * Mirrors chess-frontend/src/components/Profile.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateBack: () -> Unit,
    onNavigateToReferrals: () -> Unit = {},
    onNavigateToRatingHistory: () -> Unit = {},
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    var showAboutDialog by remember { mutableStateOf(false) }

    if (showAboutDialog) {
        com.chess99.presentation.common.AboutContactDialog(
            onDismiss = { showAboutDialog = false },
        )
    }
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
                title = { Text("Profile") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToReferrals) {
                        Icon(Icons.Default.Share, "Referrals")
                    }
                    IconButton(onClick = { showAboutDialog = true }) {
                        Icon(Icons.Default.Info, "About")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Tabs
            TabRow(selectedTabIndex = state.selectedTab.ordinal) {
                Tab(
                    selected = state.selectedTab == ProfileTab.SETTINGS,
                    onClick = { viewModel.selectTab(ProfileTab.SETTINGS) },
                    text = { Text("Settings") },
                    icon = { Icon(Icons.Default.Settings, null, modifier = Modifier.size(18.dp)) },
                )
                Tab(
                    selected = state.selectedTab == ProfileTab.FRIENDS,
                    onClick = { viewModel.selectTab(ProfileTab.FRIENDS) },
                    text = { Text("Friends") },
                    icon = { Icon(Icons.Default.Group, null, modifier = Modifier.size(18.dp)) },
                )
                Tab(
                    selected = state.selectedTab == ProfileTab.STATS,
                    onClick = { viewModel.selectTab(ProfileTab.STATS) },
                    text = { Text("Stats") },
                    icon = { Icon(Icons.Default.BarChart, null, modifier = Modifier.size(18.dp)) },
                )
            }

            // Loading
            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
                return@Column
            }

            // Tab content
            when (state.selectedTab) {
                ProfileTab.SETTINGS -> SettingsTab(state = state, viewModel = viewModel)
                ProfileTab.FRIENDS -> FriendsTab(state = state, viewModel = viewModel)
                ProfileTab.STATS -> StatsTab(state = state, viewModel = viewModel, onNavigateToRatingHistory = onNavigateToRatingHistory)
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

// ── Settings Tab ──────────────────────────────────────────────────────────

@Composable
private fun SettingsTab(state: ProfileUiState, viewModel: ProfileViewModel) {
    val avatarPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        uri?.let { viewModel.uploadAvatar(it) }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Avatar section
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "Avatar",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    ProfileAvatar(avatarUrl = state.avatarUrl, size = 80)

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { avatarPickerLauncher.launch("image/*") },
                            enabled = !state.isUploadingAvatar,
                        ) {
                            Icon(Icons.Default.Upload, null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Upload Photo")
                        }
                        OutlinedButton(
                            onClick = { viewModel.toggleAvatarPicker() },
                            enabled = !state.isUploadingAvatar,
                        ) {
                            Icon(Icons.Default.Face, null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Pick Avatar")
                        }
                    }

                    if (state.isUploadingAvatar) {
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }

        // DiceBear avatar picker
        if (state.showAvatarPicker) {
            item {
                DiceBearAvatarPicker(
                    options = state.diceBearOptions,
                    isLoading = state.isUploadingAvatar,
                    onSelect = { option ->
                        viewModel.selectDiceBearAvatar(option.style, option.seed)
                    },
                    onRegenerate = { viewModel.regenerateDiceBearSeeds() },
                )
            }
        }

        // Profile fields
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Profile Info",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = state.name,
                        onValueChange = { viewModel.updateName(it) },
                        label = { Text("Display Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Person, null) },
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = state.birthday,
                        onValueChange = { viewModel.updateBirthday(it) },
                        label = { Text("Birthday (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.CalendarToday, null) },
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = state.classOfStudy,
                        onValueChange = { viewModel.updateClassOfStudy(it) },
                        label = { Text("Class / Grade (1-12)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.School, null) },
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { viewModel.saveProfile() },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.isSaving,
                    ) {
                        if (state.isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Save Changes")
                    }
                }
            }
        }

        // Board theme picker
        item {
            BoardThemePicker(
                selectedTheme = state.boardTheme,
                onSelect = { viewModel.selectBoardTheme(it) },
            )
        }

        // Piece style picker
        item {
            PieceStylePicker(
                selectedStyle = state.pieceStyle,
                onSelect = { viewModel.selectPieceStyle(it) },
            )
        }

        // Sound toggle
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (state.isSoundMuted) Icons.Default.VolumeOff
                            else Icons.Default.VolumeUp,
                            null,
                            modifier = Modifier.size(24.dp),
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                "Game Sounds",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                if (state.isSoundMuted) "Muted" else "Enabled",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Switch(
                        checked = !state.isSoundMuted,
                        onCheckedChange = { viewModel.toggleSoundMuted() },
                    )
                }
            }
        }
    }
}

// ── DiceBear Avatar Picker ───────────────────────────────────────────────

@Composable
private fun DiceBearAvatarPicker(
    options: List<DiceBearOption>,
    isLoading: Boolean,
    onSelect: (DiceBearOption) -> Unit,
    onRegenerate: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Choose an Avatar",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                TextButton(onClick = onRegenerate, enabled = !isLoading) {
                    Icon(Icons.Default.Refresh, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("New Options")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Group by style for organized display
            val groupedByStyle = options.groupBy { it.style }
            groupedByStyle.forEach { (style, styleOptions) ->
                Text(
                    text = style.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 4.dp),
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    styleOptions.forEach { option ->
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(
                                    width = 2.dp,
                                    color = MaterialTheme.colorScheme.outlineVariant,
                                    shape = RoundedCornerShape(12.dp),
                                )
                                .clickable(enabled = !isLoading) { onSelect(option) },
                            contentAlignment = Alignment.Center,
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data(option.url)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "${option.style} avatar",
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

// ── Board Theme Picker ───────────────────────────────────────────────────

@Composable
private fun BoardThemePicker(
    selectedTheme: String,
    onSelect: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Board Theme",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Grid of theme swatches (4 columns)
            val themes = ProfileViewModel.BOARD_THEMES.entries.toList()

            // Use a fixed-height FlowRow approach for themes
            Column {
                themes.chunked(4).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        row.forEach { (key, theme) ->
                            val isSelected = selectedTheme == key
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .border(
                                        width = if (isSelected) 2.dp else 1.dp,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.outlineVariant,
                                        shape = RoundedCornerShape(8.dp),
                                    )
                                    .clickable { onSelect(key) }
                                    .padding(4.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                // 2x2 mini board swatch
                                Row(modifier = Modifier.height(28.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .background(Color(theme.lightColor)),
                                    )
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .background(Color(theme.darkColor)),
                                    )
                                }
                                Row(modifier = Modifier.height(28.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .background(Color(theme.darkColor)),
                                    )
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .background(Color(theme.lightColor)),
                                    )
                                }

                                // Theme name
                                Text(
                                    text = theme.name,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isSelected) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                        }
                        // Fill remaining slots if row is not full
                        repeat(4 - row.size) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

// ── Piece Style Picker ───────────────────────────────────────────────────

@Composable
private fun PieceStylePicker(
    selectedStyle: String,
    onSelect: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Piece Style",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ProfileViewModel.PIECE_STYLES.forEach { style ->
                    FilterChip(
                        selected = selectedStyle == style.key,
                        onClick = { onSelect(style.key) },
                        label = { Text(style.label) },
                        modifier = Modifier.weight(1f),
                        leadingIcon = if (selectedStyle == style.key) {
                            {
                                Icon(
                                    Icons.Default.Check,
                                    null,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                        } else null,
                    )
                }
            }
        }
    }
}

// ── Friends Tab ───────────────────────────────────────────────────────────

@Composable
private fun FriendsTab(state: ProfileUiState, viewModel: ProfileViewModel) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Search bar
        OutlinedTextField(
            value = state.friendSearchQuery,
            onValueChange = { viewModel.searchFriends(it) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            placeholder = { Text("Search players...") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
        )

        // Search results
        if (state.friendSearchQuery.length >= 2 && state.friendSearchResults.isNotEmpty()) {
            Text(
                "Search Results",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            LazyColumn(
                modifier = Modifier.weight(0.4f),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(state.friendSearchResults, key = { it.id }) { user ->
                    FriendCard(friend = user, showOnlineIndicator = true)
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        }

        // Friends list header
        Text(
            "Friends (${state.friends.size})",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )

        if (state.friends.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.GroupAdd,
                        null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "No friends yet.\nSearch for players above!",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(state.friends, key = { it.id }) { friend ->
                    FriendCard(friend = friend, showOnlineIndicator = true)
                }
            }
        }
    }
}

@Composable
private fun FriendCard(friend: FriendInfo, showOnlineIndicator: Boolean) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Avatar with online indicator
            Box {
                ProfileAvatar(avatarUrl = friend.avatarUrl, size = 40)
                if (showOnlineIndicator) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(
                                if (friend.isOnline) Color(0xFF4CAF50) else Color.Gray,
                            )
                            .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                            .align(Alignment.BottomEnd),
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(friend.name, fontWeight = FontWeight.Medium)
                Text(
                    "Rating: ${friend.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (friend.isOnline) {
                Text(
                    "Online",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF4CAF50),
                )
            }
        }
    }
}

// ── Stats Tab ─────────────────────────────────────────────────────────────

@Composable
private fun StatsTab(state: ProfileUiState, viewModel: ProfileViewModel, onNavigateToRatingHistory: () -> Unit = {}) {
    val stats = state.stats

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (stats == null) {
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

        // Win/Loss/Draw summary
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Game Results",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        StatCircle(
                            value = stats.wins,
                            label = "Wins",
                            color = Color(0xFF4CAF50),
                        )
                        StatCircle(
                            value = stats.losses,
                            label = "Losses",
                            color = Color(0xFFE53935),
                        )
                        StatCircle(
                            value = stats.draws,
                            label = "Draws",
                            color = Color(0xFF9E9E9E),
                        )
                    }
                }
            }
        }

        // Detailed stats
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Performance",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    StatsRow(label = "Total Games", value = "${stats.totalGames}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                    StatsRow(
                        label = "Win Rate",
                        value = "${String.format("%.1f", stats.winRate)}%",
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                    StatsRow(label = "Current Streak", value = "${stats.currentStreak}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                    StatsRow(label = "Best Streak", value = "${stats.bestStreak}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                    StatsRow(
                        label = "Avg Game Duration",
                        value = if (stats.averageGameDuration > 0) {
                            "${stats.averageGameDuration / 60}m ${stats.averageGameDuration % 60}s"
                        } else {
                            "N/A"
                        },
                    )
                }
            }
        }

        // Rating chart placeholder
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Rating History",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    if (state.ratingHistory.isEmpty()) {
                        // Placeholder for rating chart
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    Icons.Default.ShowChart,
                                    null,
                                    modifier = Modifier.size(40.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    "View your full rating history",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                TextButton(onClick = onNavigateToRatingHistory) {
                                    Text("View Rating History")
                                }
                            }
                        }
                    } else {
                        // Simple text-based rating history
                        state.ratingHistory.takeLast(10).reversed().forEach { entry ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    entry.date.take(10),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Row {
                                    Text(
                                        "${entry.rating}",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium,
                                    )
                                    if (entry.change != 0) {
                                        Text(
                                            text = if (entry.change > 0) " +${entry.change}"
                                            else " ${entry.change}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = if (entry.change > 0) Color(0xFF4CAF50)
                                            else Color(0xFFE53935),
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
}

@Composable
private fun StatCircle(value: Int, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "$value",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = color,
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatsRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ── Shared Components ─────────────────────────────────────────────────────

@Composable
private fun ProfileAvatar(
    avatarUrl: String?,
    size: Int,
    modifier: Modifier = Modifier,
) {
    if (avatarUrl != null) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(avatarUrl)
                .crossfade(true)
                .build(),
            contentDescription = "Profile avatar",
            modifier = modifier
                .size(size.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = modifier
                .size(size.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Default.Person,
                contentDescription = "Default avatar",
                modifier = Modifier.size((size * 0.6f).dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
    }
}
