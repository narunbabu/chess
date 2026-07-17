package com.chess99.presentation.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chess99.R
import com.chess99.presentation.navigation.Screen
import com.chess99.presentation.theme.ChessDarkGreen
import com.chess99.presentation.theme.ChessGreen
import kotlinx.coroutines.launch

/**
 * Home is the post-login landing screen. The bottom bar holds the four primary
 * tabs (Play / Lobby / Learn / Profile); the navigation drawer surfaces every
 * other destination so the app reaches parity with the web header menu.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToPlayComputer: () -> Unit,
    onNavigateToLobby: () -> Unit,
    /** T2: a Nearby Opponents real-player tap — opens Lobby directly on Matchmaking. */
    onNavigateToLobbyMatchmaking: () -> Unit = onNavigateToLobby,
    onNavigateToLearn: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    // Shared with PlayTab below — hiltViewModel() resolves to the same
    // instance for every call within this Screen.Home NavBackStackEntry.
    val homeViewModel: HomeViewModel = hiltViewModel()
    val homeUiState by homeViewModel.uiState.collectAsStateWithLifecycle()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
                hideAmbassador = homeUiState.hideAmbassadorEntry,
                onDestination = { route ->
                    scope.launch { drawerState.close() }
                    onNavigate(route)
                },
                onLogout = {
                    scope.launch { drawerState.close() }
                    onLogout()
                },
            )
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Chess99", fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    actions = {
                        IconButton(onClick = onLogout) {
                            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Logout")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.primary,
                    ),
                )
            },
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.SportsEsports, contentDescription = null) },
                        label = { Text("Play") },
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.People, contentDescription = null) },
                        label = { Text("Lobby") },
                        selected = selectedTab == 1,
                        onClick = {
                            selectedTab = 1
                            onNavigateToLobby()
                        },
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.School, contentDescription = null) },
                        label = { Text("Learn") },
                        selected = selectedTab == 2,
                        onClick = {
                            selectedTab = 2
                            onNavigateToLearn()
                        },
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Person, contentDescription = null) },
                        label = { Text("Profile") },
                        selected = selectedTab == 3,
                        onClick = {
                            selectedTab = 3
                            onNavigateToProfile()
                        },
                    )
                }
            },
        ) { paddingValues ->
            PlayTab(
                modifier = Modifier.padding(paddingValues),
                onPlayComputer = onNavigateToPlayComputer,
                onPlayOnline = onNavigateToLobby,
                onPlayOnlineMatchmaking = onNavigateToLobbyMatchmaking,
                onNavigate = onNavigate,
                onLearn = onNavigateToLearn,
                onNavigateToGame = onNavigateToGame,
                viewModel = homeViewModel,
            )
        }
    }
}

private data class DrawerEntry(val label: String, val icon: ImageVector, val route: String)

