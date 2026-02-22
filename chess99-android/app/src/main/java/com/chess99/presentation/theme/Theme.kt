package com.chess99.presentation.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// Chess99 brand colors
val ChessBrown = Color(0xFF8B4513)
val ChessCream = Color(0xFFF0D9B5)
val ChessGreen = Color(0xFF769656)
val ChessDarkGreen = Color(0xFF5A7A42)
val ChessGold = Color(0xFFDAA520)

private val DarkColorScheme = darkColorScheme(
    primary = ChessGreen,
    onPrimary = Color.White,
    secondary = ChessGold,
    onSecondary = Color.Black,
    tertiary = ChessBrown,
    surface = Color(0xFF1C1B1F),
    onSurface = Color.White,
    background = Color(0xFF121212),
    onBackground = Color.White,
)

private val LightColorScheme = lightColorScheme(
    primary = ChessGreen,
    onPrimary = Color.White,
    secondary = ChessGold,
    onSecondary = Color.Black,
    tertiary = ChessBrown,
    surface = Color.White,
    onSurface = Color.Black,
    background = Color(0xFFFFFBFE),
    onBackground = Color.Black,
)

@Composable
fun Chess99Theme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
