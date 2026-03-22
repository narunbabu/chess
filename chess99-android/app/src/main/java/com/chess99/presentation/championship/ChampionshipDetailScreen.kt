package com.chess99.presentation.championship

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ChampionshipApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import androidx.hilt.navigation.compose.hiltViewModel

// ── ViewModel ──────────────────────────────────────────────────────────

@HiltViewModel
class ChampionshipDetailViewModel @Inject constructor(
    private val championshipApi: ChampionshipApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChampionshipDetailUiState())
    val uiState: StateFlow<ChampionshipDetailUiState> = _uiState.asStateFlow()

    fun loadChampionship(id: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                // Load detail + tabs in parallel
                launch { loadDetail(id) }
                launch { loadParticipants(id) }
                launch { loadStandings(id) }
                launch { loadMatches(id) }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load championship $id")
            }
        }
    }

    private suspend fun loadDetail(id: Int) {
        try {
            val response = championshipApi.getChampionship(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val c = body.getAsJsonObject("championship") ?: body
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    championship = ChampionshipDetail(
                        id = c.get("id")?.asInt ?: id,
                        name = c.get("name")?.asString ?: "",
                        description = c.get("description")?.asString ?: "",
                        format = c.get("format")?.asString ?: "swiss",
                        status = c.get("status")?.asString ?: "upcoming",
                        timeControl = c.get("time_control")?.asString ?: "10|0",
                        maxParticipants = c.get("max_participants")?.asInt ?: 0,
                        currentParticipants = c.get("current_participants")?.asInt
                            ?: c.get("participants_count")?.asInt ?: 0,
                        entryFee = c.get("entry_fee")?.asInt ?: 0,
                        prizePool = c.get("prize_pool")?.asInt ?: 0,
                        startDate = c.get("start_date")?.asString,
                        endDate = c.get("end_date")?.asString,
                        totalRounds = c.get("total_rounds")?.asInt ?: c.get("rounds")?.asInt ?: 0,
                        currentRound = c.get("current_round")?.asInt ?: 0,
                        creatorName = c.get("creator_name")?.asString
                            ?: c.getAsJsonObject("creator")?.get("name")?.asString ?: "",
                        isRegistered = c.get("is_registered")?.asBoolean ?: false,
                    ),
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to load tournament (${response.code()})",
                )
            }
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = "Network error: ${e.message}",
            )
        }
    }

    private suspend fun loadParticipants(id: Int) {
        try {
            val response = championshipApi.getParticipants(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val arr = body.getAsJsonArray("participants")
                    ?: body.getAsJsonArray("data") ?: return
                val participants = arr.mapNotNull { el ->
                    try {
                        val p = el.asJsonObject
                        Participant(
                            userId = p.get("user_id")?.asInt ?: p.get("id")?.asInt ?: return@mapNotNull null,
                            name = p.get("name")?.asString
                                ?: p.getAsJsonObject("user")?.get("name")?.asString ?: "",
                            rating = p.get("rating")?.asInt
                                ?: p.getAsJsonObject("user")?.get("rating")?.asInt ?: 1200,
                            avatarUrl = p.get("avatar_url")?.asString,
                            seed = p.get("seed")?.asInt,
                        )
                    } catch (_: Exception) { null }
                }
                _uiState.value = _uiState.value.copy(participants = participants)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load participants")
        }
    }

    private suspend fun loadStandings(id: Int) {
        try {
            val response = championshipApi.getStandings(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val arr = body.getAsJsonArray("standings")
                    ?: body.getAsJsonArray("data") ?: return
                val standings = arr.mapNotNull { el ->
                    try {
                        val s = el.asJsonObject
                        Standing(
                            rank = s.get("rank")?.asInt ?: s.get("position")?.asInt ?: 0,
                            name = s.get("name")?.asString
                                ?: s.getAsJsonObject("user")?.get("name")?.asString ?: "",
                            points = s.get("points")?.asFloat ?: s.get("score")?.asFloat ?: 0f,
                            wins = s.get("wins")?.asInt ?: 0,
                            losses = s.get("losses")?.asInt ?: 0,
                            draws = s.get("draws")?.asInt ?: 0,
                            rating = s.get("rating")?.asInt ?: 1200,
                            buchholz = s.get("buchholz")?.asFloat ?: s.get("tiebreak")?.asFloat,
                        )
                    } catch (_: Exception) { null }
                }
                _uiState.value = _uiState.value.copy(standings = standings)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load standings")
        }
    }

    private suspend fun loadMatches(id: Int) {
        try {
            val response = championshipApi.getMatches(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val arr = body.getAsJsonArray("matches")
                    ?: body.getAsJsonArray("data") ?: return
                val matches = arr.mapNotNull { el ->
                    try {
                        val m = el.asJsonObject
                        ChampionshipMatch(
                            id = m.get("id")?.asInt ?: return@mapNotNull null,
                            round = m.get("round")?.asInt ?: 1,
                            whiteName = m.get("white_name")?.asString
                                ?: m.getAsJsonObject("white_player")?.get("name")?.asString ?: "TBD",
                            blackName = m.get("black_name")?.asString
                                ?: m.getAsJsonObject("black_player")?.get("name")?.asString ?: "TBD",
                            whiteRating = m.get("white_rating")?.asInt
                                ?: m.getAsJsonObject("white_player")?.get("rating")?.asInt,
                            blackRating = m.get("black_rating")?.asInt
                                ?: m.getAsJsonObject("black_player")?.get("rating")?.asInt,
                            result = m.get("result")?.asString,
                            status = m.get("status")?.asString ?: "pending",
                            gameId = m.get("game_id")?.asInt,
                        )
                    } catch (_: Exception) { null }
                }
                _uiState.value = _uiState.value.copy(matches = matches)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load matches")
        }
    }

    fun selectTab(tab: DetailTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

// ── UI State ────────────────────────────────────────────────────────────

data class ChampionshipDetailUiState(
    val isLoading: Boolean = false,
    val championship: ChampionshipDetail? = null,
    val selectedTab: DetailTab = DetailTab.OVERVIEW,
    val participants: List<Participant> = emptyList(),
    val standings: List<Standing> = emptyList(),
    val matches: List<ChampionshipMatch> = emptyList(),
    val error: String? = null,
)

enum class DetailTab { OVERVIEW, PARTICIPANTS, STANDINGS, MATCHES }

data class ChampionshipDetail(
    val id: Int,
    val name: String,
    val description: String,
    val format: String,
    val status: String,
    val timeControl: String,
    val maxParticipants: Int,
    val currentParticipants: Int,
    val entryFee: Int,
    val prizePool: Int,
    val startDate: String?,
    val endDate: String?,
    val totalRounds: Int,
    val currentRound: Int,
    val creatorName: String,
    val isRegistered: Boolean,
)

data class Participant(
    val userId: Int,
    val name: String,
    val rating: Int,
    val avatarUrl: String?,
    val seed: Int?,
)

data class Standing(
    val rank: Int,
    val name: String,
    val points: Float,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val rating: Int,
    val buchholz: Float?,
)

data class ChampionshipMatch(
    val id: Int,
    val round: Int,
    val whiteName: String,
    val blackName: String,
    val whiteRating: Int?,
    val blackRating: Int?,
    val result: String?,
    val status: String,
    val gameId: Int?,
)

// ── Screen Composable ──────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChampionshipDetailScreen(
    championshipId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToGame: (Int) -> Unit,
    viewModel: ChampionshipDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(championshipId) {
        viewModel.loadChampionship(championshipId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.championship?.name ?: "Tournament",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadChampionship(championshipId) }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoading && state.championship == null) {
            Box(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            // Tabs
            TabRow(selectedTabIndex = state.selectedTab.ordinal) {
                Tab(
                    selected = state.selectedTab == DetailTab.OVERVIEW,
                    onClick = { viewModel.selectTab(DetailTab.OVERVIEW) },
                    text = { Text("Overview") },
                )
                Tab(
                    selected = state.selectedTab == DetailTab.PARTICIPANTS,
                    onClick = { viewModel.selectTab(DetailTab.PARTICIPANTS) },
                    text = { Text("Players") },
                )
                Tab(
                    selected = state.selectedTab == DetailTab.STANDINGS,
                    onClick = { viewModel.selectTab(DetailTab.STANDINGS) },
                    text = { Text("Standings") },
                )
                Tab(
                    selected = state.selectedTab == DetailTab.MATCHES,
                    onClick = { viewModel.selectTab(DetailTab.MATCHES) },
                    text = { Text("Matches") },
                )
            }

            // Tab content
            when (state.selectedTab) {
                DetailTab.OVERVIEW -> OverviewTab(championship = state.championship)
                DetailTab.PARTICIPANTS -> ParticipantsTab(participants = state.participants)
                DetailTab.STANDINGS -> StandingsTab(standings = state.standings)
                DetailTab.MATCHES -> MatchesTab(
                    matches = state.matches,
                    onNavigateToGame = onNavigateToGame,
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

// ── Overview Tab ───────────────────────────────────────────────────────

@Composable
private fun OverviewTab(championship: ChampionshipDetail?) {
    if (championship == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No data available", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Status + format header
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val statusColor = when (championship.status) {
                    "active" -> Color(0xFF4CAF50)
                    "upcoming" -> MaterialTheme.colorScheme.tertiary
                    "completed" -> MaterialTheme.colorScheme.onSurfaceVariant
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        championship.status.replaceFirstChar { it.uppercase() },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = statusColor,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
                SuggestionChip(
                    onClick = {},
                    label = {
                        Text(
                            when (championship.format) {
                                "swiss" -> "Swiss"
                                "elimination" -> "Elimination"
                                "round_robin" -> "Round Robin"
                                else -> championship.format.replaceFirstChar { it.uppercase() }
                            },
                        )
                    },
                )
            }
        }

        // Description
        if (championship.description.isNotBlank()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Description", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(championship.description, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        // Details card
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Details", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    DetailRow("Time Control", championship.timeControl.replace("|", "+"))
                    DetailRow("Participants", "${championship.currentParticipants} / ${championship.maxParticipants}")
                    if (championship.totalRounds > 0) {
                        DetailRow("Rounds", "${championship.currentRound} / ${championship.totalRounds}")
                    }
                    DetailRow("Entry Fee", if (championship.entryFee > 0) "\u20B9${championship.entryFee}" else "Free")
                    if (championship.prizePool > 0) {
                        DetailRow("Prize Pool", "\u20B9${championship.prizePool}")
                    }
                    championship.startDate?.let { DetailRow("Start Date", it) }
                    championship.endDate?.let { DetailRow("End Date", it) }
                    if (championship.creatorName.isNotBlank()) {
                        DetailRow("Organizer", championship.creatorName)
                    }
                }
            }
        }

        // Registration status
        item {
            if (championship.isRegistered) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFF4CAF50).copy(alpha = 0.1f),
                    ),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "You are registered for this tournament",
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

// ── Participants Tab ───────────────────────────────────────────────────

@Composable
private fun ParticipantsTab(participants: List<Participant>) {
    if (participants.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.People,
                    null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("No participants yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
            ) {
                Text(
                    "#",
                    modifier = Modifier.width(32.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Player",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Rating",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider()
        }

        itemsIndexed(participants, key = { _, p -> p.userId }) { index, participant ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${participant.seed ?: (index + 1)}",
                    modifier = Modifier.width(32.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    participant.name,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    "${participant.rating}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
        }
    }
}

// ── Standings Tab ──────────────────────────────────────────────────────

@Composable
private fun StandingsTab(standings: List<Standing>) {
    if (standings.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Leaderboard,
                    null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("Standings not available yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        // Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            ) {
                Text("#", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("Player", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                Text("Pts", modifier = Modifier.width(36.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("W", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("D", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("L", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            }
            HorizontalDivider()
        }

        items(standings, key = { it.rank }) { standing ->
            val bgColor = when (standing.rank) {
                1 -> Color(0xFFFFD700).copy(alpha = 0.08f)
                2 -> Color(0xFFC0C0C0).copy(alpha = 0.08f)
                3 -> Color(0xFFCD7F32).copy(alpha = 0.08f)
                else -> Color.Transparent
            }
            Surface(color = bgColor, shape = RoundedCornerShape(4.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${standing.rank}",
                        modifier = Modifier.width(28.dp),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = if (standing.rank <= 3) FontWeight.Bold else FontWeight.Normal,
                        textAlign = TextAlign.Center,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            standing.name,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "${standing.rating}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 10.sp,
                        )
                    }
                    Text(
                        standing.points.let { if (it % 1f == 0f) "${it.toInt()}" else "$it" },
                        modifier = Modifier.width(36.dp),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Text("${standing.wins}", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, color = Color(0xFF4CAF50))
                    Text("${standing.draws}", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${standing.losses}", modifier = Modifier.width(28.dp), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.error)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
        }
    }
}

// ── Matches Tab ────────────────────────────────────────────────────────

@Composable
private fun MatchesTab(
    matches: List<ChampionshipMatch>,
    onNavigateToGame: (Int) -> Unit,
) {
    if (matches.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.SportsEsports,
                    null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("No matches scheduled yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    // Group by round
    val matchesByRound = matches.groupBy { it.round }.toSortedMap()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        matchesByRound.forEach { (round, roundMatches) ->
            item {
                Text(
                    "Round $round",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }
            items(roundMatches, key = { it.id }) { match ->
                MatchCard(match = match, onTap = {
                    match.gameId?.let { onNavigateToGame(it) }
                })
            }
            item { Spacer(modifier = Modifier.height(4.dp)) }
        }
    }
}

@Composable
private fun MatchCard(match: ChampionshipMatch, onTap: () -> Unit) {
    Card(
        onClick = onTap,
        modifier = Modifier.fillMaxWidth(),
        enabled = match.gameId != null,
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // White player
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                Text(
                    match.whiteName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.End,
                )
                match.whiteRating?.let {
                    Text("$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // Result
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(4.dp),
                modifier = Modifier.padding(horizontal = 12.dp),
            ) {
                Text(
                    text = when (match.result) {
                        "1-0" -> "1 - 0"
                        "0-1" -> "0 - 1"
                        "1/2-1/2", "draw" -> "\u00BD - \u00BD"
                        else -> "vs"
                    },
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                )
            }

            // Black player
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    match.blackName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                match.blackRating?.let {
                    Text("$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
