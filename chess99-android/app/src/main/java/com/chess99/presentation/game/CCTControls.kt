package com.chess99.presentation.game

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.engine.*

/**
 * CCT (Checks, Captures, Threats) analysis panel for in-game learning.
 * Mirrors chess-frontend/src/components/game/CCTPanel.jsx
 */

// ── Colors matching web frontend ──────────────────────────────────────

private val CheckColor = Color(0xFFEF4444)
private val CheckBgColor = Color(0x26EF4444)
private val CaptureColor = Color(0xFFF97316)
private val CaptureBgColor = Color(0x26F97316)
private val ThreatColor = Color(0xFFEAB308)
private val ThreatBgColor = Color(0x26EAB308)

private val BestRankColors = listOf(Color(0xFFFFD700), Color(0xFFC0C0C0), Color(0xFFCD7F32))

// ── CCT State ─────────────────────────────────────────────────────────

data class CCTPanelState(
    val cct: CCTResult? = null,
    val opponentCct: CCTResult? = null,
    val bestMoves: List<BestMoveData>? = null,
    val loadingBest: Boolean = false,
    val hintLevel: Int = 0, // 0=off, 1=CCT arrows, 2=Best moves
    val perspective: String = "mine", // "mine" or "opponent"
    val warning: CCTWarning? = null,
)

data class BestMoveData(
    val uci: String,
    val from: Int,
    val to: Int,
    val san: String,
    val cp: Int,
    val isMate: Boolean,
    val tag: String,
)

// ── Bottom Sheet ──────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CCTBottomSheet(
    state: CCTPanelState,
    isActive: Boolean,
    isRated: Boolean,
    onHintLevelChange: (Int) -> Unit,
    onPerspectiveChange: (String) -> Unit,
    onDismiss: () -> Unit,
    sheetState: SheetState,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding(),
        ) {
            Text(
                "Analysis Panel",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Checks, Captures & Threats scanner",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (!isActive) {
                Text(
                    "Start a game to activate the learning panel.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else if (isRated) {
                CCTRatedGate(state.cct)
            } else {
                CCTActivePanel(
                    state = state,
                    onHintLevelChange = onHintLevelChange,
                    onPerspectiveChange = onPerspectiveChange,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// ── Rated Gate ────────────────────────────────────────────────────────

@Composable
private fun CCTRatedGate(cct: CCTResult?) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("🏆", fontSize = 32.sp)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Limited in Rated games",
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            "CCT counts are visible but move hints and best moves are disabled.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (cct != null) {
            CCTCountPills(cct)
        }
    }
}

// ── Active Panel ──────────────────────────────────────────────────────

@Composable
private fun CCTActivePanel(
    state: CCTPanelState,
    onHintLevelChange: (Int) -> Unit,
    onPerspectiveChange: (String) -> Unit,
) {
    // Mode toggle
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(
            selected = state.hintLevel == 1,
            onClick = { onHintLevelChange(if (state.hintLevel == 1) 0 else 1) },
            label = { Text("CCT") },
            leadingIcon = { Text("💡", fontSize = 14.sp) },
            modifier = Modifier.weight(1f),
        )
        FilterChip(
            selected = state.hintLevel == 2,
            onClick = { onHintLevelChange(if (state.hintLevel == 2) 0 else 2) },
            label = { Text("Best") },
            leadingIcon = { Text("⭐", fontSize = 14.sp) },
            modifier = Modifier.weight(1f),
        )
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Warning
    state.warning?.let { warning ->
        val warningColor = when (warning.severity) {
            CCTWarningSeverity.CRITICAL -> Color(0xFFEF4444)
            CCTWarningSeverity.DANGER -> Color(0xFFF97316)
            CCTWarningSeverity.WARNING -> Color(0xFFEAB308)
            CCTWarningSeverity.CAUTION -> Color(0xFFEAB308).copy(alpha = 0.7f)
            CCTWarningSeverity.SAFE -> Color(0xFF4CAF50)
        }
        val warningBgColor = when (warning.severity) {
            CCTWarningSeverity.CRITICAL -> Color(0x26EF4444)
            CCTWarningSeverity.DANGER -> Color(0x26F97316)
            CCTWarningSeverity.WARNING -> Color(0x26EAB308)
            CCTWarningSeverity.CAUTION -> Color(0x1AEAB308)
            CCTWarningSeverity.SAFE -> Color(0x264CAF50)
        }
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = warningBgColor,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                warning.message,
                modifier = Modifier.padding(10.dp),
                style = MaterialTheme.typography.bodySmall,
                color = warningColor,
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
    }

    // Perspective toggle
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedButton(
            onClick = { onPerspectiveChange("mine") },
            modifier = Modifier.weight(1f),
            colors = if (state.perspective == "mine") {
                ButtonDefaults.outlinedButtonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                )
            } else ButtonDefaults.outlinedButtonColors(),
        ) {
            Text("My Moves", fontSize = 12.sp)
        }
        OutlinedButton(
            onClick = { onPerspectiveChange("opponent") },
            modifier = Modifier.weight(1f),
            colors = if (state.perspective == "opponent") {
                ButtonDefaults.outlinedButtonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                )
            } else ButtonDefaults.outlinedButtonColors(),
        ) {
            Text("Their Threats", fontSize = 12.sp)
        }
    }

    Spacer(modifier = Modifier.height(12.dp))

    // CCT sections
    val cct = state.cct
    if (cct != null) {
        CCTCountPills(cct)
        Spacer(modifier = Modifier.height(8.dp))

        CCTSection(
            title = "Checks",
            count = cct.checks.size,
            color = CheckColor,
            bgColor = CheckBgColor,
            items = cct.checks.map { it.san to (if (it.isCheckmate) "Mate" else null) },
            showDetails = state.hintLevel >= 1,
        )
        Spacer(modifier = Modifier.height(6.dp))
        CCTSection(
            title = "Captures",
            count = cct.captures.size,
            color = CaptureColor,
            bgColor = CaptureBgColor,
            items = cct.captures.map { "×${it.victimName}" to null },
            showDetails = state.hintLevel >= 1,
        )
        Spacer(modifier = Modifier.height(6.dp))
        CCTSection(
            title = "Threats",
            count = cct.threats.size,
            color = ThreatColor,
            bgColor = ThreatBgColor,
            items = cct.threats.map { "→ ${it.victimName}" to null },
            showDetails = state.hintLevel >= 1,
        )
    } else {
        Text(
            "Calculating...",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 8.dp),
        )
    }

    // Best moves list
    if (state.hintLevel == 2) {
        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Top 3 Moves",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(modifier = Modifier.height(6.dp))

        if (state.loadingBest) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "Analysing position...",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        state.bestMoves?.let { moves ->
            if (moves.isEmpty()) {
                Text(
                    "No moves found.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            moves.forEachIndexed { i, move ->
                BestMoveRow(
                    rank = i + 1,
                    san = move.san,
                    tag = move.tag,
                    cp = move.cp,
                    isMate = move.isMate,
                    rankColor = BestRankColors.getOrElse(i) { Color.Gray },
                )
                if (i < moves.size - 1) Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

// ── Sub-Components ────────────────────────────────────────────────────

@Composable
private fun CCTCountPills(cct: CCTResult) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        CountPill("Checks", cct.checks.size, CheckColor, CheckBgColor)
        CountPill("Captures", cct.captures.size, CaptureColor, CaptureBgColor)
        CountPill("Threats", cct.threats.size, ThreatColor, ThreatBgColor)
    }
}

@Composable
private fun CountPill(label: String, count: Int, color: Color, bgColor: Color) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = bgColor,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                count.toString(),
                style = MaterialTheme.typography.titleMedium,
                color = color,
                fontWeight = FontWeight.Bold,
            )
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = color.copy(alpha = 0.8f),
            )
        }
    }
}

