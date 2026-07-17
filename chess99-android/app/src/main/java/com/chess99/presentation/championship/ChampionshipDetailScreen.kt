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
import com.chess99.data.api.bool
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.data.local.TokenManager
import com.chess99.presentation.common.friendlyError
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
    private val tokenManager: TokenManager,
) : ViewModel() {

    private var loadedId: Int = -1

    /** Current logged-in user id, used to identify "my" matches and derive colour. */
    private val currentUserId: Int get() = tokenManager.getUserId()

    private val _uiState = MutableStateFlow(ChampionshipDetailUiState(currentUserId = tokenManager.getUserId()))
    val uiState: StateFlow<ChampionshipDetailUiState> = _uiState.asStateFlow()

    fun loadChampionship(id: Int) {
        loadedId = id
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, currentUserId = currentUserId)
            try {
                // Load detail + tabs in parallel
                launch { loadDetail(id) }
                launch { loadParticipants(id) }
                launch { loadStandings(id) }
                launch { loadMatches(id) }
                launch { loadMyMatches(id) }
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
                // Every accessor goes through the JsonSafe helpers, which guard
                // isJsonPrimitive. Laravel returns some fields as JSON null
                // (end_date), a nested OBJECT (time_control), or a decimal STRING
                // (entry_fee) — a raw .asString/.asInt/.asBoolean throws on those
                // (JsonNull.asString → UnsupportedOperationException), which was
                // failing the entire detail load.
                val c = body.get("championship").objOrNull() ?: body
                val createdBy = c.int("created_by") ?: -1
                val canManage = c.bool("can_manage")
                    ?: c.bool("is_owner")
                    ?: (createdBy != -1 && createdBy == tokenManager.getUserId())
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    championship = ChampionshipDetail(
                        id = c.int("id") ?: id,
                        canManage = canManage,
                        name = c.str("name") ?: c.str("title") ?: "",
                        description = c.str("description") ?: "",
                        format = c.str("format") ?: "swiss",
                        status = c.str("status") ?: "upcoming",
                        // time_control comes back as an OBJECT — fall back to minutes.
                        timeControl = c.str("time_control")
                            ?: c.int("time_control_minutes")?.let { "$it min" } ?: "10|0",
                        maxParticipants = c.int("max_participants") ?: 0,
                        currentParticipants = c.int("current_participants")
                            ?: c.int("participants_count") ?: 0,
                        // entry_fee / prize_pool are decimal strings ("0.00").
                        entryFee = c.get("entry_fee")?.takeIf { it.isJsonPrimitive }
                            ?.runCatching { asDouble.toInt() }?.getOrNull() ?: 0,
                        prizePool = c.get("prize_pool")?.takeIf { it.isJsonPrimitive }
                            ?.runCatching { asDouble.toInt() }?.getOrNull() ?: 0,
                        startDate = c.str("start_date"),
                        endDate = c.str("end_date"),
                        totalRounds = c.int("total_rounds") ?: c.int("rounds") ?: 0,
                        currentRound = c.int("current_round") ?: 0,
                        creatorName = c.str("creator_name")
                            ?: c.get("creator").objOrNull().str("name") ?: "",
                        isRegistered = c.bool("is_registered") ?: false,
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
                error = friendlyError(e, "tournament details"),
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

    /** Parse a match JSON object into the [ChampionshipMatch] model. Tolerant of both
     *  the "all matches" shape (white_player/black_player) and the "my matches" shape
     *  (player1/player2 relations + white_player_id/black_player_id). */
    private fun parseMatch(m: com.google.gson.JsonObject): ChampionshipMatch? {
        val id = m.get("id")?.takeIf { !it.isJsonNull }?.asInt ?: return null

        // Player id resolution (my-matches uses player1_id/player2_id + white/black_player_id).
        val whiteId = m.get("white_player_id")?.takeIf { !it.isJsonNull }?.asInt
            ?: m.getAsJsonObject("white_player")?.get("id")?.takeIf { !it.isJsonNull }?.asInt
        val blackId = m.get("black_player_id")?.takeIf { !it.isJsonNull }?.asInt
            ?: m.getAsJsonObject("black_player")?.get("id")?.takeIf { !it.isJsonNull }?.asInt

        // Resolve player detail objects, honouring player1/player2 fallback used by my-matches.
        val player1 = m.getAsJsonObject("player1")
        val player2 = m.getAsJsonObject("player2")
        val player1Id = m.get("player1_id")?.takeIf { !it.isJsonNull }?.asInt
        fun playerFor(pid: Int?): com.google.gson.JsonObject? = when {
            pid == null -> null
            player1Id != null && pid == player1Id -> player1
            else -> player2
        }
        val whitePlayer = m.getAsJsonObject("white_player") ?: playerFor(whiteId)
        val blackPlayer = m.getAsJsonObject("black_player") ?: playerFor(blackId)

        return ChampionshipMatch(
            id = id,
            round = m.get("round")?.takeIf { !it.isJsonNull }?.asInt
                ?: m.get("round_number")?.takeIf { !it.isJsonNull }?.asInt ?: 1,
            whiteName = m.get("white_name")?.takeIf { !it.isJsonNull }?.asString
                ?: whitePlayer?.get("name")?.takeIf { !it.isJsonNull }?.asString ?: "TBD",
            blackName = m.get("black_name")?.takeIf { !it.isJsonNull }?.asString
                ?: blackPlayer?.get("name")?.takeIf { !it.isJsonNull }?.asString ?: "TBD",
            whiteRating = m.get("white_rating")?.takeIf { !it.isJsonNull }?.asInt
                ?: whitePlayer?.get("rating")?.takeIf { !it.isJsonNull }?.asInt,
            blackRating = m.get("black_rating")?.takeIf { !it.isJsonNull }?.asInt
                ?: blackPlayer?.get("rating")?.takeIf { !it.isJsonNull }?.asInt,
            result = m.get("result")?.takeIf { !it.isJsonNull }?.asString,
            status = m.get("status")?.takeIf { !it.isJsonNull }?.asString ?: "pending",
            gameId = m.get("game_id")?.takeIf { !it.isJsonNull }?.asInt,
            whiteId = whiteId,
            blackId = blackId,
            winnerId = m.get("winner_id")?.takeIf { !it.isJsonNull }?.asInt,
        )
    }

    private suspend fun loadMatches(id: Int) {
        try {
            val response = championshipApi.getMatches(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val arr = body.get("matches")?.takeIf { it.isJsonArray }?.asJsonArray
                    ?: body.get("data")?.takeIf { it.isJsonArray }?.asJsonArray ?: return
                val matches = arr.mapNotNull { el -> try { parseMatch(el.asJsonObject) } catch (_: Exception) { null } }
                _uiState.value = _uiState.value.copy(matches = matches)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load matches")
        }
    }

    private suspend fun loadMyMatches(id: Int) {
        try {
            val response = championshipApi.getMyMatches(id)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                // my-matches may return { matches: [...] } (plain array),
                // { matches: { data: [...] } } (paginated), or { data: [...] }.
                // getAsJsonObject/getAsJsonArray THROW on a type mismatch (they
                // don't return null), so probe the element type first.
                val matchesEl = body.get("matches")
                val arr = when {
                    matchesEl?.isJsonObject == true ->
                        matchesEl.asJsonObject.get("data")?.takeIf { it.isJsonArray }?.asJsonArray
                    matchesEl?.isJsonArray == true -> matchesEl.asJsonArray
                    body.get("data")?.isJsonArray == true -> body.getAsJsonArray("data")
                    else -> null
                } ?: return
                val matches = arr.mapNotNull { el -> try { parseMatch(el.asJsonObject) } catch (_: Exception) { null } }
                _uiState.value = _uiState.value.copy(myMatches = matches)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load my matches")
        }
    }

    /**
     * Create the game for a tournament match and, on success, hand the game id to
     * [onGameReady] so the screen can navigate into it. If a game already exists the
     * backend returns 400; we fall back to the existing game id.
     */
    fun playMatch(match: ChampionshipMatch, onGameReady: (Int) -> Unit) {
        // Already has a game — just resume/open it.
        match.gameId?.let { onGameReady(it); return }
        if (loadedId == -1) return

        val color = when (currentUserId) {
            match.whiteId -> "white"
            match.blackId -> "black"
            else -> "white"
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(creatingGameForMatchId = match.id, manageMessage = null)
            try {
                val body = JsonObject().apply {
                    // Championship time controls map to blitz/rapid/classical; blitz is a safe default.
                    addProperty("time_control", "blitz")
                    addProperty("color", color)
                }
                val response = championshipApi.createGame(loadedId, match.id, body)
                if (response.isSuccessful) {
                    val rb: com.google.gson.JsonObject? = response.body()
                    val matchGameId: com.google.gson.JsonElement? = rb?.getAsJsonObject("match")?.get("game_id")
                    val topGameId: com.google.gson.JsonElement? = rb?.get("game_id")
                    val gameId = matchGameId?.takeIf { !it.isJsonNull }?.asInt
                        ?: topGameId?.takeIf { !it.isJsonNull }?.asInt
                    _uiState.value = _uiState.value.copy(creatingGameForMatchId = null)
                    if (gameId != null) {
                        loadMyMatches(loadedId)
                        onGameReady(gameId)
                    } else {
                        _uiState.value = _uiState.value.copy(manageMessage = "Game created but could not open it. Pull to refresh.")
                    }
                } else {
                    // 400 = game already exists; refresh to pick up its game_id and open it.
                    val msg = when (response.code()) {
                        400 -> "Match not ready to play yet."
                        403 -> "You are not a player in this match."
                        else -> "Couldn't start the game (${response.code()})."
                    }
                    _uiState.value = _uiState.value.copy(creatingGameForMatchId = null, manageMessage = msg)
                    if (response.code() == 400) loadMyMatches(loadedId)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to create game for match ${match.id}")
                _uiState.value = _uiState.value.copy(
                    creatingGameForMatchId = null,
                    manageMessage = friendlyError(e, "starting the game"),
                )
            }
        }
    }

    fun selectTab(tab: DetailTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    // ── Organizer management ────────────────────────────────────────────

    fun generatePairings() = manage { championshipApi.generateFullTournament(loadedId, JsonObject()) }

    fun scheduleNextRound() = manage { championshipApi.scheduleNextRound(loadedId, JsonObject()) }

    fun startTournament() = manage { championshipApi.startChampionship(loadedId) }

    private fun manage(block: suspend () -> retrofit2.Response<JsonObject>) {
        if (loadedId == -1) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isManaging = true, manageMessage = null)
            try {
                val response = block()
                if (response.isSuccessful) {
                    val msg = response.body()?.get("message")?.asString ?: "Done."
                    _uiState.value = _uiState.value.copy(isManaging = false, manageMessage = msg)
                    loadChampionship(loadedId)
                } else {
                    val msg = when (response.code()) {
                        403 -> "You don't have permission to manage this tournament."
                        422 -> "Action not allowed in the current tournament state."
                        else -> "Action failed (${response.code()})."
                    }
                    _uiState.value = _uiState.value.copy(isManaging = false, manageMessage = msg)
                }
            } catch (e: Exception) {
                Timber.e(e, "Tournament management action failed")
                _uiState.value = _uiState.value.copy(isManaging = false, manageMessage = friendlyError(e, "this action"))
            }
        }
    }

    fun clearManageMessage() {
        _uiState.value = _uiState.value.copy(manageMessage = null)
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
    val myMatches: List<ChampionshipMatch> = emptyList(),
    val currentUserId: Int = -1,
    val error: String? = null,
    val isManaging: Boolean = false,
    val manageMessage: String? = null,
    /** Match id we are currently creating a game for (drives the button spinner). */
    val creatingGameForMatchId: Int? = null,
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
    val canManage: Boolean = false,
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
    val whiteId: Int? = null,
    val blackId: Int? = null,
    val winnerId: Int? = null,
) {
    fun involves(userId: Int): Boolean = userId != -1 && (userId == whiteId || userId == blackId)

    /** Opponent display name from the current user's perspective. */
    fun opponentName(userId: Int): String = if (userId == whiteId) blackName else whiteName

    val isFinished: Boolean
        get() = status.equals("completed", true) ||
            status.equals("finished", true) ||
            status.equals("cancelled", true) ||
            status.equals("expired", true) ||
            result != null

    /** True when a player can create/open the game (paired, not finished). */
    val isPlayable: Boolean
        get() = !isFinished && whiteId != null && blackId != null

    /** Result from the current user's perspective: "Won" / "Lost" / "Draw" / null. */
    fun myResultLabel(userId: Int): String? = when {
        !isFinished -> null
        result == "draw" || result == "1/2-1/2" -> "Draw"
        winnerId == null -> "Draw"
        winnerId == userId -> "Won"
        else -> "Lost"
    }
}

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
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(championshipId) {
        viewModel.loadChampionship(championshipId)
    }

    LaunchedEffect(state.manageMessage) {
        state.manageMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearManageMessage()
        }
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
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                DetailTab.OVERVIEW -> OverviewTab(
                    championship = state.championship,
                    isManaging = state.isManaging,
                    onGeneratePairings = { viewModel.generatePairings() },
                    onScheduleNextRound = { viewModel.scheduleNextRound() },
                    onStartTournament = { viewModel.startTournament() },
                )
                DetailTab.PARTICIPANTS -> ParticipantsTab(participants = state.participants)
                DetailTab.STANDINGS -> StandingsTab(standings = state.standings)
                DetailTab.MATCHES -> MatchesTab(
                    allMatches = state.matches,
                    myMatches = state.myMatches,
                    currentUserId = state.currentUserId,
                    creatingGameForMatchId = state.creatingGameForMatchId,
                    onNavigateToGame = onNavigateToGame,
                    onPlayMatch = { match -> viewModel.playMatch(match, onNavigateToGame) },
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
private fun OverviewTab(
    championship: ChampionshipDetail?,
    isManaging: Boolean = false,
    onGeneratePairings: () -> Unit = {},
    onScheduleNextRound: () -> Unit = {},
    onStartTournament: () -> Unit = {},
) {
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

        // Organizer controls (only shown to the tournament organizer)
        if (championship.canManage) {
            item {
                OrganizerControls(
                    status = championship.status,
                    isManaging = isManaging,
                    onGeneratePairings = onGeneratePairings,
                    onScheduleNextRound = onScheduleNextRound,
                    onStartTournament = onStartTournament,
                )
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
private fun OrganizerControls(
    status: String,
    isManaging: Boolean,
    onGeneratePairings: () -> Unit,
    onScheduleNextRound: () -> Unit,
    onStartTournament: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Settings, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Organizer controls", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            Text(
                "Manage your tournament. Generate the bracket, schedule rounds, and start play.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (isManaging) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            OutlinedButton(
                onClick = onGeneratePairings,
                enabled = !isManaging,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Generate pairings") }

            OutlinedButton(
                onClick = onScheduleNextRound,
                enabled = !isManaging,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Schedule next round") }

            if (status.equals("upcoming", ignoreCase = true) ||
                status.equals("registration", ignoreCase = true)
            ) {
                Button(
                    onClick = onStartTournament,
                    enabled = !isManaging,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Start tournament") }
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

private enum class MatchesFilter { MINE, ALL }

@Composable
private fun MatchesTab(
    allMatches: List<ChampionshipMatch>,
    myMatches: List<ChampionshipMatch>,
    currentUserId: Int,
    creatingGameForMatchId: Int?,
    onNavigateToGame: (Int) -> Unit,
    onPlayMatch: (ChampionshipMatch) -> Unit,
) {
    val signedIn = currentUserId != -1
    // Prefer the dedicated my-matches list; fall back to filtering all matches by user id.
    val minePrimary = myMatches.ifEmpty { allMatches.filter { it.involves(currentUserId) } }
    var filter by remember(signedIn) { mutableStateOf(if (signedIn) MatchesFilter.MINE else MatchesFilter.ALL) }

    Column(modifier = Modifier.fillMaxSize()) {
        if (signedIn) {
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                SegmentedButton(
                    selected = filter == MatchesFilter.MINE,
                    onClick = { filter = MatchesFilter.MINE },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                ) { Text("My Matches") }
                SegmentedButton(
                    selected = filter == MatchesFilter.ALL,
                    onClick = { filter = MatchesFilter.ALL },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                ) { Text("All Matches") }
            }
        }

        val matches = if (filter == MatchesFilter.MINE) minePrimary else allMatches
        val showActions = filter == MatchesFilter.MINE

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
                    Text(
                        if (filter == MatchesFilter.MINE) "No matches yet" else "No matches scheduled yet",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (filter == MatchesFilter.MINE) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Once the tournament starts and you're paired, your games will show up here.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp),
                        )
                    }
                }
            }
            return
        }

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
                    MatchCard(
                        match = match,
                        currentUserId = currentUserId,
                        showActions = showActions,
                        isCreatingGame = creatingGameForMatchId == match.id,
                        onOpenGame = { match.gameId?.let(onNavigateToGame) },
                        onPlay = { onPlayMatch(match) },
                    )
                }
                item { Spacer(modifier = Modifier.height(4.dp)) }
            }
        }
    }
}

@Composable
private fun MatchCard(
    match: ChampionshipMatch,
    currentUserId: Int,
    showActions: Boolean,
    isCreatingGame: Boolean,
    onOpenGame: () -> Unit,
    onPlay: () -> Unit,
) {
    val isMine = match.involves(currentUserId)
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // White player
                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                    Text(
                        match.whiteName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (currentUserId == match.whiteId) FontWeight.Bold else FontWeight.Medium,
                        color = if (currentUserId == match.whiteId) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.End,
                    )
                    match.whiteRating?.let {
                        Text("$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                // Result / vs
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
                        fontWeight = if (currentUserId == match.blackId) FontWeight.Bold else FontWeight.Medium,
                        color = if (currentUserId == match.blackId) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    match.blackRating?.let {
                        Text("$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // Status + my-result line
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MatchStatusChip(match.status)
                match.myResultLabel(currentUserId)?.let { label ->
                    val color = when (label) {
                        "Won" -> Color(0xFF4CAF50)
                        "Lost" -> MaterialTheme.colorScheme.error
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    Text(
                        "You: $label",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = color,
                    )
                }
            }

            // Player action row (only for the current user's matches)
            if (showActions && isMine) {
                Spacer(modifier = Modifier.height(10.dp))
                when {
                    // Finished with a game to review.
                    match.isFinished && match.gameId != null -> {
                        OutlinedButton(onClick = onOpenGame, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.Visibility, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Review game")
                        }
                    }
                    match.isFinished -> { /* No game object to open; result shown above. */ }
                    // Game exists \u2014 resume / go to it.
                    match.gameId != null -> {
                        Button(onClick = onOpenGame, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Go to game")
                        }
                    }
                    // No game yet \u2014 create and start.
                    match.isPlayable -> {
                        Button(
                            onClick = onPlay,
                            enabled = !isCreatingGame,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (isCreatingGame) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Spacer(Modifier.width(6.dp))
                                Text("Starting\u2026")
                            } else {
                                Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Play")
                            }
                        }
                    }
                    else -> {
                        Text(
                            "Waiting for pairing\u2026",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MatchStatusChip(status: String) {
    val (label, color) = when (status.lowercase()) {
        "completed", "finished" -> "Completed" to MaterialTheme.colorScheme.onSurfaceVariant
        "in_progress", "active" -> "In progress" to Color(0xFF4CAF50)
        "scheduled" -> "Scheduled" to MaterialTheme.colorScheme.tertiary
        "cancelled" -> "Cancelled" to MaterialTheme.colorScheme.onSurfaceVariant
        "expired" -> "Expired" to MaterialTheme.colorScheme.error
        else -> "Pending" to MaterialTheme.colorScheme.tertiary
    }
    Surface(color = color.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp)) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = color,
        )
    }
}
