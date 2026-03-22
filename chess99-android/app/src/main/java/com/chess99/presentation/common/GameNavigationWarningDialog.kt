package com.chess99.presentation.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontWeight

/**
 * Warning dialog when navigating away from an active game.
 * Mirrors chess-frontend/src/components/game/GameNavigationWarningDialog.jsx
 */
@Composable
fun GameNavigationWarningDialog(
    isRated: Boolean,
    onStay: () -> Unit,
    onLeave: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onStay,
        icon = {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
            )
        },
        title = {
            Text(
                text = "Leave Game?",
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Text(
                text = if (isRated) {
                    "You have an active rated game. Leaving will count as a loss and affect your rating."
                } else {
                    "You have an active game. Leaving will end the game."
                },
                style = MaterialTheme.typography.bodyMedium,
            )
        },
        confirmButton = {
            Button(
                onClick = onLeave,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Text("Leave Game")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onStay) {
                Text("Stay")
            }
        },
    )
}
