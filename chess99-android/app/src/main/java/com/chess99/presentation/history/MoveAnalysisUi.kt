package com.chess99.presentation.history

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.domain.model.*

// ── Classification Colors ──────────────────────────────────────────────

private val ClassificationColors = mapOf(
    MoveClassification.BRILLIANT to Color(0xFF46BDF0),
    MoveClassification.EXCELLENT to Color(0xFF81B64C),
    MoveClassification.GOOD to Color(0xFFA3D160),
    MoveClassification.INACCURACY to Color(0xFFE8A93E),
    MoveClassification.MISTAKE to Color(0xFFE07020),
    MoveClassification.BLUNDER to Color(0xFFC33A3A),
    MoveClassification.BOOK to Color(0xFF4A90D9),
)

private fun classificationColor(cls: MoveClassification): Color =
    ClassificationColors[cls] ?: Color.Gray

// ── Analysis Trigger Button ────────────────────────────────────────────

@Composable
fun AnalysisTriggerButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Button(
                onClick = onClick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF81B64C),
                ),
            ) {
                Icon(
                    Icons.Default.Analytics,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Analyze with Stockfish")
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Run full game analysis to see evaluations, accuracy, and move quality",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// ── Analysis Loading Indicator ─────────────────────────────────────────

@Composable
fun AnalysisLoadingIndicator(
    progress: Int = 0,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(32.dp),
                color = Color(0xFF81B64C),
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = if (progress > 0) "Analyzing game... $progress%" else "Analyzing game...",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Stockfish is evaluating each position (depth 18)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (progress > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier
                        .fillMaxWidth(0.7f)
                        .height(4.dp),
                    color = Color(0xFF81B64C),
                    trackColor = MaterialTheme.colorScheme.outlineVariant,
                    strokeCap = StrokeCap.Round,
                )
            }
        }
    }
}

// ── Analysis Error ─────────────────────────────────────────────────────

@Composable
fun AnalysisError(
    error: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Analysis Failed",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(onClick = onRetry) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Retry")
            }
        }
    }
}

// ── Analysis Results ───────────────────────────────────────────────────

@Composable
fun AnalysisResults(
    report: GameAnalysisReport,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Analytics,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Color(0xFF81B64C),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Stockfish Analysis",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Text(
                    text = "Depth 18",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Opening name
            if (!report.openingName.isNullOrBlank()) {
                OpeningNameDisplay(name = report.openingName)
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Accuracy bars
            AccuracyBars(
                accuracyWhite = report.accuracyWhite,
                accuracyBlack = report.accuracyBlack,
                acplWhite = report.acplWhite,
                acplBlack = report.acplBlack,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Quality summary
            QualitySummary(qualityCounts = report.qualityCounts)

            Spacer(modifier = Modifier.height(12.dp))

            // Eval graph
            if (report.moveAnalyses.isNotEmpty()) {
                EvalGraph(moveAnalyses = report.moveAnalyses)
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Move-by-move classifications
            if (report.moveAnalyses.isNotEmpty()) {
                MoveClassificationList(moveAnalyses = report.moveAnalyses)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Legend
            ClassificationLegend()
        }
    }
}

// ── Accuracy Bars ──────────────────────────────────────────────────────

@Composable
private fun AccuracyBars(
    accuracyWhite: Float,
    accuracyBlack: Float,
    acplWhite: Float,
    acplBlack: Float,
) {
    Column {
        AccuracyRow(
            label = "White",
            accuracy = accuracyWhite,
            acpl = acplWhite,
            barColor = Color(0xFFE8E8E8),
        )
        Spacer(modifier = Modifier.height(8.dp))
        AccuracyRow(
            label = "Black",
            accuracy = accuracyBlack,
            acpl = acplBlack,
            barColor = Color(0xFF4A4744),
        )
    }
}

@Composable
private fun AccuracyRow(
    label: String,
    accuracy: Float,
    acpl: Float,
    barColor: Color,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "ACPL: ${"%.1f".format(acpl)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${"%.1f".format(accuracy)}%",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { accuracy / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp),
            color = barColor,
            trackColor = MaterialTheme.colorScheme.outlineVariant,
            strokeCap = StrokeCap.Round,
        )
    }
}

// ── Quality Summary ────────────────────────────────────────────────────

