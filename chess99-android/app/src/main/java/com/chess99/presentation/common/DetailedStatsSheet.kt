package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chess99.R

/**
 * Detailed stats bottom sheet for profile drill-down.
 * Mirrors chess-frontend/src/components/DetailedStatsModal.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailedStatsSheet(
    stats: Map<String, Any>,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text(
                stringResource(R.string.stats_detailed_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Games section
            StatsSection(stringResource(R.string.stats_section_games)) {
                StatsRow(stringResource(R.string.stats_total_games), stats["total_games"]?.toString() ?: "0")
                StatsRow(stringResource(R.string.stats_wins), stats["wins"]?.toString() ?: "0")
                StatsRow(stringResource(R.string.stats_losses), stats["losses"]?.toString() ?: "0")
                StatsRow(stringResource(R.string.stats_draws), stats["draws"]?.toString() ?: "0")
                StatsRow(
                    stringResource(R.string.stats_win_rate),
                    stringResource(R.string.stats_percent, stats["win_rate"]?.toString() ?: "0"),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Streaks section
            StatsSection(stringResource(R.string.stats_section_streaks)) {
                StatsRow(stringResource(R.string.stats_current_streak), stats["current_streak"]?.toString() ?: "0")
                StatsRow(stringResource(R.string.stats_best_streak), stats["best_streak"]?.toString() ?: "0")
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Rating section
            StatsSection(stringResource(R.string.stats_section_rating)) {
                StatsRow(stringResource(R.string.stats_rating_current), stats["rating"]?.toString() ?: "1200")
                StatsRow(stringResource(R.string.stats_rating_peak), stats["peak_rating"]?.toString() ?: "1200")
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun StatsRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
    }
}
