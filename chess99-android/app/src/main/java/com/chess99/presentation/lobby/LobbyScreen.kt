package com.chess99.presentation.lobby

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Lobby screen with tabs for Players, Friends, and Matchmaking.
 * Mirrors chess-frontend/src/pages/LobbyPage.js
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun LobbyScreen(
    onNavigateBack: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    /** T2: opens directly on Matchmaking when a Home "Nearby Opponents" real
     *  player card was tapped. Any other/absent value falls back to Players. */
    initialTab: String? = null,
    viewModel: LobbyViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(initialTab) {
        if (initialTab == "matchmaking") {
            viewModel.selectTab(LobbyTab.MATCHMAKING)
        }
    }

    // Navigate to matched game
    LaunchedEffect(state.matchedGameId) {
        state.matchedGameId?.let { gameId ->
            viewModel.clearMatchedGame()
            onNavigateToGame(gameId)
        }
    }

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
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Lobby")
                        Spacer(modifier = Modifier.width(8.dp))
                        // Count what the Players tab actually lists. onlineCount
                        // comes from a separate endpoint that counts only real
                        // humans, which read as "0 online" above a list of nine
                        // available opponents. Synthetic players are presented as
                        // ordinary opponents, so they count as available too.
                        Badge {
                            Text("${maxOf(state.onlineCount, state.onlinePlayers.size)} online")
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Tabs
            TabRow(
                selectedTabIndex = state.selectedTab.ordinal,
            ) {
                Tab(
                    selected = state.selectedTab == LobbyTab.PLAYERS,
                    onClick = { viewModel.selectTab(LobbyTab.PLAYERS) },
                    text = { Text("Players") },
                    icon = { Icon(Icons.Default.People, null, modifier = Modifier.size(18.dp)) },
                )
                Tab(
                    selected = state.selectedTab == LobbyTab.FRIENDS,
                    onClick = { viewModel.selectTab(LobbyTab.FRIENDS) },
                    text = { Text("Friends") },
                    icon = {
                        BadgedBox(
                            badge = {
                                if (state.pendingFriendRequests.isNotEmpty()) {
                                    Badge { Text("${state.pendingFriendRequests.size}") }
                                }
                            }
                        ) {
                            Icon(Icons.Default.Group, null, modifier = Modifier.size(18.dp))
                        }
                    },
                )
                Tab(
                    selected = state.selectedTab == LobbyTab.MATCHMAKING,
                    onClick = { viewModel.selectTab(LobbyTab.MATCHMAKING) },
                    text = { Text("Quick Play") },
                    icon = { Icon(Icons.Default.FlashOn, null, modifier = Modifier.size(18.dp)) },
                )
            }

            // Active games banner
            if (state.activeGames.isNotEmpty()) {
                ActiveGamesBanner(
                    games = state.activeGames,
                    onResume = onNavigateToGame,
                )
            }

            // Pending invitations banner
            if (state.pendingInvitations.isNotEmpty()) {
                InvitationsBanner(
                    invitations = state.pendingInvitations,
                    onAccept = { viewModel.acceptInvitation(it) },
                    onDecline = { viewModel.declineInvitation(it) },
                )
            }

            // Tab content
            when (state.selectedTab) {
                LobbyTab.PLAYERS -> PlayersTab(
                    state = state,
                    onChallenge = { playerId ->
                        viewModel.sendInvitation(
                            playerId,
                            "${state.selectedTimeControlMinutes}|${state.selectedIncrementSeconds}",
                            "random",
                            // Invitations take rated|casual too; a learning game
                            // is a casual one with help enabled.
                            if (state.selectedGameMode == "rated") "rated" else "casual",
                        )
                    },
                    onPlaySynthetic = { viewModel.startGameVsSynthetic(it) },
                    onMinRatingChange = { viewModel.setRatingWindowDraftMin(it) },
                    onMaxRatingChange = { viewModel.setRatingWindowDraftMax(it) },
                    onApplyRatingWindow = { viewModel.applyRatingWindow() },
                    onResetRatingWindow = { viewModel.resetRatingWindow() },
                    onGameModeChange = { viewModel.setSelectedGameMode(it) },
                    onTimeControlChange = { m, i -> viewModel.setSelectedTimeControl(m, i) },
                )
                LobbyTab.FRIENDS -> FriendsTab(
                    friends = state.friends,
                    pendingRequests = state.pendingFriendRequests,
                    searchResults = state.searchResults,
                    onSearch = { viewModel.searchUsers(it) },
                    onAddFriend = { viewModel.sendFriendRequest(it) },
                    onChallenge = { playerId ->
                        viewModel.sendInvitation(playerId, "10|0", "random", "casual")
                    },
                    onAcceptRequest = { viewModel.acceptFriendRequest(it) },
                    onDeclineRequest = { viewModel.declineFriendRequest(it) },
                    onRemoveFriend = { viewModel.removeFriend(it) },
                )
                LobbyTab.MATCHMAKING -> MatchmakingTab(
                    state = state.matchmakingState,
                    onStart = { tc, color, mode -> viewModel.startMatchmaking(tc, color, mode) },
                    onCancel = { viewModel.cancelMatchmaking() },
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

// ── Players Tab ─────────────────────────────────────────────────────────

@Composable
private fun PlayersTab(
    state: LobbyUiState,
    onChallenge: (Int) -> Unit,
    onPlaySynthetic: (LobbyPlayer) -> Unit,
    onMinRatingChange: (String) -> Unit,
    onMaxRatingChange: (String) -> Unit,
    onApplyRatingWindow: () -> Unit,
    onResetRatingWindow: () -> Unit,
    onGameModeChange: (String) -> Unit,
    onTimeControlChange: (Int, Int) -> Unit,
) {
    val players = state.visiblePlayers

    if (state.isLoading && state.onlinePlayers.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            EloFilterCard(
                minText = state.ratingWindowDraftMin,
                maxText = state.ratingWindowDraftMax,
                canReset = state.hasStoredRatingWindow,
                onMinChange = onMinRatingChange,
                onMaxChange = onMaxRatingChange,
                onApply = onApplyRatingWindow,
                onReset = onResetRatingWindow,
            )
        }

        item {
            GameOptionsCard(
                selectedMode = state.selectedGameMode,
                timeControlMinutes = state.selectedTimeControlMinutes,
                incrementSeconds = state.selectedIncrementSeconds,
                onModeChange = onGameModeChange,
                onTimeControlChange = onTimeControlChange,
            )
        }

        if (players.isEmpty()) {
            item {
                // Distinguish "nobody here" from "your filter hid everyone" - the
                // old copy said "No players online" in both cases.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (state.onlinePlayers.isEmpty()) {
                            "No players online"
                        } else {
                            "No opponents rated ${state.ratingWindow.minRating}-" +
                                "${state.ratingWindow.maxRating}. Widen the range to see more."
                        },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

        items(players, key = { "${if (it.isSynthetic) "s" else "h"}-${it.id}" }) { player ->
            PlayerCard(
                player = player,
                onChallenge = {
                    if (player.isSynthetic) onPlaySynthetic(player) else onChallenge(player.id)
                },
            )
        }
    }
}

/**
 * Elo range filter - web parity with PlayersList.jsx's "ELO From/To" row.
 * Filtering is local: the server is queried across the full span, so narrowing
 * or widening is instant and never blanks the list while a request is in flight.
 */
@Composable
private fun EloFilterCard(
    minText: String,
    maxText: String,
    canReset: Boolean,
    onMinChange: (String) -> Unit,
    onMaxChange: (String) -> Unit,
    onApply: () -> Unit,
    onReset: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "Opponent rating",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = minText,
                    onValueChange = onMinChange,
                    label = { Text("From") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                Text("to", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = maxText,
                    onValueChange = onMaxChange,
                    label = { Text("To") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onApply) { Text("Apply") }
                if (canReset) {
                    OutlinedButton(onClick = onReset) { Text("Reset") }
                }
            }
        }
    }
}

/**
 * Mode and time control applied when starting a game from this list. Previously
 * hardcoded to casual 10|0 in LobbyViewModel.startGameVsSynthetic, so the
 * Players tab could only ever start one kind of game.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GameOptionsCard(
    selectedMode: String,
    timeControlMinutes: Int,
    incrementSeconds: Int,
    onModeChange: (String) -> Unit,
    onTimeControlChange: (Int, Int) -> Unit,
) {
    val options = listOf(3 to 1, 5 to 0, 10 to 0, 15 to 10, 30 to 0)

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "Game options",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "Mode",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MODE_OPTIONS.forEach { (value, label) ->
                    FilterChip(
                        selected = selectedMode == value,
                        onClick = { onModeChange(value) },
                        label = { Text(label) },
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text(
                "Time",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(4.dp))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                options.forEach { (minutes, increment) ->
                    FilterChip(
                        selected = timeControlMinutes == minutes && incrementSeconds == increment,
                        onClick = { onTimeControlChange(minutes, increment) },
                        label = { Text("$minutes+$increment") },
                    )
                }
            }
        }
    }
}

private val MODE_OPTIONS = listOf(
    "casual" to "Casual",
    "learning" to "Learning",
    "rated" to "Rated",
)

@Composable
private fun PlayerCard(player: LobbyPlayer, onChallenge: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Online indicator (bots are always available to play)
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(if (player.isOnline) Color(0xFF4CAF50) else Color.Gray)
            )
            Spacer(modifier = Modifier.width(12.dp))

            // Player info
            Column(modifier = Modifier.weight(1f)) {
                // Synthetic players are presented as ordinary opponents chosen by
                // rating — deliberately no "BOT" badge. Players pick someone at
                // their level, not a labelled machine. `isSynthetic` still drives
                // behaviour (instant start vs invitation), just not the copy.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(player.name, fontWeight = FontWeight.Medium)
                }
                Text(
                    "Rating: ${player.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Action: bots start a game immediately; humans get a challenge invite
            OutlinedButton(onClick = onChallenge, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                Icon(Icons.Default.SportsEsports, null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (player.isSynthetic) "Play" else "Challenge", fontSize = 12.sp)
            }
        }
    }
}

// ── Friends Tab ─────────────────────────────────────────────────────────

@Composable
private fun FriendsTab(
    friends: List<LobbyPlayer>,
    pendingRequests: List<LobbyPlayer>,
    searchResults: List<LobbyPlayer>,
    onSearch: (String) -> Unit,
    onAddFriend: (Int) -> Unit,
    onChallenge: (Int) -> Unit,
    onAcceptRequest: (Int) -> Unit,
    onDeclineRequest: (Int) -> Unit,
    onRemoveFriend: (Int) -> Unit,
) {
    var searchQuery by remember { mutableStateOf("") }
    var friendPendingRemoval by remember { mutableStateOf<LobbyPlayer?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                onSearch(it)
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            placeholder = { Text("Search players...") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
        )

        // Search results
        if (searchQuery.length >= 2 && searchResults.isNotEmpty()) {
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
                items(searchResults, key = { it.id }) { user ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.padding(8.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(user.name, fontWeight = FontWeight.Medium)
                                Text("${user.rating}", style = MaterialTheme.typography.bodySmall)
                            }
                            TextButton(onClick = { onAddFriend(user.id) }) {
                                Text("Add Friend")
                            }
                        }
                    }
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Friend requests section (T1) — above the friends list, absent when empty.
            if (pendingRequests.isNotEmpty()) {
                item(key = "requests-header") {
                    SectionHeader("Friend requests")
                }
                items(pendingRequests, key = { "request-${it.id}" }) { requester ->
                    FriendRequestCard(
                        requester = requester,
                        onAccept = { onAcceptRequest(requester.id) },
                        onDecline = { onDeclineRequest(requester.id) },
                    )
                }
                item(key = "requests-divider") {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                }
            }

            item(key = "friends-header") {
                Text(
                    "Friends (${friends.size})",
                    style = MaterialTheme.typography.titleSmall,
                )
            }

            if (friends.isEmpty()) {
                item(key = "friends-empty") {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("No friends yet. Search for players above!", textAlign = TextAlign.Center)
                    }
                }
            } else {
                items(friends, key = { "friend-${it.id}" }) { friend ->
                    FriendCard(
                        friend = friend,
                        onChallenge = { onChallenge(friend.id) },
                        onRemove = { friendPendingRemoval = friend },
                    )
                }
            }
        }
    }

    // Remove-friend confirmation (T3) — removal must not be a one-tap.
    friendPendingRemoval?.let { friend ->
        AlertDialog(
            onDismissRequest = { friendPendingRemoval = null },
            title = { Text("Remove friend?") },
            text = { Text("Remove ${friend.name} from your chess mates? You can add them again anytime.") },
            confirmButton = {
                TextButton(onClick = {
                    onRemoveFriend(friend.id)
                    friendPendingRemoval = null
                }) { Text("Remove") }
            },
            dismissButton = {
                TextButton(onClick = { friendPendingRemoval = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun FriendRequestCard(
    requester: LobbyPlayer,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Row(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Avatar initial
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    requester.name.take(1).uppercase(),
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(requester.name, fontWeight = FontWeight.Medium)
                Text(
                    "Rating: ${requester.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            TextButton(onClick = onDecline, contentPadding = PaddingValues(horizontal = 8.dp)) {
                Text("Decline", fontSize = 12.sp)
            }
            Spacer(modifier = Modifier.width(4.dp))
            Button(onClick = onAccept, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                Text("Accept", fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun FriendCard(
    friend: LobbyPlayer,
    onChallenge: () -> Unit,
    onRemove: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Online indicator
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(if (friend.isOnline) Color(0xFF4CAF50) else Color.Gray)
            )
            Spacer(modifier = Modifier.width(12.dp))

            // Friend info
            Column(modifier = Modifier.weight(1f)) {
                Text(friend.name, fontWeight = FontWeight.Medium)
                Text(
                    "Rating: ${friend.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Challenge stays the primary action.
            OutlinedButton(onClick = onChallenge, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                Icon(Icons.Default.SportsEsports, null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Challenge", fontSize = 12.sp)
            }

            // Overflow menu — Remove friend is deliberately not a one-tap action.
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, "More options")
                }
                DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text("Remove friend") },
                        onClick = {
                            menuExpanded = false
                            onRemove()
                        },
                    )
                }
            }
        }
    }
}

// ── Matchmaking Tab ─────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MatchmakingTab(
    state: MatchmakingState,
    onStart: (String, String, String) -> Unit,
    onCancel: () -> Unit,
) {
    var selectedTimeControl by remember { mutableStateOf("10|0") }
    var selectedColor by remember { mutableStateOf("random") }
    var selectedMode by remember { mutableStateOf("casual") }

    val timeControls = listOf("3|1", "5|0", "5|3", "10|0", "10|5", "15|10", "30|0", "30|10")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (state) {
            MatchmakingState.IDLE -> {
                Text("Quick Play", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(24.dp))

                // Time control selector
                Text("Time Control", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    timeControls.forEach { tc ->
                        FilterChip(
                            selected = selectedTimeControl == tc,
                            onClick = { selectedTimeControl = tc },
                            label = { Text(tc.replace("|", "+")) },
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Color preference
                Text("Color", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedColor == "random",
                        onClick = { selectedColor = "random" },
                        label = { Text("Random") },
                    )
                    FilterChip(
                        selected = selectedColor == "white",
                        onClick = { selectedColor = "white" },
                        label = { Text("\u2654 White") },
                    )
                    FilterChip(
                        selected = selectedColor == "black",
                        onClick = { selectedColor = "black" },
                        label = { Text("\u265A Black") },
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Game mode
                Text("Mode", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedMode == "casual",
                        onClick = { selectedMode = "casual" },
                        label = { Text("Casual") },
                    )
                    FilterChip(
                        selected = selectedMode == "learning",
                        onClick = { selectedMode = "learning" },
                        label = { Text("Learning") },
                    )
                    FilterChip(
                        selected = selectedMode == "rated",
                        onClick = { selectedMode = "rated" },
                        label = { Text("Rated") },
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = { onStart(selectedTimeControl, selectedColor, selectedMode) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                ) {
                    Icon(Icons.Default.Search, null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Find Opponent", style = MaterialTheme.typography.titleMedium)
                }
            }

            MatchmakingState.SEARCHING -> {
                Spacer(modifier = Modifier.height(48.dp))

                // Animated searching indicator
                val infiniteTransition = rememberInfiniteTransition(label = "search")
                val progress by infiniteTransition.animateFloat(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(30000, easing = LinearEasing),
                        repeatMode = RepeatMode.Restart,
                    ),
                    label = "progress",
                )

                CircularProgressIndicator(modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(24.dp))
                Text("Finding opponent...", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Searching for players...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(4.dp))
                // T4: sets expectations up front — the server falls back to a
                // synthetic opponent on queue expiry (MatchmakingService
                // checkStatus → matchWithSynthetic), so a search is never a
                // dead end even in a thin player pool. No "0 online" badge.
                Text(
                    text = "Finding a player usually takes under a minute.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(28.dp))
                OutlinedButton(onClick = onCancel) {
                    Text("Cancel")
                }
            }

            MatchmakingState.MATCHED -> {
                Spacer(modifier = Modifier.height(48.dp))
                Icon(
                    Icons.Default.CheckCircle,
                    null,
                    modifier = Modifier.size(64.dp),
                    tint = Color(0xFF4CAF50),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text("Match Found!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("Joining game...", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// ── Banners ─────────────────────────────────────────────────────────────

@Composable
private fun ActiveGamesBanner(games: List<ActiveGame>, onResume: (Int) -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("Active Games", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
            games.forEach { game ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("vs ${game.opponentName} (${game.timeControl})", style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { onResume(game.id) }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                        Text("Resume", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun InvitationsBanner(
    invitations: List<Invitation>,
    onAccept: (Int) -> Unit,
    onDecline: (Int) -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("Challenges", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
            invitations.forEach { inv ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${inv.senderName} (${inv.timeControl})",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { onAccept(inv.id) }, contentPadding = PaddingValues(horizontal = 4.dp)) {
                        Text("Accept", fontSize = 12.sp)
                    }
                    TextButton(onClick = { onDecline(inv.id) }, contentPadding = PaddingValues(horizontal = 4.dp)) {
                        Text("Decline", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
