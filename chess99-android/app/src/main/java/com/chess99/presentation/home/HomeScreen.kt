package com.chess99.presentation.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chess99.presentation.navigation.Screen
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
    onNavigateToLearn: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
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
            )
        }
    }
}

private data class DrawerEntry(val label: String, val icon: ImageVector, val route: String)

@Composable
private fun AppDrawer(
    onDestination: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val entries = listOf(
        DrawerEntry("Dashboard", Icons.Default.Dashboard, Screen.Dashboard.route),
        DrawerEntry("Championships", Icons.Default.EmojiEvents, Screen.ChampionshipList.route),
        DrawerEntry("Tournament Invites", Icons.Default.MailOutline, Screen.ChampionshipInvitations.route),
        DrawerEntry("Leaderboard", Icons.Default.Leaderboard, Screen.Leaderboard.route),
        DrawerEntry("Daily Challenges", Icons.Default.Today, Screen.DailyChallenges.route),
        DrawerEntry("Game History", Icons.Default.History, Screen.GameHistory.route),
        DrawerEntry("Organizations", Icons.Default.Groups, Screen.Organizations.route),
        DrawerEntry("Referrals", Icons.Default.CardGiftcard, Screen.ReferralDashboard.route),
        DrawerEntry("Ambassador", Icons.Default.Campaign, Screen.AmbassadorDashboard.route),
        DrawerEntry("E-Book: 0 to 1000", Icons.AutoMirrored.Filled.MenuBook, Screen.Ebook.route),
        DrawerEntry("Pricing & Plans", Icons.Default.WorkspacePremium, Screen.Pricing.route),
    )
    val footer = listOf(
        DrawerEntry("Privacy Policy", Icons.Default.PrivacyTip, Screen.Privacy.route),
        DrawerEntry("Terms of Service", Icons.Default.Description, Screen.Terms.route),
    )

    ModalDrawerSheet {
        Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
            Spacer(Modifier.height(12.dp))
            Text(
                "Chess99",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 28.dp, vertical = 16.dp),
            )
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
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Ready to Play?",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Play vs Computer
        ElevatedCard(
            onClick = onPlayComputer,
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.Computer,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        "Play vs Computer",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "Challenge Stockfish AI (Levels 1-16)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Play Online
        ElevatedCard(
            onClick = onPlayOnline,
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.Wifi,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.secondary,
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        "Play Online",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "Challenge other players in real-time",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
