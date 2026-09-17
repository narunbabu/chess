package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chess99.R

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
                text = stringResource(R.string.unfinished_title),
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Column {
                Text(stringResource(R.string.unfinished_intro))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.unfinished_summary, opponentName, timeControl),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.unfinished_question),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            Button(onClick = { onResume(gameId) }) {
                Text(stringResource(R.string.action_resume))
            }
        },
        dismissButton = {
            OutlinedButton(onClick = { onDiscard(gameId) }) {
                Text(stringResource(R.string.home_discard))
            }
        },
    )
}
