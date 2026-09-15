package com.chess99.presentation.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontWeight

/**
 * Which active game is showing [GameNavigationWarningDialog]. The copy has to
 * say what Leave actually does server-side (see PlayMultiplayerViewModel.leaveGame):
 * rated resigns; any casual game (human or bot) is paused via
 * `pause-navigation` and can be resumed from Home.
 */
enum class ActiveGameType { RATED_MULTIPLAYER, CASUAL_MULTIPLAYER, CASUAL_BOT, VS_COMPUTER }

/**
 * Warning dialog when navigating away from an active game (toolbar back arrow
 * or hardware/gesture back via `BackHandler`) — same dialog, same copy, no
 * matter how the user tried to leave.
 * Mirrors chess-frontend/src/components/game/GameNavigationWarningDialog.jsx
 */
@Composable
fun GameNavigationWarningDialog(
    gameType: ActiveGameType,
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
                text = "Leave the game?",
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Text(
                text = when (gameType) {
                    ActiveGameType.RATED_MULTIPLAYER ->
                        "This is a rated game. If you leave now, you resign and it counts as a loss."
                    ActiveGameType.CASUAL_MULTIPLAYER,
                    ActiveGameType.CASUAL_BOT ->
                        "Your game will be paused. You can resume it from Home within an hour."
                    ActiveGameType.VS_COMPUTER ->
                        "Your game won't be saved."
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
                Text("Leave game")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onStay) {
                Text("Keep playing")
            }
        },
    )
}
