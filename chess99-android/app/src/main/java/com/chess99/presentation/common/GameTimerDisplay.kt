package com.chess99.presentation.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Chess game timer display.
 * Shows remaining time for a player with active/inactive visual states.
 * Matches web frontend timer behavior (10 min per player, 100ms tick).
 */
@Composable
fun GameTimerDisplay(
    timeSeconds: Int,
    isActive: Boolean,
    playerName: String,
    modifier: Modifier = Modifier,
) {
    val minutes = timeSeconds / 60
    val seconds = timeSeconds % 60
    val isLowTime = timeSeconds < 60 // Less than 1 minute

    val bgColor = when {
        isActive && isLowTime -> Color(0xFFE53935) // red when low time and active
        isActive -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val textColor = when {
        isActive -> MaterialTheme.colorScheme.onPrimary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = playerName,
            color = textColor,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "%d:%02d".format(minutes, seconds),
            color = textColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * Player info bar showing name, rating, and captured pieces.
 */
@Composable
fun PlayerInfoBar(
    name: String,
    rating: Int? = null,
    capturedPieces: String = "",
    isCurrentTurn: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Turn indicator
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(if (isCurrentTurn) Color(0xFF4CAF50) else Color.Transparent)
        )
        Spacer(modifier = Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                if (rating != null) {
                    Text(
                        text = " ($rating)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (capturedPieces.isNotEmpty()) {
                Text(
                    text = capturedPieces,
                    style = MaterialTheme.typography.bodySmall,
                    letterSpacing = 2.sp,
                )
            }
        }
    }
}
