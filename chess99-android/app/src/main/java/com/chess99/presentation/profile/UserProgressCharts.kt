package com.chess99.presentation.profile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ProfileApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.dbl
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ── Data models ──────────────────────────────────────────────────────────────

/** One day's rating snapshot. */
data class RatingPoint(val date: String, val rating: Int)

/** One day's games breakdown. */
data class GamesDay(
    val date: String,
    val total: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
)

/** Progress time-range toggle. Values match the backend `period` param. */
enum class ProgressRange(val label: String, val period: String) {
    WEEK("7 days", "7d"),
    MONTH("30 days", "30d"),
    ALL("All time", "all"),
}

// ── ViewModel ────────────────────────────────────────────────────────────────

@HiltViewModel
class UserProgressViewModel @Inject constructor(
    private val profileApi: ProfileApi,
) : ViewModel() {

    data class State(
        val isLoading: Boolean = true,
        val error: String? = null,
        val range: ProgressRange = ProgressRange.MONTH,
        val ratingProgression: List<RatingPoint> = emptyList(),
        val gamesPerDay: List<GamesDay> = emptyList(),
    ) {
        val isEmpty: Boolean get() = ratingProgression.isEmpty() && gamesPerDay.isEmpty()
    }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    fun setRange(range: ProgressRange) {
        if (range == _state.value.range && !_state.value.isEmpty) return
        _state.update { it.copy(range = range) }
        load()
    }

    fun load() {
        val range = _state.value.range
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val response = profileApi.getUserProgress(range.period)
                if (!response.isSuccessful) {
                    _state.update { it.copy(isLoading = false, error = "We couldn't load your progress. Please try again.") }
                    return@launch
                }

                val body = response.body()

                val ratings = body.arrOrNullField("rating_progression").mapNotNull { el ->
                    val o = el.objOrNull() ?: return@mapNotNull null
                    val date = o.str("date") ?: return@mapNotNull null
                    val rating = o.int("rating") ?: return@mapNotNull null
                    RatingPoint(date, rating)
                }

                val games = body.arrOrNullField("games_per_day").mapNotNull { el ->
                    val o = el.objOrNull() ?: return@mapNotNull null
                    val date = o.str("date") ?: return@mapNotNull null
                    val total = o.int("total") ?: (o.dbl("total")?.toInt() ?: 0)
                    val wins = o.int("wins") ?: 0
                    val draws = o.int("draws") ?: 0
                    val losses = o.int("losses") ?: 0
                    GamesDay(date, total, wins, draws, losses)
                }

                _state.update {
                    it.copy(
                        isLoading = false,
                        error = null,
                        ratingProgression = ratings,
                        gamesPerDay = games,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = friendlyError(e, "your progress")) }
            }
        }
    }

    private fun com.google.gson.JsonObject?.arrOrNullField(key: String) =
        this?.get(key).arrOrNull() ?: com.google.gson.JsonArray()
}

// ── UI ───────────────────────────────────────────────────────────────────────

/**
 * Self-contained progress-charts section: range toggle + rating line chart +
 * games-per-day bar chart. Renders with Compose Canvas — no charting library.
 */
@Composable
fun UserProgressSection(
    state: UserProgressViewModel.State,
    onRangeSelected: (ProgressRange) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Range toggle
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProgressRange.entries.forEach { range ->
                FilterChip(
                    selected = state.range == range,
                    onClick = { onRangeSelected(range) },
                    label = { Text(range.label) },
                )
            }
        }

        when {
            state.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                ProgressMessageCard(
                    message = state.error,
                    actionLabel = "Tap to retry",
                    onAction = onRetry,
                )
            }

            state.isEmpty -> {
                ProgressMessageCard(
                    message = "No games in this period yet. Play a few games and your progress will show up here!",
                )
            }

            else -> {
                RatingLineChartCard(state.ratingProgression)
                GamesBarChartCard(state.gamesPerDay)
            }
        }
    }
}

