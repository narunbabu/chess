package com.chess99.presentation.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ── Chess99 brand palette ────────────────────────────────────────────────────
// The board-green + warm cream/gold identity. Every Material color role below is
// mapped to this family so the app reads as "Chess99", not a default Material
// (purple) template. Do NOT leave container/surfaceVariant roles unset — Material
// fills any omitted role with its purple baseline, which is what made the app look
// generic before.
val ChessGreen = Color(0xFF769656)      // board green — primary
val ChessDarkGreen = Color(0xFF4E6B36)
val ChessDeepGreen = Color(0xFF2E3D1E)
val ChessGold = Color(0xFFDAA520)
val ChessAmber = Color(0xFFB07D00)      // deeper gold for text-on-light contrast
val ChessBrown = Color(0xFF8B4513)
val ChessCream = Color(0xFFF0D9B5)      // board light square
val ChessBoardDark = Color(0xFFB58863)  // board dark square

private val LightColorScheme = lightColorScheme(
    primary = ChessGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCEBC7),
    onPrimaryContainer = ChessDeepGreen,

    secondary = ChessAmber,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF6E7BD),
    onSecondaryContainer = Color(0xFF4A3B00),

    tertiary = ChessBrown,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF4DAC2),
    onTertiaryContainer = Color(0xFF3A1D08),

    background = Color(0xFFFBF9F4),
    onBackground = Color(0xFF1C1B18),
    surface = Color(0xFFFBF9F4),
    onSurface = Color(0xFF1C1B18),
    surfaceVariant = Color(0xFFE7E3D6),
    onSurfaceVariant = Color(0xFF4A4739),
    surfaceTint = ChessGreen,

    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF6F3EA),
    surfaceContainer = Color(0xFFF1EDE2),
    surfaceContainerHigh = Color(0xFFEBE7DA),
    surfaceContainerHighest = Color(0xFFE5E1D3),

    outline = Color(0xFF7C7967),
    outlineVariant = Color(0xFFCCC8B7),

    error = Color(0xFFB3261E),
    onError = Color.White,
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF9CBF7C),
    onPrimary = Color(0xFF1E2C10),
    primaryContainer = ChessDarkGreen,
    onPrimaryContainer = Color(0xFFDCEBC7),

    secondary = ChessGold,
    onSecondary = Color(0xFF3D2E00),
    secondaryContainer = Color(0xFF5C4600),
    onSecondaryContainer = Color(0xFFF6E7BD),

    tertiary = Color(0xFFD9A377),
    onTertiary = Color(0xFF48260D),
    tertiaryContainer = Color(0xFF663A1C),
    onTertiaryContainer = Color(0xFFF4DAC2),

    background = Color(0xFF14140F),
    onBackground = Color(0xFFE9E6DC),
    surface = Color(0xFF14140F),
    onSurface = Color(0xFFE9E6DC),
    surfaceVariant = Color(0xFF48463A),
    onSurfaceVariant = Color(0xFFCAC6B4),
    surfaceTint = Color(0xFF9CBF7C),

    surfaceContainerLowest = Color(0xFF0E0E0A),
    surfaceContainerLow = Color(0xFF1C1C16),
    surfaceContainer = Color(0xFF20201A),
    surfaceContainerHigh = Color(0xFF2B2A23),
    surfaceContainerHighest = Color(0xFF35342C),

    outline = Color(0xFF959182),
    outlineVariant = Color(0xFF48463A),

    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
)

@Composable
fun Chess99Theme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Brand-first: keep the Chess99 identity instead of following the device
    // wallpaper palette. Dynamic color is opt-in only.
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

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
