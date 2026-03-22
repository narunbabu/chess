package com.chess99.presentation.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class NewGameRequest(
    val requesterName: String,
    val requesterRating: Int?,
    val opponentName: String,
    val opponentRating: Int?,
    val colorPreference: String?, // "white", "black", "random", null
    val message: String?,
    val newGameId: Int,
    val timeControlMinutes: Int? = null,
    val incrementSeconds: Int? = null,
    val gameMode: String? = null, // "rated", "casual"
)

@Composable
fun NewGameRequestDialog(
    request: NewGameRequest,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDecline,
        title = {
            Text(
                text = "New Game Challenge",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (!request.message.isNullOrBlank()) {
                    Text(
                        text = request.message,
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                }

                // Player matchup
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PlayerInfo(request.requesterName, request.requesterRating)
                    Text(
                        text = "VS",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    PlayerInfo(request.opponentName, request.opponentRating)
                }

                Spacer(Modifier.height(12.dp))

                // Game settings
                val settings = buildList {
                    if (request.timeControlMinutes != null) {
                        add("${request.timeControlMinutes}+${request.incrementSeconds ?: 0}")
                    }
                    if (request.gameMode != null) {
                        add(if (request.gameMode == "rated") "Rated" else "Casual")
                    }
                }
                if (settings.isNotEmpty()) {
                    Text(
                        text = settings.joinToString(" | "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (request.colorPreference != null && request.colorPreference != "random") {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "They want to play as ${request.colorPreference}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = onAccept) {
                Text("Accept")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDecline) {
                Text("Decline")
            }
        },
    )
}

@Composable
private fun PlayerInfo(name: String, rating: Int?) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = name,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
        )
        if (rating != null) {
            Text(
                text = "($rating)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
