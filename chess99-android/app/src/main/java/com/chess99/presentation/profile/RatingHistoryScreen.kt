package com.chess99.presentation.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ProfileApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject

data class RatingGameEntry(
    val id: Int,
    val opponent: String,
    val result: String,
    val ratingChange: Int,
    val newRating: Int,
    val gameType: String, // "computer" or "multiplayer"
    val createdAt: String,
)

data class RatingStats(
    val currentRating: Int,
    val highestRating: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val averageChange: Int,
    val currentStreakCount: Int,
    val currentStreakType: String, // "win", "loss", "draw"
)

@HiltViewModel
class RatingHistoryViewModel @Inject constructor(
    private val profileApi: ProfileApi,
) : ViewModel() {

    data class State(
        val isLoading: Boolean = true,
        val error: String? = null,
        val history: List<RatingGameEntry> = emptyList(),
        val stats: RatingStats? = null,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val response = profileApi.getRatingHistory()
                if (!response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, error = "Failed to load") }
                    return@launch
                }

                val body = response.body()
                val data = body?.getAsJsonObject("data") ?: body

                // Parse history
                val historyArray = data?.getAsJsonArray("history")
                val entries = historyArray?.mapNotNull { element ->
                    val obj = element.asJsonObject
                    val opponent = if (obj.get("game_type")?.asString == "computer") {
                        "Computer Lv ${obj.get("computer_level")?.asInt ?: "?"}"
                    } else {
                        obj.getAsJsonObject("opponent")?.get("name")?.asString ?: "Unknown"
                    }
                    RatingGameEntry(
                        id = obj.get("id")?.asInt ?: return@mapNotNull null,
                        opponent = opponent,
                        result = obj.get("result")?.asString ?: "",
                        ratingChange = obj.get("rating_change")?.asInt ?: 0,
                        newRating = obj.get("new_rating")?.asInt ?: 0,
                        gameType = obj.get("game_type")?.asString ?: "multiplayer",
                        createdAt = obj.get("created_at")?.asString ?: "",
                    )
                } ?: emptyList()

                // Parse stats
                val statsObj = data?.getAsJsonObject("stats")
                val stats = if (statsObj != null) {
                    val streakObj = statsObj.getAsJsonObject("current_streak")
                    RatingStats(
                        currentRating = statsObj.get("current_rating")?.asInt ?: 1200,
                        highestRating = statsObj.get("highest_rating")?.asInt ?: 1200,
                        wins = statsObj.get("wins")?.asInt ?: 0,
                        draws = statsObj.get("draws")?.asInt ?: 0,
                        losses = statsObj.get("losses")?.asInt ?: 0,
                        averageChange = statsObj.get("average_rating_change")?.asDouble?.toInt() ?: 0,
                        currentStreakCount = streakObj?.get("count")?.asInt ?: 0,
                        currentStreakType = streakObj?.get("type")?.asString ?: "",
                    )
                } else null

                _state.update { it.copy(isLoading = false, history = entries, stats = stats) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RatingHistoryScreen(
    onNavigateBack: () -> Unit,
    viewModel: RatingHistoryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadHistory()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rating History") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text(state.error ?: "Error", color = MaterialTheme.colorScheme.error)
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // Stats summary
                    state.stats?.let { stats ->
                        item {
                            Spacer(Modifier.height(4.dp))
                            StatsCards(stats)
                        }
                    }

                    // History list
                    if (state.history.isEmpty()) {
                        item {
                            Text(
                                text = "No rating history yet. Play some games!",
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        item {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Recent Games",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                            )
                        }
                        items(state.history) { entry ->
                            RatingHistoryRow(entry)
                        }
                        item { Spacer(Modifier.height(16.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsCards(stats: RatingStats) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StatCard("Current", "${stats.currentRating}", Modifier.weight(1f))
            StatCard("Peak", "${stats.highestRating}", Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StatCard(
                "Record",
                "${stats.wins}W ${stats.draws}D ${stats.losses}L",
                Modifier.weight(1f),
            )
            val changePrefix = if (stats.averageChange >= 0) "+" else ""
            StatCard("Avg Change", "$changePrefix${stats.averageChange}", Modifier.weight(1f))
        }
        if (stats.currentStreakCount > 0) {
            StatCard(
                "Streak",
                "${stats.currentStreakCount} ${stats.currentStreakType}${if (stats.currentStreakCount > 1) "s" else ""}",
                Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
        }
    }
}

@Composable
private fun RatingHistoryRow(entry: RatingGameEntry) {
    val r = entry.result.lowercase()
    val isWin = listOf("won", "win", "checkmate").any { r.contains(it) }
    val isDraw = listOf("draw", "stalemate", "1/2").any { r.contains(it) }

    val resultColor = when {
        isWin -> Color(0xFF4CAF50)
        isDraw -> Color(0xFFFFC107)
        else -> Color(0xFFF44336)
    }
    val resultIcon = when {
        isWin -> "W"
        isDraw -> "D"
        else -> "L"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Result indicator
            Box(
                modifier = Modifier
                    .background(resultColor.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(resultIcon, color = resultColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(entry.opponent, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                val formattedDate = try {
                    val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                    val date = parser.parse(entry.createdAt)
                    val formatter = SimpleDateFormat("MMM d, HH:mm", Locale.US)
                    if (date != null) formatter.format(date) else entry.createdAt
                } catch (_: Exception) {
                    entry.createdAt.take(10)
                }
                Text(
                    formattedDate,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                val prefix = if (entry.ratingChange >= 0) "+" else ""
                val changeColor = if (entry.ratingChange >= 0) Color(0xFF4CAF50) else Color(0xFFF44336)
                Text(
                    "$prefix${entry.ratingChange}",
                    color = changeColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Text(
                    "${entry.newRating}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
