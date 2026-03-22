package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Network error / connection lost dialog for game screens.
 * Offers retry and go-back options.
 * Mirrors chess-frontend/src/components/play/NetworkErrorDialog.js
 */
@Composable
fun NetworkErrorDialog(
    onRetry: () -> Unit,
    onGoBack: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { /* Cannot dismiss — user must choose action */ },
        icon = {
            Icon(
                Icons.Default.WifiOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
            )
        },
        title = {
            Text(
                text = "Connection Lost",
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Column {
                Text(
                    text = "Lost connection to the game server.\nThis may be due to a network issue.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Your game state is preserved. Try reconnecting.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        },
        confirmButton = {
            Button(onClick = onRetry) {
                Text("Retry Connection")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onGoBack) {
                Text("Leave Game")
            }
        },
    )
}