@Composable
private fun AppDrawer(
    hideAmbassador: Boolean,
    onDestination: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val entries = listOfNotNull(
        DrawerEntry("Dashboard", Icons.Default.Dashboard, Screen.Dashboard.route),
        DrawerEntry("Championships", Icons.Default.EmojiEvents, Screen.ChampionshipList.route),
        DrawerEntry("Tournament Invites", Icons.Default.MailOutline, Screen.ChampionshipInvitations.route),
        DrawerEntry("Leaderboard", Icons.Default.Leaderboard, Screen.Leaderboard.route),
        DrawerEntry("Daily Challenges", Icons.Default.Today, Screen.DailyChallenges.route),
        DrawerEntry("Game History", Icons.Default.History, Screen.GameHistory.route),
        DrawerEntry("Organizations", Icons.Default.Groups, Screen.Organizations.route),
        DrawerEntry("Referrals", Icons.Default.CardGiftcard, Screen.ReferralDashboard.route),
        // S15: the Ambassador program is 18+ only — hidden for minors and
        // for accounts with no birthday on file yet (fail-closed).
        if (!hideAmbassador) DrawerEntry("Ambassador", Icons.Default.Campaign, Screen.AmbassadorDashboard.route) else null,
        DrawerEntry("My Plan", Icons.Default.WorkspacePremium, Screen.Subscription.route),
    )
    val footer = listOf(
        DrawerEntry("Privacy Policy", Icons.Default.PrivacyTip, Screen.Privacy.route),
        DrawerEntry("Terms of Service", Icons.Default.Description, Screen.Terms.route),
    )

    ModalDrawerSheet {
        Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
            // Branded drawer header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(listOf(ChessGreen, ChessDarkGreen)),
                    )
                    .padding(24.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(R.drawable.ic_launcher_foreground),
                        contentDescription = null,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.15f)),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            "Chess99",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            "Play · Learn · Master",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.85f),
                        )
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            entries.forEach { e ->
                NavigationDrawerItem(
                    icon = { Icon(e.icon, contentDescription = null) },
                    label = { Text(e.label) },
                    selected = false,
                    onClick = { onDestination(e.route) },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            footer.forEach { e ->
                NavigationDrawerItem(
                    icon = { Icon(e.icon, contentDescription = null) },
                    label = { Text(e.label) },
                    selected = false,
                    onClick = { onDestination(e.route) },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            NavigationDrawerItem(
                icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
                label = { Text("Logout") },
                selected = false,
                onClick = onLogout,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun PlayTab(
    modifier: Modifier = Modifier,
    onPlayComputer: () -> Unit,
    onPlayOnline: () -> Unit,
    onPlayOnlineMatchmaking: () -> Unit = onPlayOnline,
    onNavigate: (String) -> Unit,
    onLearn: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Refresh the continue-playing list whenever Home comes back into view
    // (e.g. returning from a game) rather than polling — this section is a
    // point-in-time snapshot, not a live feed.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.refresh()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(uiState.snackbarMessage) {
        uiState.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    // T2: a synthetic-card tap that successfully created a server-recorded
    // game hands off to the multiplayer stack, same as Continue Playing.
    LaunchedEffect(uiState.startedGameId) {
        uiState.startedGameId?.let { gameId ->
            viewModel.consumeStartedGameId()
            onNavigateToGame(gameId)
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            HeroBanner()

            if (uiState.continuePlayingGames.isNotEmpty()) {
                Spacer(Modifier.height(20.dp))
                ContinuePlayingSection(
                    games = uiState.continuePlayingGames,
                    onResume = onNavigateToGame,
                    onDiscard = viewModel::discardGame,
                    onSeeAllInLobby = onPlayOnline,
                )
            }

            Spacer(Modifier.height(20.dp))

            // ── Primary play actions ────────────────────────────────────────
            SectionHeader("Start a game")
            Spacer(Modifier.height(10.dp))
            PrimaryPlayCard(
                title = "Play vs Computer",
                subtitle = "Challenge Stockfish · Levels 1–16",
                icon = Icons.Default.SmartToy,
                gradient = listOf(ChessGreen, ChessDarkGreen),
                onClick = onPlayComputer,
            )
            Spacer(Modifier.height(12.dp))
            PrimaryPlayCard(
                title = "Play Online",
                subtitle = "Real-time games against real players",
                icon = Icons.Default.Public,
                gradient = listOf(Color(0xFFB07D00), Color(0xFF8B5A00)),
                onClick = onPlayOnline,
            )

            // T2: rating-windowed real players + synthetic bots. Offline/error
            // → nearbyOpponents is empty and the section is simply absent —
            // no spinner, no "0 online" badge anywhere (spec T2).
            if (uiState.nearbyOpponents.isNotEmpty()) {
                Spacer(Modifier.height(24.dp))
                NearbyOpponentsSection(
                    opponents = uiState.nearbyOpponents,
                    expanded = uiState.nearbyOpponentsExpanded,
                    onToggleExpanded = viewModel::toggleNearbyOpponentsExpanded,
                    onTapSynthetic = viewModel::startGameVsSynthetic,
                    onTapReal = { onPlayOnlineMatchmaking() },
                )
            }

            Spacer(Modifier.height(24.dp))

            // ── Explore grid ──────────────────────────────────────────────
            SectionHeader("Explore")
            Spacer(Modifier.height(10.dp))

            val actions = listOf(
                QuickAction("Learn", Icons.Default.School, MaterialTheme.colorScheme.primary) { onLearn() },
                QuickAction("Puzzles", Icons.Default.Extension, Color(0xFFB07D00)) { onNavigate(Screen.TacticalTrainer.route) },
                QuickAction("Daily", Icons.Default.Today, Color(0xFF8B4513)) { onNavigate(Screen.DailyChallenges.route) },
                QuickAction("Tournaments", Icons.Default.EmojiEvents, Color(0xFF5A7A42)) { onNavigate(Screen.ChampionshipList.route) },
                QuickAction("Leaderboard", Icons.Default.Leaderboard, Color(0xFFB07D00)) { onNavigate(Screen.Leaderboard.route) },
                QuickAction("History", Icons.Default.History, Color(0xFF6B5B47)) { onNavigate(Screen.GameHistory.route) },
            )
            actions.chunked(2).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    row.forEach { action ->
                        QuickActionTile(action, modifier = Modifier.weight(1f))
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
            }

            Spacer(Modifier.height(8.dp))
        }
        SnackbarHost(hostState = snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

// ── Continue playing ────────────────────────────────────────────────────

private const val MAX_CONTINUE_PLAYING_CARDS = 2

@Composable
private fun ContinuePlayingSection(
    games: List<ContinuePlayingGame>,
    onResume: (Int) -> Unit,
    onDiscard: (Int) -> Unit,
    onSeeAllInLobby: () -> Unit,
) {
    Column {
        SectionHeader("Continue playing")
        Spacer(Modifier.height(10.dp))
        games.take(MAX_CONTINUE_PLAYING_CARDS).forEach { game ->
            ContinuePlayingCard(game = game, onResume = onResume, onDiscard = onDiscard)
            Spacer(Modifier.height(12.dp))
        }
        if (games.size > MAX_CONTINUE_PLAYING_CARDS) {
            TextButton(onClick = onSeeAllInLobby) {
                Text("See all in Lobby")
            }
        }
    }
}

@Composable
private fun ContinuePlayingCard(
    game: ContinuePlayingGame,
    onResume: (Int) -> Unit,
    onDiscard: (Int) -> Unit,
) {
    var showDiscardConfirm by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "vs ${game.opponentName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                GameStatusChip(status = game.status)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Playing as ${if (game.playingAsWhite) "White" else "Black"} · ${formatLastMove(game.lastMoveAtIso)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onResume(game.id) }) {
                    Text("Resume")
                }
                if (game.canDiscard) {
                    OutlinedButton(onClick = { showDiscardConfirm = true }) {
                        Text("Discard")
                    }
                }
            }
        }
    }

    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            title = { Text("Discard this game?") },
            text = { Text("This will end the game with no rating impact.") },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardConfirm = false
                    onDiscard(game.id)
                }) {
                    Text("Discard")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardConfirm = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun GameStatusChip(status: String) {
    val (containerColor, contentColor, label) = when (status) {
        "active" -> Triple(
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer,
            "Active",
        )
        "paused" -> Triple(
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer,
            "Paused",
        )
        else -> Triple(
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer,
            "Waiting",
        )
    }
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = containerColor,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = contentColor,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

// ── Nearby Opponents (T2) ───────────────────────────────────────────────

private const val NEARBY_OPPONENTS_COLLAPSED_COUNT = 3

@Composable
private fun NearbyOpponentsSection(
    opponents: List<NearbyOpponent>,
    expanded: Boolean,
    onToggleExpanded: () -> Unit,
    onTapSynthetic: (NearbyOpponent) -> Unit,
    onTapReal: (NearbyOpponent) -> Unit,
) {
    Column {
        SectionHeader("Nearby Opponents")
        Spacer(Modifier.height(10.dp))
        val visible = if (expanded) opponents else opponents.take(NEARBY_OPPONENTS_COLLAPSED_COUNT)
        visible.forEach { opponent ->
            NearbyOpponentCard(
                opponent = opponent,
                onClick = {
                    if (opponent.isSynthetic) onTapSynthetic(opponent) else onTapReal(opponent)
                },
            )
            Spacer(Modifier.height(10.dp))
        }
        if (opponents.size > NEARBY_OPPONENTS_COLLAPSED_COUNT) {
            TextButton(onClick = onToggleExpanded) {
                Text(if (expanded) "Show less" else "Show ${opponents.size - NEARBY_OPPONENTS_COLLAPSED_COUNT} more")
            }
        }
    }
}

@Composable
private fun NearbyOpponentCard(opponent: NearbyOpponent, onClick: () -> Unit) {
    // Real in_game players are shown but not tappable to challenge (spec T2).
    val clickable = !(opponent.inGame && !opponent.isSynthetic)

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = 1.dp,
        modifier = Modifier
            .fillMaxWidth()
            .let { if (clickable) it.clickable(onClick = onClick) else it },
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    opponent.name.take(1).uppercase(),
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(opponent.name, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface)
                Text(
                    "Rating: ${opponent.rating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            NearbyOpponentStatusDot(opponent)
        }
    }
}

@Composable
private fun NearbyOpponentStatusDot(opponent: NearbyOpponent) {
    // synthetic → "Available" (green); real in_game → "In game" (amber); else "Online".
    val (dotColor, label) = when {
        opponent.isSynthetic -> MaterialTheme.colorScheme.primary to "Available"
        opponent.inGame -> MaterialTheme.colorScheme.tertiary to "In game"
        else -> MaterialTheme.colorScheme.primary to "Online"
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Formats an ISO-8601 timestamp (as returned by Laravel's `datetime` cast) as relative time. */
private fun formatLastMove(isoTimestamp: String?): String {
    if (isoTimestamp.isNullOrBlank()) return "No moves yet"
    val instant = runCatching { java.time.Instant.parse(isoTimestamp) }.getOrNull()
        ?: return "No moves yet"
    val minutes = java.time.Duration.between(instant, java.time.Instant.now()).toMinutes()
    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 60 * 24 -> "${minutes / 60}h ago"
        else -> "${minutes / (60 * 24)}d ago"
    }
}

private data class QuickAction(
    val label: String,
    val icon: ImageVector,
    val tint: Color,
    val onClick: () -> Unit,
)

@Composable
private fun HeroBanner() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(ChessGreen, ChessDarkGreen)))
            .padding(24.dp),
    ) {
        // Decorative oversized logo bleeding off the right edge
        Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = null,
            modifier = Modifier
                .size(160.dp)
                .align(Alignment.CenterEnd)
                .offset(x = 36.dp),
        )
        Column(modifier = Modifier.align(Alignment.CenterStart)) {
            Text(
                "Welcome back",
                style = MaterialTheme.typography.labelLarge,
                color = Color.White.copy(alpha = 0.85f),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Ready to play?",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Sharpen your game — one move at a time.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.9f),
            )
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.padding(start = 4.dp),
    )
}

@Composable
private fun PrimaryPlayCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    gradient: List<Color>,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(gradient))
            .clickable(onClick = onClick)
            .padding(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.9f),
                )
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.9f),
            )
        }
    }
}

@Composable
private fun QuickActionTile(action: QuickAction, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.clickable(onClick = action.onClick),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp, horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(action.tint.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(action.icon, contentDescription = null, tint = action.tint, modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(
                action.label,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 15.sp,
            )
        }
    }
}