@Composable
private fun ProgressMessageCard(
    message: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            if (actionLabel != null && onAction != null) {
                TextButton(onClick = onAction) {
                    Text(actionLabel)
                }
            }
        }
    }
}

@Composable
private fun RatingLineChartCard(points: List<RatingPoint>) {
    val lineColor = MaterialTheme.colorScheme.primary
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Rating Progression",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(4.dp))
            if (points.isEmpty()) {
                Text(
                    "No rating changes in this period.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                val minRating = points.minOf { it.rating }
                val maxRating = points.maxOf { it.rating }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "$minRating",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Peak $maxRating",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(Modifier.height(8.dp))
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                ) {
                    val w = size.width
                    val h = size.height
                    val padY = 8f
                    val range = (maxRating - minRating).coerceAtLeast(1)

                    // Horizontal grid lines (4 divisions).
                    for (i in 0..4) {
                        val y = padY + (h - 2 * padY) * i / 4f
                        drawLine(
                            color = gridColor,
                            start = Offset(0f, y),
                            end = Offset(w, y),
                            strokeWidth = 1f,
                        )
                    }

                    fun xFor(index: Int): Float =
                        if (points.size == 1) w / 2f
                        else w * index / (points.size - 1).toFloat()

                    fun yFor(rating: Int): Float =
                        padY + (h - 2 * padY) * (1f - (rating - minRating) / range.toFloat())

                    // Polyline.
                    val path = Path()
                    points.forEachIndexed { i, p ->
                        val x = xFor(i)
                        val y = yFor(p.rating)
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(
                        path = path,
                        color = lineColor,
                        style = Stroke(width = 4f, cap = StrokeCap.Round),
                    )

                    // Points.
                    points.forEachIndexed { i, p ->
                        drawCircle(
                            color = lineColor,
                            radius = 5f,
                            center = Offset(xFor(i), yFor(p.rating)),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GamesBarChartCard(days: List<GamesDay>) {
    val winColor = MaterialTheme.colorScheme.primary
    val drawColor = MaterialTheme.colorScheme.secondary
    val lossColor = MaterialTheme.colorScheme.error
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Games Played Per Day",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(8.dp))

            val nonEmpty = days.filter { it.total > 0 }
            if (nonEmpty.isEmpty()) {
                Text(
                    "No games in this period.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                // Show the most recent stretch so bars stay readable.
                val recent = nonEmpty.takeLast(14)
                val maxTotal = recent.maxOf { it.total }.coerceAtLeast(1)

                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                ) {
                    val w = size.width
                    val h = size.height
                    val baseline = h

                    // Baseline grid line.
                    drawLine(
                        color = gridColor,
                        start = Offset(0f, baseline - 1f),
                        end = Offset(w, baseline - 1f),
                        strokeWidth = 1f,
                    )

                    val slot = w / recent.size
                    val barWidth = slot * 0.6f
                    val gap = (slot - barWidth) / 2f

                    recent.forEachIndexed { i, day ->
                        val left = i * slot + gap
                        val fullBarHeight = h * (day.total / maxTotal.toFloat())
                        var stackTop = baseline

                        fun drawSegment(count: Int, color: Color) {
                            if (count <= 0) return
                            val segHeight = fullBarHeight * (count / day.total.toFloat())
                            drawRect(
                                color = color,
                                topLeft = Offset(left, stackTop - segHeight),
                                size = androidx.compose.ui.geometry.Size(barWidth, segHeight),
                            )
                            stackTop -= segHeight
                        }

                        drawSegment(day.losses, lossColor)
                        drawSegment(day.draws, drawColor)
                        drawSegment(day.wins, winColor)
                    }
                }

                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LegendDot("Wins", winColor)
                    LegendDot("Draws", drawColor)
                    LegendDot("Losses", lossColor)
                }
            }
        }
    }
}

@Composable
private fun LegendDot(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
