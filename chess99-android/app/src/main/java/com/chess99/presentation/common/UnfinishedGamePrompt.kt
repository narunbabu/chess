package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Dialog prompting the user to resume or discard an unfinished game.
 * Mirrors chess-frontend/src/components/UnfinishedGamePrompt.jsx
 */
@Composable
fun UnfinishedGamePrompt(
    opponentName: String,
    timeControl: String,
    gameId: Int,
    onResume: (Int) -> Unit,
    onDiscard: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.PlayArrow, contentDescription = null) },
        title = {
            Text(
                text = "Unfinished Game",
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Column {
                Text("You have an unfinished game:")
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "vs $opponentName \u2022 $timeControl",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Would you like to resume or discard it?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            Button(onClick = { onResume(gameId) }) {
                Text("Resume")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = { onDiscard(gameId) }) {
                Text("Discard")
            }
        },
    )
}
