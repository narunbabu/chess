package com.chess99.presentation.common

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Presence confirmation dialog with countdown timer.
 * Auto-times out after [timeoutSeconds] if user doesn't confirm.
 * Mirrors chess-frontend/src/components/play/PresenceConfirmationDialog.js
 */
@Composable
fun PresenceConfirmationDialog(
    timeoutSeconds: Int = 10,
    onConfirm: () -> Unit,
    onTimeout: () -> Unit,
) {
    var remainingSeconds by remember { mutableIntStateOf(timeoutSeconds) }

    LaunchedEffect(Unit) {
        while (remainingSeconds > 0) {
            delay(1000)
            remainingSeconds--
        }
        onTimeout()
    }

    AlertDialog(
        onDismissRequest = { /* Cannot dismiss — must confirm or timeout */ },
        icon = { Icon(Icons.Default.Timer, contentDescription = null) },
        title = {
            Text(
                text = "Are you still there?",
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Confirm your presence to continue the game.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "$remainingSeconds",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = if (remainingSeconds <= 3) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "seconds remaining",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("I'm here!")
            }
        },
    )
}
