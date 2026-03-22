package com.chess99.presentation.common

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Animated game completion overlay with win/loss/draw visuals.
 * Mirrors chess-frontend/src/components/GameCompletionAnimation.js
 */
@Composable
fun GameCompletionAnimation(
    result: String, // "win", "loss", "draw"
    ratingChange: Int = 0,
    onDismiss: () -> Unit,
) {
    val scaleAnim = remember { Animatable(0.3f) }
    val alphaAnim = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        alphaAnim.animateTo(1f, animationSpec = tween(300))
        scaleAnim.animateTo(
            1f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessLow,
            ),
        )
    }

    val (title, icon, color) = when (result.lowercase()) {
        "win" -> Triple("Victory!", Icons.Default.EmojiEvents, Color(0xFF4CAF50))
        "loss" -> Triple("Defeat", Icons.Default.SentimentDissatisfied, Color(0xFFE53935))
        "draw" -> Triple("Draw", Icons.Default.Handshake, Color(0xFFFF9800))
        else -> Triple("Game Over", Icons.Default.SportsEsports, Color(0xFF9E9E9E))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(alphaAnim.value)
            .background(Color.Black.copy(alpha = 0.7f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.scale(scaleAnim.value),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = color,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = title,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            if (ratingChange != 0) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (ratingChange > 0) "+$ratingChange" else "$ratingChange",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (ratingChange > 0) Color(0xFF4CAF50) else Color(0xFFE53935),
                )
                Text(
                    text = "Rating",
                    fontSize = 14.sp,
                    color = Color.White.copy(alpha = 0.7f),
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = color),
            ) {
                Text("Continue", color = Color.White)
            }
        }
    }
}

/**
 * Checkmate notification banner.
 * Mirrors chess-frontend/src/components/CheckmateNotification.js
 */
@Composable
fun CheckmateNotification(
    isWin: Boolean,
    modifier: Modifier = Modifier,
) {
    val scaleAnim = remember { Animatable(0.5f) }

    LaunchedEffect(Unit) {
        scaleAnim.animateTo(
            1f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMedium,
            ),
        )
    }

    Card(
        modifier = modifier
            .scale(scaleAnim.value)
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isWin) Color(0xFF4CAF50) else Color(0xFFE53935),
        ),
    ) {
        Text(
            text = "Checkmate!",
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            textAlign = TextAlign.Center,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 24.sp,
        )
    }
}
