package com.chess99.presentation.common

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.data.api.MatchmakingApi
import kotlinx.coroutines.delay

/**
 * Compact presence indicator showing connection status and online player count.
 * Equivalent to frontend's PresenceIndicator.js component.
 */
@Composable
fun PresenceStatusBar(
    matchmakingApi: MatchmakingApi?,
    isConnected: Boolean,
    modifier: Modifier = Modifier,
) {
    var onlineCount by remember { mutableIntStateOf(0) }

    // Periodically fetch online count
    LaunchedEffect(isConnected) {
        if (!isConnected || matchmakingApi == null) return@LaunchedEffect
        while (true) {
            try {
                val response = matchmakingApi.getOnlineCount()
                if (response.isSuccessful) {
                    val count = response.body()?.get("count")?.asInt
                        ?: response.body()?.get("online_count")?.asInt
                        ?: 0
                    onlineCount = count
                }
            } catch (_: Exception) {
                // Silently handle
            }
            delay(30_000) // refresh every 30s
        }
    }

    val dotColor by animateColorAsState(
        targetValue = if (isConnected) Color(0xFF28A745) else Color(0xFFDC3545),
        label = "presenceDot",
    )

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(dotColor),
        )

        Text(
            text = if (isConnected) {
                if (onlineCount > 0) "$onlineCount online" else "Online"
            } else {
                "Offline"
            },
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
