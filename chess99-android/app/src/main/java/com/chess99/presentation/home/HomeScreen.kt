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
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowForward
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
import androidx.compose.ui.res.stringResource
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
import com.chess99.presentation.theme.ChessActionGreen
import com.chess99.presentation.theme.ChessDarkGreen
import com.chess99.presentation.theme.ChessGreen
import kotlinx.coroutines.launch

/**
 * Home is the compact Play landing screen. The route-derived four-destination
 * bar is owned by NavGraph so selected state always matches visible content.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToPlayComputer: () -> Unit,
    onNavigateToLobby: () -> Unit,
    /** T2: a Nearby Opponents real-player tap — opens Lobby directly on Matchmaking. */
    onNavigateToLobbyMatchmaking: () -> Unit = onNavigateToLobby,
    onNavigateToLearn: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
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
                    homeViewModel.logout(onLogout)
                },
            )
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.app_name), fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = stringResource(R.string.a11y_menu))
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.primary,
                    ),
                )
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

private data class DrawerEntry(
    @androidx.annotation.StringRes val labelRes: Int,
    val icon: ImageVector,
    val route: String,
)

@Composable
private fun AppDrawer(
    hideAmbassador: Boolean,
    onDestination: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val entries = listOfNotNull(
        DrawerEntry(R.string.drawer_dashboard, Icons.Default.Dashboard, Screen.Dashboard.route),
        DrawerEntry(R.string.drawer_championships, Icons.Default.EmojiEvents, Screen.ChampionshipList.route),
        DrawerEntry(R.string.drawer_tournament_invites, Icons.Default.MailOutline, Screen.ChampionshipInvitations.route),
        DrawerEntry(R.string.drawer_leaderboard, Icons.Default.Leaderboard, Screen.Leaderboard.route),
        DrawerEntry(R.string.drawer_daily_challenges, Icons.Default.Today, Screen.DailyChallenges.route),
        DrawerEntry(R.string.drawer_game_history, Icons.Default.History, Screen.GameHistory.route),
        DrawerEntry(R.string.drawer_organizations, Icons.Default.Groups, Screen.Organizations.route),
        DrawerEntry(R.string.drawer_referrals, Icons.Default.CardGiftcard, Screen.ReferralDashboard.route),
        // S15: the Ambassador program is 18+ only — hidden for minors and
        // for accounts with no birthday on file yet (fail-closed).
        if (!hideAmbassador) DrawerEntry(R.string.drawer_ambassador, Icons.Default.Campaign, Screen.AmbassadorDashboard.route) else null,
        DrawerEntry(R.string.drawer_my_plan, Icons.Default.WorkspacePremium, Screen.Subscription.route),
    )
    val footer = listOf(
        DrawerEntry(R.string.drawer_privacy, Icons.Default.PrivacyTip, Screen.Privacy.route),
        DrawerEntry(R.string.drawer_terms, Icons.Default.Description, Screen.Terms.route),
        DrawerEntry(R.string.drawer_licenses, Icons.Default.Code, Screen.OpenSourceLicenses.route),
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
                            stringResource(R.string.app_name),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            stringResource(R.string.home_tagline),
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
                    label = { Text(stringResource(e.labelRes)) },
                    selected = false,
                    onClick = { onDestination(e.route) },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            footer.forEach { e ->
                NavigationDrawerItem(
                    icon = { Icon(e.icon, contentDescription = null) },
                    label = { Text(stringResource(e.labelRes)) },
                    selected = false,
                    onClick = { onDestination(e.route) },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            NavigationDrawerItem(
                icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
                label = { Text(stringResource(R.string.drawer_logout)) },
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
            if (uiState.continuePlayingGames.isNotEmpty()) {
                ContinuePlayingSection(
                    games = uiState.continuePlayingGames,
                    onResume = onNavigateToGame,
                    onDiscard = viewModel::discardGame,
                    onSeeAllInLobby = onPlayOnline,
                )
                Spacer(Modifier.height(16.dp))
            }

            if (uiState.resumeLoadFailed) {
                ResumeLoadError(
                    hasCachedGames = uiState.continuePlayingGames.isNotEmpty(),
                    onRetry = viewModel::refresh,
                )
                Spacer(Modifier.height(16.dp))
            } else if (uiState.isResumeLoading && uiState.continuePlayingGames.isEmpty()) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(16.dp))
            }

            // ── Primary play actions ────────────────────────────────────────
            SectionHeader(stringResource(R.string.home_start_a_game))
            Spacer(Modifier.height(10.dp))
            PrimaryPlayCard(
                title = stringResource(R.string.home_play_computer_title),
                subtitle = stringResource(R.string.home_play_computer_subtitle),
                icon = Icons.Default.SmartToy,
                gradient = listOf(ChessActionGreen, ChessDeepActionGreen),
                onClick = onPlayComputer,
            )
            Spacer(Modifier.height(12.dp))
            PrimaryPlayCard(
                title = stringResource(R.string.home_play_online_title),
                subtitle = stringResource(R.string.home_play_online_subtitle),
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
            SectionHeader(stringResource(R.string.home_keep_going))
            Spacer(Modifier.height(10.dp))

            val actions = listOf(
                QuickAction(R.string.home_continue_learning, Icons.Default.School, MaterialTheme.colorScheme.primary) { onLearn() },
                QuickAction(R.string.home_progress, Icons.AutoMirrored.Filled.ShowChart, Color(0xFF5A7A42)) { onNavigate(Screen.Progress.route) },
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
private fun ResumeLoadError(hasCachedGames: Boolean, onRetry: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(
                    if (hasCachedGames) R.string.home_resume_error_cached
                    else R.string.home_resume_error
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onRetry) { Text(stringResource(R.string.action_retry)) }
        }
    }
}

@Composable
private fun ContinuePlayingSection(
    games: List<ContinuePlayingGame>,
    onResume: (Int) -> Unit,
    onDiscard: (Int) -> Unit,
    onSeeAllInLobby: () -> Unit,
) {
    Column {
        SectionHeader(stringResource(R.string.home_continue_playing))
        Spacer(Modifier.height(10.dp))
        games.take(MAX_CONTINUE_PLAYING_CARDS).forEach { game ->
            ContinuePlayingCard(game = game, onResume = onResume, onDiscard = onDiscard)
            Spacer(Modifier.height(12.dp))
        }
        if (games.size > MAX_CONTINUE_PLAYING_CARDS) {
            TextButton(onClick = onSeeAllInLobby) {
                Text(stringResource(R.string.home_see_all_in_lobby))
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
                    text = stringResource(R.string.home_vs_opponent, game.opponentName),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                GameStatusChip(status = game.status)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(
                    R.string.home_playing_as,
                    stringResource(
                        if (game.playingAsWhite) R.string.color_white_name
                        else R.string.color_black_name
                    ),
                    formatLastMove(game.lastMoveAtIso),
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onResume(game.id) }) {
                    Text(stringResource(R.string.action_resume))
                }
                if (game.canDiscard) {
                    OutlinedButton(onClick = { showDiscardConfirm = true }) {
                        Text(stringResource(R.string.home_discard))
                    }
                }
            }
        }
    }

    if (showDiscardConfirm) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirm = false },
            title = { Text(stringResource(R.string.home_discard_title)) },
            text = { Text(stringResource(R.string.home_discard_body)) },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardConfirm = false
                    onDiscard(game.id)
                }) {
                    Text(stringResource(R.string.home_discard))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardConfirm = false }) {
                    Text(stringResource(R.string.action_cancel))
                }
            },
        )
    }
}

