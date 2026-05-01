package com.chess99.presentation.history

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.abs

/**
 * Vertical evaluation bar showing the advantage balance between white and black.
 * White portion is on top, black on bottom. The split point reflects the eval:
 *   evalCp = 0     → 50/50 split
 *   evalCp = +100   → 60/40 white advantage
 *   evalCp = +1000  → ~95/5 white dominates
 *   evalCp = -500   → ~25/75 black advantage
 *
 * Mate scores force the bar to the extreme (100% for the winning side).
 */
@Composable
fun EvalBar(
    evalCp: Int,
    isMate: Boolean,
    modifier: Modifier = Modifier,
    width: Dp = 22.dp,
    height: Dp = 280.dp,
) {
    val white = Color(0xFFF0F0F0)
    val black = Color(0xFF3A3A3A)
    val accent = Color(0xFF81B64C)

    // Convert eval to a 0..1 ratio where 1 = full white advantage
    val ratio = when {
        isMate && evalCp > 0 -> 1f
        isMate && evalCp < 0 -> 0f
        else -> {
            // Sigmoid-like mapping: ±100cp → 60/40, ±300cp → 78/22, ±1000cp → 95/5
            val clamped = evalCp.coerceIn(-1000, 1000)
            1f / (1f + kotlin.math.exp(-clamped / 250f))
        }
    }

    Canvas(
        modifier = modifier
            .width(width)
            .height(height),
    ) {
        val cornerRadius = 4.dp.toPx()
        val barWidth = size.width
        val barHeight = size.height

        // Black fills entire bar (background)
        drawRoundRect(
            color = black,
            cornerRadius = CornerRadius(cornerRadius),
            size = Size(barWidth, barHeight),
        )

        // White fills from top, height proportional to white's advantage
        val whiteHeight = barHeight * ratio
        drawRoundRect(
            color = white,
            topLeft = androidx.compose.ui.geometry.Offset(0f, 0f),
            size = Size(barWidth, whiteHeight),
            cornerRadius = CornerRadius(cornerRadius),
        )

        // Thin accent line at the boundary
        if (!isMate && abs(evalCp) > 10) {
            drawLine(
                color = accent,
                start = androidx.compose.ui.geometry.Offset(0f, whiteHeight),
                end = androidx.compose.ui.geometry.Offset(barWidth, whiteHeight),
                strokeWidth = 2.dp.toPx(),
            )
        }
    }
}