@Composable
private fun CCTSection(
    title: String,
    count: Int,
    color: Color,
    bgColor: Color,
    items: List<Pair<String, String?>>,
    showDetails: Boolean,
) {
    var expanded by remember { mutableStateOf(true) }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = bgColor,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = color,
                )
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = color.copy(alpha = 0.2f),
                ) {
                    Text(
                        count.toString(),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = color,
                    )
                }
            }

            if (expanded) {
                if (items.isEmpty()) {
                    Text(
                        "None",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else if (showDetails) {
                    items.take(5).forEach { (text, badge) ->
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium,
                            )
                            badge?.let {
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = color.copy(alpha = 0.3f),
                                ) {
                                    Text(
                                        it,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = color,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Text(
                        "$count move${if (count != 1) "s" else ""} — enable hints to reveal",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

@Composable
private fun BestMoveRow(
    rank: Int,
    san: String,
    tag: String,
    cp: Int,
    isMate: Boolean,
    rankColor: Color,
) {
    val tagColor = when (tag) {
        "Check+Capture" -> CheckColor
        "Check" -> CheckColor
        "Capture" -> CaptureColor
        "Threat" -> ThreatColor
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        shape = RoundedCornerShape(6.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .padding(start = 12.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "$rank.",
                color = rankColor,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(24.dp),
            )
            Text(
                san,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = tagColor.copy(alpha = 0.2f),
            ) {
                Text(
                    tag,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = tagColor,
                    fontWeight = FontWeight.Medium,
                )
            }
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                if (isMate) "M${kotlin.math.abs(cp)}" else "${cp / 100.0}",
                style = MaterialTheme.typography.labelSmall,
                color = if (cp > 0) Color(0xFF4CAF50) else if (cp < 0) Color(0xFFEF4444)
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