@Composable
private fun GameStatusChip(status: String) {
    val (containerColor, contentColor, labelRes) = when (status) {
        "active" -> Triple(
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer,
            R.string.home_status_active,
        )
        "paused" -> Triple(
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer,
            R.string.home_status_paused,
        )
        else -> Triple(
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer,
            R.string.home_status_waiting,
        )
    }
    val label = stringResource(labelRes)
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
        SectionHeader(stringResource(R.string.home_nearby_title))
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
                Text(
                    if (expanded) {
                        stringResource(R.string.home_show_less)
                    } else {
                        stringResource(
                            R.string.home_show_more,
                            opponents.size - NEARBY_OPPONENTS_COLLAPSED_COUNT,
                        )
                    }
                )
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
                    stringResource(R.string.lobby_player_rating, opponent.rating),
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
    // Computer availability is labelled explicitly and never counted as a
    // human online player.
    val (dotColor, labelRes) = when {
        opponent.isSynthetic ->
            MaterialTheme.colorScheme.primary to R.string.home_status_computer_available
        opponent.inGame -> MaterialTheme.colorScheme.tertiary to R.string.home_status_in_game
        else -> MaterialTheme.colorScheme.primary to R.string.home_status_online
    }
    val label = stringResource(labelRes)
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
@Composable
private fun formatLastMove(isoTimestamp: String?): String {
    if (isoTimestamp.isNullOrBlank()) return stringResource(R.string.home_no_moves_yet)
    val instant = runCatching { java.time.Instant.parse(isoTimestamp) }.getOrNull()
        ?: return stringResource(R.string.home_no_moves_yet)
    val minutes = java.time.Duration.between(instant, java.time.Instant.now()).toMinutes()
    return when {
        minutes < 1 -> stringResource(R.string.home_just_now)
        minutes < 60 -> stringResource(R.string.home_minutes_ago, minutes)
        minutes < 60 * 24 -> stringResource(R.string.home_hours_ago, minutes / 60)
        else -> stringResource(R.string.home_days_ago, minutes / (60 * 24))
    }
}

private data class QuickAction(
    @androidx.annotation.StringRes val labelRes: Int,
    val icon: ImageVector,
    val tint: Color,
    val onClick: () -> Unit,
)

private val ChessDeepActionGreen = Color(0xFF2E3D1E)

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
                stringResource(R.string.home_hero_welcome),
                style = MaterialTheme.typography.labelLarge,
                color = Color.White.copy(alpha = 0.85f),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                stringResource(R.string.home_hero_ready),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.home_hero_body),
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
                stringResource(action.labelRes),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 15.sp,
            )
        }
    }
}