@Composable
private fun QualitySummary(qualityCounts: QualityCounts) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        QualityColumn("White", qualityCounts.white, modifier = Modifier.weight(1f))
        QualityColumn("Black", qualityCounts.black, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun QualityColumn(
    label: String,
    counts: Map<String, Int>,
    modifier: Modifier = Modifier,
) {
    val total = counts.values.sum()
    if (total == 0) return

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                for (cls in MoveClassification.entries) {
                    val count = counts[cls.name.lowercase()] ?: continue
                    if (count == 0) continue
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = classificationColor(cls).copy(alpha = 0.85f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = cls.icon,
                                fontSize = 9.sp,
                                color = Color.White,
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = "$count",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Eval Graph ─────────────────────────────────────────────────────────

@Composable
private fun EvalGraph(moveAnalyses: List<AnalyzedMove>) {
    val data = remember(moveAnalyses) {
        buildList {
            add(EvalPoint(0, 0, "", ""))
            moveAnalyses.forEachIndexed { idx, m ->
                add(EvalPoint(
                    moveNum = m.moveNumber,
                    evalCp = m.evalAfterCp.coerceIn(-1000, 1000),
                    san = m.san,
                    classification = m.classification.name.lowercase(),
                ))
            }
        }
    }

    Column {
        Text(
            text = "EVALUATION",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 1.sp,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            EvalChart(
                data = data,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .padding(8.dp),
            )
        }
    }
}

private data class EvalPoint(
    val moveNum: Int,
    val evalCp: Int,
    val san: String,
    val classification: String,
)

@Composable
private fun EvalChart(
    data: List<EvalPoint>,
    modifier: Modifier = Modifier,
) {
    if (data.size < 2) return

    val greenColor = Color(0xFF81B64C)
    val redColor = Color(0xFFC33A3A)
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val textColor = MaterialTheme.colorScheme.onSurfaceVariant

    Canvas(modifier = modifier) {
        val width = size.width
        val height = size.height
        val padding = 28f
        val chartWidth = width - padding
        val chartHeight = height - padding

        // Y-axis: -1000 to +1000 cp → mapped to chartHeight..0
        val maxEval = 1000f
        fun evalToY(evalCp: Int): Float {
            return padding / 2f + chartHeight / 2f - (evalCp / maxEval) * (chartHeight / 2f)
        }

        // X-axis: 0..lastMoveNum → 0..chartWidth
        val lastMove = data.lastOrNull()?.moveNum?.coerceAtLeast(1) ?: 1
        fun moveToX(moveNum: Int): Float {
            return padding / 2f + (moveNum.toFloat() / lastMove.toFloat()) * chartWidth
        }

        // Grid lines
        for (eval in listOf(-1000, -500, 0, 500, 1000)) {
            val y = evalToY(eval)
            drawLine(
                color = gridColor,
                start = Offset(padding / 2f, y),
                end = Offset(width, y),
                strokeWidth = 0.5f,
            )
        }

        // Zero line (emphasized)
        drawLine(
            color = gridColor,
            start = Offset(padding / 2f, evalToY(0)),
            end = Offset(width, evalToY(0)),
            strokeWidth = 1f,
        )

        // Y-axis labels
        for (eval in listOf(-1000, -500, 0, 500, 1000)) {
            val y = evalToY(eval)
            val label = when (eval) {
                0 -> "0.0"
                1000 -> "+10"
                -1000 -> "-10"
                500 -> "+5"
                -500 -> "-5"
                else -> ""
            }
            drawContext.canvas.nativeCanvas.drawText(
                label,
                0f,
                y + 4f,
                android.graphics.Paint().apply {
                    color = textColor.hashCode()
                    textSize = 18f
                    textAlign = android.graphics.Paint.Align.LEFT
                },
            )
        }

        // Area fill using proper clipping paths
        // Green area above zero line (white advantage)
        val whiteAreaPath = Path().apply {
            moveTo(moveToX(data[0].moveNum), evalToY(data[0].evalCp.coerceAtLeast(0)))
            for (i in 1 until data.size) {
                lineTo(moveToX(data[i].moveNum), evalToY(data[i].evalCp.coerceAtLeast(0)))
            }
            // Close along the zero line back to start
            lineTo(moveToX(data.last().moveNum), evalToY(0))
            lineTo(moveToX(data[0].moveNum), evalToY(0))
            close()
        }
        drawPath(
            path = whiteAreaPath,
            color = greenColor.copy(alpha = 0.15f),
        )

        // Red area below zero line (black advantage)
        val blackAreaPath = Path().apply {
            moveTo(moveToX(data[0].moveNum), evalToY(data[0].evalCp.coerceAtMost(0)))
            for (i in 1 until data.size) {
                lineTo(moveToX(data[i].moveNum), evalToY(data[i].evalCp.coerceAtMost(0)))
            }
            lineTo(moveToX(data.last().moveNum), evalToY(0))
            lineTo(moveToX(data[0].moveNum), evalToY(0))
            close()
        }
        drawPath(
            path = blackAreaPath,
            color = redColor.copy(alpha = 0.15f),
        )

        // Eval line segments colored by advantage
        for (i in 0 until data.size - 1) {
            val x1 = moveToX(data[i].moveNum)
            val y1 = evalToY(data[i].evalCp)
            val x2 = moveToX(data[i + 1].moveNum)
            val y2 = evalToY(data[i + 1].evalCp)
            val avgEval = (data[i].evalCp + data[i + 1].evalCp) / 2f
            val segmentColor = if (avgEval >= 0) greenColor else redColor
            drawLine(
                color = segmentColor,
                start = Offset(x1, y1),
                end = Offset(x2, y2),
                strokeWidth = 2f,
                cap = StrokeCap.Round,
            )
        }

        // Dots for classified moves
        for (point in data.drop(1)) {
            val cls = try {
                MoveClassification.valueOf(point.classification.uppercase())
            } catch (_: Exception) { null }
            if (cls != null && cls != MoveClassification.GOOD) {
                val x = moveToX(point.moveNum)
                val y = evalToY(point.evalCp)
                drawCircle(
                    color = classificationColor(cls),
                    radius = 4f,
                    center = Offset(x, y),
                )
                drawCircle(
                    color = Color.Black,
                    radius = 4f,
                    center = Offset(x, y),
                    style = Stroke(width = 1f),
                )
            }
        }
    }
}

// ── Move Classification List ───────────────────────────────────────────

@Composable
private fun MoveClassificationList(moveAnalyses: List<AnalyzedMove>) {
    Column {
        Text(
            text = "MOVE CLASSIFICATIONS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 1.sp,
        )
        Spacer(modifier = Modifier.height(4.dp))

        Column(
            modifier = Modifier
                .heightIn(max = 200.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            val pairs = moveAnalyses.chunked(2)
            for ((pairIndex, pair) in pairs.withIndex()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${pairIndex + 1}.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(28.dp),
                        textAlign = TextAlign.End,
                    )
                    Spacer(modifier = Modifier.width(8.dp))

                    // White move
                    MoveBadge(move = pair[0], modifier = Modifier.weight(1f))

                    Spacer(modifier = Modifier.width(4.dp))

                    // Black move
                    if (pair.size > 1) {
                        MoveBadge(move = pair[1], modifier = Modifier.weight(1f))
                    } else {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun MoveBadge(
    move: AnalyzedMove,
    modifier: Modifier = Modifier,
) {
    val color = classificationColor(move.classification)
    val bgColor = color.copy(alpha = 0.15f)

    Surface(
        modifier = modifier.padding(vertical = 1.dp),
        shape = RoundedCornerShape(4.dp),
        color = bgColor,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = move.classification.icon,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = color,
            )
            Spacer(modifier = Modifier.width(3.dp))
            Text(
                text = move.san,
                style = MaterialTheme.typography.bodySmall,
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                color = color,
            )
        }
    }
}

// ── Opening Name Display ────────────────────────────────────────────────

@Composable
private fun OpeningNameDisplay(name: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Opening",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

// ── Classification Legend ──────────────────────────────────────────────

@Composable
private fun ClassificationLegend() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    Spacer(modifier = Modifier.height(6.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (cls in MoveClassification.entries) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 3.dp),
            ) {
                Surface(
                    modifier = Modifier.size(8.dp),
                    shape = CircleShape,
                    color = classificationColor(cls),
                ) {}
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    text = cls.label,
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// ── Current Eval Display ───────────────────────────────────────────────

/**
 * Compact eval display that can sit beside the board during review.
 */
@Composable
fun EvalDisplay(
    evalCp: Int,
    isMate: Boolean,
    modifier: Modifier = Modifier,
) {
    val displayText = when {
        isMate && evalCp > 0 -> "+M${evalCp}"
        isMate && evalCp < 0 -> "-M${-evalCp}"
        evalCp > 0 -> "+${"%.2f".format(evalCp / 100.0)}"
        evalCp < 0 -> "${"%.2f".format(evalCp / 100.0)}"
        else -> "0.00"
    }
    val displayColor = when {
        evalCp > 0 -> Color(0xFF81B64C)
        evalCp < 0 -> Color(0xFFC33A3A)
        else -> MaterialTheme.colorScheme.onSurface
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(4.dp),
        color = displayColor.copy(alpha = 0.15f),
    ) {
        Text(
            text = displayText,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = displayColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}
