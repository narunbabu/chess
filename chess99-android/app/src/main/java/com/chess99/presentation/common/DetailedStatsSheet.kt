package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

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
                "Detailed Statistics",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Games section
            StatsSection("Games") {
                StatsRow("Total Games", stats["total_games"]?.toString() ?: "0")
                StatsRow("Wins", stats["wins"]?.toString() ?: "0")
                StatsRow("Losses", stats["losses"]?.toString() ?: "0")
                StatsRow("Draws", stats["draws"]?.toString() ?: "0")
                StatsRow("Win Rate", "${stats["win_rate"] ?: "0"}%")
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Streaks section
            StatsSection("Streaks") {
                StatsRow("Current Streak", stats["current_streak"]?.toString() ?: "0")
                StatsRow("Best Streak", stats["best_streak"]?.toString() ?: "0")
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Rating section
            StatsSection("Rating") {
                StatsRow("Current", stats["rating"]?.toString() ?: "1200")
                StatsRow("Peak", stats["peak_rating"]?.toString() ?: "1200")
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
