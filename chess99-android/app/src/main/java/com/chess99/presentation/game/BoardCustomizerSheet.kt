package com.chess99.presentation.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Board theme customizer bottom sheet.
 * Free users get default themes; premium themes are gated.
 * Mirrors chess-frontend/src/components/play/BoardCustomizer.js
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardCustomizerSheet(
    currentTheme: String,
    isPremium: Boolean,
    onSelectTheme: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text(
                "Board Theme",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(16.dp))

            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.heightIn(max = 400.dp),
            ) {
                items(boardThemes) { theme ->
                    val isLocked = theme.isPremiumOnly && !isPremium
                    val isSelected = theme.id == currentTheme

                    BoardThemePreview(
                        theme = theme,
                        isSelected = isSelected,
                        isLocked = isLocked,
                        onClick = {
                            if (!isLocked) onSelectTheme(theme.id)
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BoardThemePreview(
    theme: BoardTheme,
    isSelected: Boolean,
    isLocked: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(shape)
            .then(
                if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, shape)
                else Modifier
            )
            .clickable(enabled = !isLocked, onClick = onClick)
            .padding(4.dp),
    ) {
        // Mini board preview (2x2 grid)
        Row {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(theme.lightSquare),
            )
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(theme.darkSquare),
            )
        }
        Row {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(theme.darkSquare),
            )
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(theme.lightSquare),
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Box(contentAlignment = Alignment.Center) {
            Text(
                text = theme.name,
                style = MaterialTheme.typography.labelSmall,
            )
            if (isSelected) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = "Selected",
                    modifier = Modifier.size(12.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
            if (isLocked) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = "Premium",
                    modifier = Modifier.size(12.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Board Themes ────────────────────────────────────────────────────────

data class BoardTheme(
    val id: String,
    val name: String,
    val lightSquare: Color,
    val darkSquare: Color,
    val isPremiumOnly: Boolean = false,
)

val boardThemes = listOf(
    BoardTheme("classic", "Classic", Color(0xFFF0D9B5), Color(0xFFB58863)),
    BoardTheme("green", "Green", Color(0xFFEEEED2), Color(0xFF769656)),
    BoardTheme("blue", "Blue", Color(0xFFDEE3E6), Color(0xFF8CA2AD)),
    BoardTheme("brown", "Brown", Color(0xFFF0D9B5), Color(0xFF946F51)),
    BoardTheme("purple", "Purple", Color(0xFFE8DAF7), Color(0xFF9B72CF), isPremiumOnly = true),
    BoardTheme("red", "Red", Color(0xFFF2D7D5), Color(0xFFCA5353), isPremiumOnly = true),
    BoardTheme("dark", "Dark", Color(0xFF606060), Color(0xFF404040), isPremiumOnly = true),
    BoardTheme("ice", "Ice", Color(0xFFE0F0FF), Color(0xFF88AACC), isPremiumOnly = true),
    BoardTheme("wood", "Wood", Color(0xFFDEB887), Color(0xFF8B6914), isPremiumOnly = true),
)
