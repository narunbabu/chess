package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

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
            Text("Join Game?", fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DetailInfoRow("Host", hostName)
                DetailInfoRow("Rating", "$hostRating")
                DetailInfoRow("Time Control", timeControl)
                DetailInfoRow("Mode", if (isRated) "Rated" else "Casual")
            }
        },
        confirmButton = {
            Button(onClick = onJoin) {
                Text("Join")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Cancel")
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
