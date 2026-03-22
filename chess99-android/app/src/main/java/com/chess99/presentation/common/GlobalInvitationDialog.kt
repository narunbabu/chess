package com.chess99.presentation.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun GlobalInvitationDialog(
    invitation: InvitationData,
    isProcessing: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val title = when (invitation.type) {
        "new_game_request" -> "Rematch Challenge"
        "resume_request" -> "Resume Game Request"
        "match_request" -> "Match Request"
        "championship_resume" -> "Championship Game Request"
        else -> "Game Invitation"
    }

    AlertDialog(
        onDismissRequest = { if (!isProcessing) onDecline() },
        title = {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = invitation.inviterName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )

                if (invitation.inviterRating != null) {
                    Text(
                        text = "Rating: ${invitation.inviterRating}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(Modifier.height(8.dp))

                val description = when (invitation.type) {
                    "new_game_request" -> "has challenged you to a rematch!"
                    "resume_request" -> "wants to resume the paused game!"
                    "match_request" -> "wants to play you!"
                    "championship_resume" -> "wants to start your championship match!"
                    else -> "wants to play chess with you!"
                }
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )

                // Game settings
                val settings = buildList {
                    if (invitation.timeControlMinutes != null) {
                        add("${invitation.timeControlMinutes}+${invitation.incrementSeconds ?: 0}")
                    }
                    if (invitation.gameMode != null) {
                        add(if (invitation.gameMode == "rated") "Rated" else "Casual")
                    }
                    if (invitation.colorPreference != null && invitation.colorPreference != "random") {
                        add("Wants ${invitation.colorPreference}")
                    }
                }
                if (settings.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = settings.joinToString(" | "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (!invitation.message.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = invitation.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onAccept,
                enabled = !isProcessing,
            ) {
                Text(
                    when (invitation.type) {
                        "new_game_request" -> "Play Now"
                        "resume_request" -> "Resume"
                        "championship_resume" -> "Accept & Play"
                        else -> "Accept"
                    },
                )
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDecline,
                enabled = !isProcessing,
            ) {
                Text("Decline")
            }
        },
    )
}
