package com.chess99.presentation.lobby

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
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
    viewModel: LobbyViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

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
                        Badge { Text("${state.onlineCount} online") }
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
                    icon = { Icon(Icons.Default.Group, null, modifier = Modifier.size(18.dp)) },
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
                    players = state.onlinePlayers,
                    isLoading = state.isLoading,
                    onChallenge = { playerId ->
                        viewModel.sendInvitation(playerId, "10|0", "random", "casual")
                    },
                )
                LobbyTab.FRIENDS -> FriendsTab(
                    friends = state.friends,
                    searchResults = state.searchResults,
                    onSearch = { viewModel.searchUsers(it) },
                    onAddFriend = { viewModel.sendFriendRequest(it) },
                    onChallenge = { playerId ->
                        viewModel.sendInvitation(playerId, "10|0", "random", "casual")
                    },
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
    players: List<LobbyPlayer>,
    isLoading: Boolean,
    onChallenge: (Int) -> Unit,
) {
    if (isLoading && players.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (players.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No players online", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(players, key = { it.id }) { player ->
            PlayerCard(player = player, onChallenge = { onChallenge(player.id) })
        }
    }
}

@Composable
private fun PlayerCard(player: LobbyPlayer, onChallenge: () -> Unit) {
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
                    .background(if (player.isOnline) Color(0xFF4CAF50) else Color.Gray)
            )
            Spacer(modifier = Modifier.width(12.dp))

            // Player info
            Column(modifier = Modifier.weight(1f)) {
                Text(player.name, fontWeight = FontWeight.Medium)
                Text(
                    "Rating: ${player.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Challenge button
            OutlinedButton(onClick = onChallenge, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                Icon(Icons.Default.SportsEsports, null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Challenge", fontSize = 12.sp)
            }
        }
    }
}

// ── Friends Tab ─────────────────────────────────────────────────────────

@Composable
private fun FriendsTab(
    friends: List<LobbyPlayer>,
    searchResults: List<LobbyPlayer>,
    onSearch: (String) -> Unit,
    onAddFriend: (Int) -> Unit,
    onChallenge: (Int) -> Unit,
) {
    var searchQuery by remember { mutableStateOf("") }

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

        // Friends list
        Text(
            "Friends (${friends.size})",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )
        if (friends.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("No friends yet. Search for players above!", textAlign = TextAlign.Center)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(friends, key = { it.id }) { friend ->
                    PlayerCard(player = friend, onChallenge = { onChallenge(friend.id) })
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
                Spacer(modifier = Modifier.height(32.dp))
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
