package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chess99.R

/**
 * Game preview dialog shown before joining a game.
 * Shows player info, time control, and rating details.
 * Mirrors chess-frontend/src/components/GamePreviewModal.js
 */
@Composable
fun GamePreviewDialog(
    hostName: String,
    hostRating: Int,
    timeControl: String,
    isRated: Boolean,
    onJoin: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.SportsEsports, contentDescription = null) },
        title = {
            Text(stringResource(R.string.preview_title), fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DetailInfoRow(stringResource(R.string.preview_host), hostName)
                DetailInfoRow(stringResource(R.string.preview_rating), "$hostRating")
                DetailInfoRow(stringResource(R.string.championship_time_control), timeControl)
                DetailInfoRow(
                    stringResource(R.string.lobby_mode),
                    stringResource(if (isRated) R.string.mode_rated else R.string.mode_casual),
                )
            }
        },
        confirmButton = {
            Button(onClick = onJoin) {
                Text(stringResource(R.string.preview_join))
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

@Composable
private fun DetailInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
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
