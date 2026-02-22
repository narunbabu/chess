package com.chess99.presentation.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.engine.*
import kotlin.math.min

/**
 * Custom Canvas-based chess board component.
 * Features:
 * - 8x8 grid with configurable colors
 * - Unicode chess piece rendering
 * - Drag-and-drop + tap-tap move input
 * - Legal move highlighting (dots)
 * - Last move highlighting (colored squares)
 * - Check indicator (red king square)
 * - Board orientation flip
 * - Animated piece sliding (via recomposition)
 * - Haptic feedback on capture
 */
@Composable
fun ChessBoardView(
    game: ChessGame,
    boardOrientation: com.chess99.engine.Color = com.chess99.engine.Color.WHITE,
    isInteractive: Boolean = true,
    lastMoveFrom: Int = -1,
    lastMoveTo: Int = -1,
    onMove: ((from: String, to: String, promotion: Char?) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val haptic = LocalHapticFeedback.current
    val textMeasurer = rememberTextMeasurer()

    // Selection state for tap-tap moves
    var selectedSquare by remember { mutableIntStateOf(-1) }
    var legalMoveTargets by remember { mutableStateOf(emptyList<Int>()) }

    // Drag state
    var draggedPiece by remember { mutableIntStateOf(Piece.NONE) }
    var dragFrom by remember { mutableIntStateOf(-1) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var isDragging by remember { mutableStateOf(false) }

    // Board sizing
    BoxWithConstraints(modifier = modifier.aspectRatio(1f)) {
        val boardSizePx = with(LocalDensity.current) {
            min(maxWidth.toPx(), maxHeight.toPx())
        }
        val squareSize = boardSizePx / 8f

        fun viewToBoard(x: Float, y: Float): Int {
            val file = (x / squareSize).toInt().coerceIn(0, 7)
            val rank = (y / squareSize).toInt().coerceIn(0, 7)
            val actualFile = if (boardOrientation == com.chess99.engine.Color.WHITE) file else 7 - file
            val actualRank = if (boardOrientation == com.chess99.engine.Color.WHITE) rank else 7 - rank
            return actualRank * 16 + actualFile // 0x88 square
        }

        fun boardToView(sq: Int): Offset {
            val rank = Square.rank(sq)
            val file = Square.file(sq)
            val viewFile = if (boardOrientation == com.chess99.engine.Color.WHITE) file else 7 - file
            val viewRank = if (boardOrientation == com.chess99.engine.Color.WHITE) rank else 7 - rank
            return Offset(viewFile * squareSize, viewRank * squareSize)
        }

        fun selectSquare(sq: Int) {
            val piece = game.get(sq)
            if (piece != Piece.NONE && Piece.color(piece) == game.turn) {
                selectedSquare = sq
                legalMoveTargets = game.legalMovesFrom(sq).map { it.to }
            }
        }

        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(isInteractive, game.fen()) {
                    if (!isInteractive) return@pointerInput
                    detectTapGestures { offset ->
                        val sq = viewToBoard(offset.x, offset.y)
                        if (selectedSquare != -1 && sq in legalMoveTargets) {
                            // Execute move
                            val fromAlg = Square.toAlgebraic(selectedSquare)
                            val toAlg = Square.toAlgebraic(sq)
                            val piece = game.get(selectedSquare)
                            val isPromotion = Piece.type(piece) == Piece.PAWN &&
                                    (Square.rank(sq) == 0 || Square.rank(sq) == 7)
                            val captured = game.get(sq)
                            if (captured != Piece.NONE) {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            }
                            onMove?.invoke(fromAlg, toAlg, if (isPromotion) 'q' else null)
                            selectedSquare = -1
                            legalMoveTargets = emptyList()
                        } else if (selectedSquare == sq) {
                            // Deselect
                            selectedSquare = -1
                            legalMoveTargets = emptyList()
                        } else {
                            selectSquare(sq)
                        }
                    }
                }
                .pointerInput(isInteractive, game.fen()) {
                    if (!isInteractive) return@pointerInput
                    detectDragGestures(
                        onDragStart = { offset ->
                            val sq = viewToBoard(offset.x, offset.y)
                            val piece = game.get(sq)
                            if (piece != Piece.NONE && Piece.color(piece) == game.turn) {
                                draggedPiece = piece
                                dragFrom = sq
                                isDragging = true
                                dragOffset = offset
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                // Also show legal moves
                                selectedSquare = sq
                                legalMoveTargets = game.legalMovesFrom(sq).map { it.to }
                            }
                        },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            dragOffset += dragAmount
                        },
                        onDragEnd = {
                            if (isDragging && dragFrom != -1) {
                                val sq = viewToBoard(dragOffset.x, dragOffset.y)
                                if (sq in legalMoveTargets) {
                                    val fromAlg = Square.toAlgebraic(dragFrom)
                                    val toAlg = Square.toAlgebraic(sq)
                                    val isPromotion = Piece.type(draggedPiece) == Piece.PAWN &&
                                            (Square.rank(sq) == 0 || Square.rank(sq) == 7)
                                    val captured = game.get(sq)
                                    if (captured != Piece.NONE) {
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    onMove?.invoke(fromAlg, toAlg, if (isPromotion) 'q' else null)
                                }
                            }
                            isDragging = false
                            draggedPiece = Piece.NONE
                            dragFrom = -1
                            selectedSquare = -1
                            legalMoveTargets = emptyList()
                        },
                        onDragCancel = {
                            isDragging = false
                            draggedPiece = Piece.NONE
                            dragFrom = -1
                            selectedSquare = -1
                            legalMoveTargets = emptyList()
                        }
                    )
                }
        ) {
            val sqSize = size.width / 8f

            // Draw squares
            for (rank in 0..7) {
                for (file in 0..7) {
                    val isLight = (rank + file) % 2 == 0
                    val viewFile = if (boardOrientation == com.chess99.engine.Color.WHITE) file else 7 - file
                    val viewRank = if (boardOrientation == com.chess99.engine.Color.WHITE) rank else 7 - rank

                    val x = viewFile * sqSize
                    val y = viewRank * sqSize
                    val sq = rank * 16 + file

                    // Base square color
                    var squareColor = if (isLight) LightSquareColor else DarkSquareColor

                    // Last move highlighting
                    if (sq == lastMoveFrom || sq == lastMoveTo) {
                        squareColor = LastMoveColor
                    }

                    // Selected square
                    if (sq == selectedSquare) {
                        squareColor = SelectedSquareColor
                    }

                    // Check highlight
                    if (game.isCheck()) {
                        val kingSq = game.kingSquare(game.turn)
                        if (sq == kingSq) {
                            squareColor = CheckColor
                        }
                    }

                    drawRect(color = squareColor, topLeft = Offset(x, y), size = Size(sqSize, sqSize))

                    // Legal move indicators
                    if (sq in legalMoveTargets) {
                        val center = Offset(x + sqSize / 2, y + sqSize / 2)
                        val hasPiece = game.get(sq) != Piece.NONE
                        if (hasPiece) {
                            // Capture indicator: ring
                            drawCircle(
                                color = LegalMoveColor,
                                radius = sqSize * 0.42f,
                                center = center
                            )
                            drawCircle(
                                color = squareColor,
                                radius = sqSize * 0.35f,
                                center = center
                            )
                        } else {
                            // Move indicator: dot
                            drawCircle(
                                color = LegalMoveColor,
                                radius = sqSize * 0.15f,
                                center = center
                            )
                        }
                    }
                }
            }

            // Draw pieces
            for (rank in 0..7) {
                for (file in 0..7) {
                    val sq = rank * 16 + file
                    val piece = game.get(sq)
                    if (piece == Piece.NONE) continue
                    if (isDragging && sq == dragFrom) continue // Don't draw dragged piece at original position

                    val viewFile = if (boardOrientation == com.chess99.engine.Color.WHITE) file else 7 - file
                    val viewRank = if (boardOrientation == com.chess99.engine.Color.WHITE) rank else 7 - rank
                    val x = viewFile * sqSize
                    val y = viewRank * sqSize

                    drawPieceUnicode(textMeasurer, piece, Offset(x, y), sqSize)
                }
            }

            // Draw dragged piece at cursor position
            if (isDragging && draggedPiece != Piece.NONE) {
                val x = dragOffset.x - sqSize / 2
                val y = dragOffset.y - sqSize / 2
                drawPieceUnicode(textMeasurer, draggedPiece, Offset(x, y), sqSize * 1.2f)
            }

            // Draw coordinates
            drawCoordinates(textMeasurer, sqSize, boardOrientation)
        }
    }
}

// ── Drawing Helpers ──────────────────────────────────────────────────

private fun DrawScope.drawPieceUnicode(
    textMeasurer: TextMeasurer,
    piece: Int,
    topLeft: Offset,
    squareSize: Float,
) {
    val unicode = pieceToUnicode(piece) ?: return
    val style = TextStyle(
        fontSize = (squareSize * 0.7f).sp,
        color = Color.Unspecified, // Use actual piece color via unicode chars
    )
    val measured = textMeasurer.measure(unicode, style)
    val x = topLeft.x + (squareSize - measured.size.width) / 2
    val y = topLeft.y + (squareSize - measured.size.height) / 2
    drawText(measured, topLeft = Offset(x, y))
}

private fun DrawScope.drawCoordinates(
    textMeasurer: TextMeasurer,
    squareSize: Float,
    orientation: com.chess99.engine.Color,
) {
    val style = TextStyle(fontSize = (squareSize * 0.15f).sp, color = Color.Gray)

    // File letters (a-h) along bottom
    for (file in 0..7) {
        val viewFile = if (orientation == com.chess99.engine.Color.WHITE) file else 7 - file
        val label = ('a' + file).toString()
        val measured = textMeasurer.measure(label, style)
        drawText(
            measured,
            topLeft = Offset(
                viewFile * squareSize + squareSize - measured.size.width - 2,
                8 * squareSize - measured.size.height - 1
            )
        )
    }

    // Rank numbers (1-8) along left
    for (rank in 0..7) {
        val viewRank = if (orientation == com.chess99.engine.Color.WHITE) rank else 7 - rank
        val label = (8 - rank).toString()
        val measured = textMeasurer.measure(label, style)
        drawText(measured, topLeft = Offset(2f, viewRank * squareSize + 1))
    }
}

private fun pieceToUnicode(piece: Int): String? {
    val isWhite = Piece.color(piece) == com.chess99.engine.Color.WHITE
    return when (Piece.type(piece)) {
        Piece.KING -> if (isWhite) "\u2654" else "\u265A"
        Piece.QUEEN -> if (isWhite) "\u2655" else "\u265B"
        Piece.ROOK -> if (isWhite) "\u2656" else "\u265C"
        Piece.BISHOP -> if (isWhite) "\u2657" else "\u265D"
        Piece.KNIGHT -> if (isWhite) "\u2658" else "\u265E"
        Piece.PAWN -> if (isWhite) "\u2659" else "\u265F"
        else -> null
    }
}

// ── Colors (matching web frontend) ───────────────────────────────────

private val LightSquareColor = Color(0xFFF0D9B5) // cream/beige
private val DarkSquareColor = Color(0xFFB58863)   // brown
private val LastMoveColor = Color(0x6600FF00)     // green with alpha
private val SelectedSquareColor = Color(0x66FFFF00) // yellow with alpha
private val CheckColor = Color(0x66FF0000)        // red with alpha
private val LegalMoveColor = Color(0x331A1A1A)    // dark with alpha
