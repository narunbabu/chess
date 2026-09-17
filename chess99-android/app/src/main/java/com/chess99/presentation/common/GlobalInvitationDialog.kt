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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.chess99.R

@Composable
fun GlobalInvitationDialog(
    invitation: InvitationData,
    isProcessing: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val title = stringResource(
        when (invitation.type) {
            "new_game_request" -> R.string.invitation_title_rematch
            "resume_request" -> R.string.invitation_title_resume
            "match_request" -> R.string.invitation_title_match
            "championship_resume" -> R.string.invitation_title_championship
            else -> R.string.invitation_title_default
        }
    )

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
                        text = stringResource(
                            R.string.lobby_player_rating,
                            invitation.inviterRating,
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(Modifier.height(8.dp))

                val description = stringResource(
                    when (invitation.type) {
                        "new_game_request" -> R.string.invitation_body_rematch
                        "resume_request" -> R.string.invitation_body_resume
                        "match_request" -> R.string.invitation_body_match
                        "championship_resume" -> R.string.invitation_body_championship
                        else -> R.string.invitation_body_default
                    }
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )

                // Game settings
                val timeControlLabel = invitation.timeControlMinutes?.let {
                    stringResource(
                        R.string.new_game_time_control,
                        it,
                        invitation.incrementSeconds ?: 0,
                    )
                }
                val modeLabel = invitation.gameMode?.let {
                    stringResource(if (it == "rated") R.string.mode_rated else R.string.mode_casual)
                }
                val colourLabel = invitation.colorPreference
                    ?.takeIf { it != "random" }
                    ?.let { stringResource(R.string.invitation_wants_colour, it) }
                val settings = listOfNotNull(timeControlLabel, modeLabel, colourLabel)
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
                    stringResource(
                        when (invitation.type) {
                            "new_game_request" -> R.string.invitation_play_now
                            "resume_request" -> R.string.action_resume
                            "championship_resume" -> R.string.invitation_accept_and_play
                            else -> R.string.action_accept
                        }
                    ),
                )
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDecline,
                enabled = !isProcessing,
            ) {
                Text(stringResource(R.string.action_decline))
            }
        },
    )
}
