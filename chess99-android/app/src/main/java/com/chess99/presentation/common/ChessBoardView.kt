package com.chess99.presentation.common

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chess99.R
import com.chess99.engine.*
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Custom Canvas-based chess board component.
 * Features:
 * - 8x8 grid with configurable colors
 * - High-res Cburnett piece art (matches the web board; drawable-nodpi/piece_*)
 * - Drag-and-drop + tap-tap move input
 * - Legal move highlighting (dots)
 * - Last move highlighting (colored squares)
 * - Check indicator (red king square)
 * - Board orientation flip
 * - Animated piece sliding: the piece that just moved slides from its origin
 *   square to its destination (castling slides the rook too). Suppressed for
 *   drag-and-drop, where the player has already dragged the piece there.
 * - Capture feedback: the taken piece fades and shrinks away as the incoming
 *   piece lands on it, instead of blinking out of existence.
 * - Promotion feedback: the arriving pawn cross-fades into the piece it became.
 * - Haptic feedback on capture
 */
data class BoardArrow(
    val from: Int,
    val to: Int,
    val color: Long, // ARGB
)

@Composable
fun ChessBoardView(
    game: ChessGame,
    modifier: Modifier = Modifier,
    boardOrientation: com.chess99.engine.Color = com.chess99.engine.Color.WHITE,
    isInteractive: Boolean = true,
    lastMoveFrom: Int = -1,
    lastMoveTo: Int = -1,
    lastMoveEffects: MoveEffects = MoveEffects.None,
    arrows: List<BoardArrow> = emptyList(),
    onMove: ((from: String, to: String, promotion: Char?) -> Unit)? = null,
) {
    val haptic = LocalHapticFeedback.current
    val textMeasurer = rememberTextMeasurer()

    // Cburnett piece art (same set the web board uses), loaded once. Keyed by
    // (isWhite, pieceType) via pieceBitmap() below.
    val wP = ImageBitmap.imageResource(R.drawable.piece_wp)
    val wN = ImageBitmap.imageResource(R.drawable.piece_wn)
    val wB = ImageBitmap.imageResource(R.drawable.piece_wb)
    val wR = ImageBitmap.imageResource(R.drawable.piece_wr)
    val wQ = ImageBitmap.imageResource(R.drawable.piece_wq)
    val wK = ImageBitmap.imageResource(R.drawable.piece_wk)
    val bP = ImageBitmap.imageResource(R.drawable.piece_bp)
    val bN = ImageBitmap.imageResource(R.drawable.piece_bn)
    val bB = ImageBitmap.imageResource(R.drawable.piece_bb)
    val bR = ImageBitmap.imageResource(R.drawable.piece_br)
    val bQ = ImageBitmap.imageResource(R.drawable.piece_bq)
    val bK = ImageBitmap.imageResource(R.drawable.piece_bk)

    fun pieceBitmap(piece: Int): ImageBitmap? {
        val white = Piece.color(piece) == com.chess99.engine.Color.WHITE
        return when (Piece.type(piece)) {
            Piece.PAWN -> if (white) wP else bP
            Piece.KNIGHT -> if (white) wN else bN
            Piece.BISHOP -> if (white) wB else bB
            Piece.ROOK -> if (white) wR else bR
            Piece.QUEEN -> if (white) wQ else bQ
            Piece.KING -> if (white) wK else bK
            else -> null
        }
    }

    // Selection state for tap-tap moves
    var selectedSquare by remember { mutableIntStateOf(-1) }
    var legalMoveTargets by remember { mutableStateOf(emptyList<Int>()) }
    var pendingPromotion by remember { mutableStateOf<PendingPromotionMove?>(null) }

    // Drag state
    var draggedPiece by remember { mutableIntStateOf(Piece.NONE) }
    var dragFrom by remember { mutableIntStateOf(-1) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var isDragging by remember { mutableStateOf(false) }

    // ── Move slide animation ─────────────────────────────────────────
    // When a new (lastMoveFrom, lastMoveTo) pair arrives, the piece now sitting
    // on lastMoveTo is drawn sliding in from lastMoveFrom instead of appearing
    // there instantly. A castling move slides the rook alongside the king.
    //
    // Drag-and-drop is excluded: the player has already physically dragged the
    // piece to the destination, so replaying the slide would look like a rewind.
    var animFrom by remember { mutableIntStateOf(-1) }
    var animTo by remember { mutableIntStateOf(-1) }
    var animRookFrom by remember { mutableIntStateOf(-1) }
    var animRookTo by remember { mutableIntStateOf(-1) }
    // Piece taken by the animated move, fading out where it stood.
    var animCaptured by remember { mutableIntStateOf(Piece.NONE) }
    var animCapturedSquare by remember { mutableIntStateOf(-1) }
    // True while the arriving pawn is turning into the piece it promoted to.
    var animPromoting by remember { mutableStateOf(false) }
    val slide = remember { Animatable(1f) }
    // 0 = still a pawn, 1 = fully the promoted piece. Parked at 1 when the
    // move was not a promotion, so the normal draw path is unaffected.
    val promote = remember { Animatable(1f) }
    // Set by onDragEnd so the move it produces is not re-animated.
    var dragMoveSquares by remember { mutableStateOf<Pair<Int, Int>?>(null) }

    LaunchedEffect(lastMoveFrom, lastMoveTo, lastMoveEffects) {
        val wasDragged = dragMoveSquares == (lastMoveFrom to lastMoveTo)
        dragMoveSquares = null

        if (wasDragged || lastMoveFrom < 0 || lastMoveTo < 0 || lastMoveFrom == lastMoveTo) {
            animFrom = -1
            animTo = -1
            animRookFrom = -1
            animRookTo = -1
            animCaptured = Piece.NONE
            animCapturedSquare = -1
            animPromoting = false
            slide.snapTo(1f)
            promote.snapTo(1f)
            return@LaunchedEffect
        }

        animFrom = lastMoveFrom
        animTo = lastMoveTo

        // Castling also moves a rook; slide it alongside the king.
        val moved = game.get(lastMoveTo)
        val isKing = moved != Piece.NONE && Piece.type(moved) == Piece.KING
        val rookSlide = BoardGeometry.castlingRookSlide(lastMoveFrom, lastMoveTo, isKing)
        animRookFrom = rookSlide?.first ?: -1
        animRookTo = rookSlide?.second ?: -1

        animCaptured = if (lastMoveEffects.hasCapture) lastMoveEffects.capturedPiece else Piece.NONE
        animCapturedSquare = if (lastMoveEffects.hasCapture) lastMoveEffects.capturedSquare else -1
        animPromoting = lastMoveEffects.isPromotion

        promote.snapTo(if (animPromoting) 0f else 1f)
        slide.snapTo(0f)
        slide.animateTo(1f, tween(MOVE_ANIMATION_MS, easing = FastOutSlowInEasing))

        // The victim has finished fading by the time the mover lands.
        animCaptured = Piece.NONE
        animCapturedSquare = -1

        if (animPromoting) {
            promote.animateTo(1f, tween(PROMOTION_ANIMATION_MS, easing = FastOutSlowInEasing))
        }

        animFrom = -1
        animTo = -1
        animRookFrom = -1
        animRookTo = -1
        animPromoting = false
    }

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

        fun boardToView(sq: Int): Offset = squareTopLeft(sq, squareSize, boardOrientation)

        fun selectSquare(sq: Int) {
            val piece = game.get(sq)
            if (piece != Piece.NONE && Piece.color(piece) == game.turn) {
                selectedSquare = sq
                legalMoveTargets = game.legalMovesFrom(sq).map { it.to }
            }
        }

        fun submitMove(fromSq: Int, toSq: Int, piece: Int, dragged: Boolean = false) {
            val from = Square.toAlgebraic(fromSq)
            val to = Square.toAlgebraic(toSq)
            val isPromotion = Piece.type(piece) == Piece.PAWN &&
                (Square.rank(toSq) == 0 || Square.rank(toSq) == 7)
            if (isPromotion) {
                pendingPromotion = PendingPromotionMove(from, to, fromSq, toSq, dragged)
            } else {
                if (dragged) dragMoveSquares = fromSq to toSq
                onMove?.invoke(from, to, null)
            }
        }

        val boardDescription = boardContentDescription(
            turnIsWhite = game.turn == com.chess99.engine.Color.WHITE,
            inCheck = game.isCheck(),
            lastMoveFrom = lastMoveFrom,
            lastMoveTo = lastMoveTo,
        )

        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .semantics {
                    contentDescription = boardDescription
                    liveRegion = LiveRegionMode.Polite
                }
                .pointerInput(isInteractive, game.fen()) {
                    if (!isInteractive) return@pointerInput
                    detectTapGestures { offset ->
                        val sq = viewToBoard(offset.x, offset.y)
                        if (selectedSquare != -1 && sq in legalMoveTargets) {
                            // Execute move
                            val piece = game.get(selectedSquare)
                            val captured = game.get(sq)
                            if (captured != Piece.NONE) {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            }
                            submitMove(selectedSquare, sq, piece)
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
                                    val captured = game.get(sq)
                                    if (captured != Piece.NONE) {
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    submitMove(dragFrom, sq, draggedPiece, dragged = true)
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
                    // Mid-slide the moved piece (and a castling rook) is drawn
                    // separately at its interpolated position, below.
                    if (sq == animTo || sq == animRookTo) continue

                    val viewFile = if (boardOrientation == com.chess99.engine.Color.WHITE) file else 7 - file
                    val viewRank = if (boardOrientation == com.chess99.engine.Color.WHITE) rank else 7 - rank
                    val x = viewFile * sqSize
                    val y = viewRank * sqSize

                    pieceBitmap(piece)?.let { drawPieceImage(it, Offset(x, y), sqSize) }
                }
            }

            // The piece this move captured is already off the board, so draw it
            // back in on the square it was standing on, fading and shrinking so
            // it has left by the time the incoming piece lands on top of it.
            if (animCaptured != Piece.NONE && animCapturedSquare >= 0) {
                val t = slide.value.coerceIn(0f, 1f)
                pieceBitmap(animCaptured)?.let {
                    drawPieceImage(
                        image = it,
                        topLeft = squareTopLeft(animCapturedSquare, sqSize, boardOrientation),
                        squareSize = sqSize,
                        alpha = 1f - t,
                        scale = 1f - CAPTURE_SHRINK * t,
                    )
                }
            }

            // Draw the sliding piece(s) at their interpolated position. Reading
            // slide.value here keeps the redraw in the draw phase only.
            if (animTo >= 0) {
                val t = slide.value
                for ((fromSq, toSq) in listOf(animFrom to animTo, animRookFrom to animRookTo)) {
                    if (fromSq < 0 || toSq < 0) continue
                    val piece = game.get(toSq)
                    if (piece == Piece.NONE) continue
                    val start = squareTopLeft(fromSq, sqSize, boardOrientation)
                    val end = squareTopLeft(toSq, sqSize, boardOrientation)
                    val pos = Offset(
                        start.x + (end.x - start.x) * t,
                        start.y + (end.y - start.y) * t,
                    )
                    if (toSq == animTo && animPromoting) {
                        // Travel as a pawn, arrive as whatever it became.
                        val p = promote.value.coerceIn(0f, 1f)
                        val pawn = Piece.make(Piece.PAWN, Piece.color(piece))
                        if (p < 1f) {
                            pieceBitmap(pawn)?.let {
                                drawPieceImage(it, pos, sqSize, alpha = 1f - p, scale = 1f - PROMOTION_DIP * p)
                            }
                        }
                        if (p > 0f) {
                            pieceBitmap(piece)?.let {
                                drawPieceImage(
                                    image = it,
                                    topLeft = pos,
                                    squareSize = sqSize,
                                    alpha = p,
                                    scale = (1f - PROMOTION_DIP) + PROMOTION_DIP * p,
                                )
                            }
                        }
                    } else {
                        pieceBitmap(piece)?.let { drawPieceImage(it, pos, sqSize) }
                    }
                }
            }

            // Draw dragged piece at cursor position (slightly enlarged, lifted)
            if (isDragging && draggedPiece != Piece.NONE) {
                pieceBitmap(draggedPiece)?.let {
                    val lifted = sqSize * 1.15f
                    val x = dragOffset.x - lifted / 2
                    val y = dragOffset.y - lifted / 2
                    drawPieceImage(it, Offset(x, y), lifted)
                }
            }

            // Draw analysis arrows
            for (arrow in arrows) {
                val fromPos = boardToView(arrow.from)
                val toPos = boardToView(arrow.to)
                drawArrowOnBoard(
                    from = Offset(fromPos.x + sqSize / 2, fromPos.y + sqSize / 2),
                    to = Offset(toPos.x + sqSize / 2, toPos.y + sqSize / 2),
                    color = Color(arrow.color),
                    squareSize = sqSize,
                )
            }

            // Draw coordinates
            drawCoordinates(textMeasurer, sqSize, boardOrientation)
        }
    }

    pendingPromotion?.let { move ->
        PromotionChoiceDialog(
            onChoose = { promotion ->
                if (move.dragged) dragMoveSquares = move.fromSquare to move.toSquare
                pendingPromotion = null
                onMove?.invoke(move.from, move.to, promotion)
            },
            onDismiss = { pendingPromotion = null },
        )
    }
}

private data class PendingPromotionMove(
    val from: String,
    val to: String,
    val fromSquare: Int,
    val toSquare: Int,
    val dragged: Boolean,
)

/**
 * Visible, non-overlapping move entry for switch access, keyboards and TalkBack.
 * It deliberately sits outside the square Canvas so gesture play remains intact.
 */
@Composable
fun AccessibleChessMoveControls(
    game: ChessGame,
    isInteractive: Boolean,
    onMove: (from: String, to: String, promotion: Char?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    var selectedFrom by remember(game.fen()) { mutableIntStateOf(-1) }
    var pendingPromotion by remember { mutableStateOf<PendingPromotionMove?>(null) }
    val legalMoves = remember(game.fen()) { accessibleMoveOptions(game) }
    val sourceSquares = remember(legalMoves) { legalMoves.map { it.fromSquare }.distinct() }
    val destinations = remember(legalMoves, selectedFrom) {
        legalMoves.filter { it.fromSquare == selectedFrom }.map { it.toSquare }.distinct()
    }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = { expanded = !expanded },
            enabled = isInteractive,
            modifier = Modifier
                .fillMaxWidth()
                .sizeIn(minHeight = 48.dp),
        ) {
            Text(if (expanded) "Close accessible move input" else "Accessible move input")
        }

        if (expanded) {
            Text(
                text = if (selectedFrom == -1) {
                    "Choose one of your pieces"
                } else {
                    "${pieceSpokenName(game.get(selectedFrom))} on ${Square.toAlgebraic(selectedFrom)} selected. Choose a legal destination."
                },
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(vertical = 4.dp),
            )
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                sourceSquares.forEach { square ->
                    OutlinedButton(
                        onClick = { selectedFrom = square },
                        modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
                    ) {
                        Text("${pieceSpokenName(game.get(square))} ${Square.toAlgebraic(square)}")
                    }
                }
            }
            if (selectedFrom != -1) {
                Row(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    destinations.forEach { toSquare ->
                        Button(
                            onClick = {
                                val from = Square.toAlgebraic(selectedFrom)
                                val to = Square.toAlgebraic(toSquare)
                                val piece = game.get(selectedFrom)
                                val promotes = Piece.type(piece) == Piece.PAWN &&
                                    (Square.rank(toSquare) == 0 || Square.rank(toSquare) == 7)
                                if (promotes) {
                                    pendingPromotion = PendingPromotionMove(
                                        from,
                                        to,
                                        selectedFrom,
                                        toSquare,
                                        dragged = false,
                                    )
                                } else {
                                    onMove(from, to, null)
                                    selectedFrom = -1
                                }
                            },
                            modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
                        ) {
                            Text("Move to ${Square.toAlgebraic(toSquare)}")
                        }
                    }
                }
            }
        }
    }

    pendingPromotion?.let { move ->
        PromotionChoiceDialog(
            onChoose = { promotion ->
                pendingPromotion = null
                selectedFrom = -1
                onMove(move.from, move.to, promotion)
            },
            onDismiss = { pendingPromotion = null },
        )
    }
}

internal data class AccessibleMoveOption(
    val fromSquare: Int,
    val toSquare: Int,
    val promotion: Char?,
)

/** Same legal-move source used by gestures, exposed for deterministic a11y tests. */
internal fun accessibleMoveOptions(game: ChessGame): List<AccessibleMoveOption> =
    game.legalMoves().map { move ->
        AccessibleMoveOption(
            fromSquare = move.from,
            toSquare = move.to,
            promotion = move.uci().getOrNull(4),
        )
    }

@Composable
private fun PromotionChoiceDialog(
    onChoose: (Char) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose promotion piece") },
        text = { Text("Promote the pawn to a queen, rook, bishop or knight.") },
        confirmButton = {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                listOf('q' to "Queen", 'r' to "Rook", 'b' to "Bishop", 'n' to "Knight")
                    .forEach { (piece, label) ->
                        TextButton(
                            onClick = { onChoose(piece) },
                            modifier = Modifier.sizeIn(minHeight = 48.dp),
                        ) { Text(label) }
                    }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.sizeIn(minHeight = 48.dp),
            ) { Text("Cancel") }
        },
    )
}

private fun pieceSpokenName(piece: Int): String {
    val color = if (Piece.color(piece) == com.chess99.engine.Color.WHITE) "White" else "Black"
    val name = when (Piece.type(piece)) {
        Piece.PAWN -> "pawn"
        Piece.KNIGHT -> "knight"
        Piece.BISHOP -> "bishop"
        Piece.ROOK -> "rook"
        Piece.QUEEN -> "queen"
        Piece.KING -> "king"
        else -> "piece"
    }
    return "$color $name"
}

// ── Drawing Helpers ──────────────────────────────────────────────────

/**
 * Spoken summary of the board for TalkBack. The Canvas draws everything itself,
 * so without this the whole board is invisible to screen readers.
 */
@Composable
private fun boardContentDescription(
    turnIsWhite: Boolean,
    inCheck: Boolean,
    lastMoveFrom: Int,
    lastMoveTo: Int,
): String {
    val side = stringResource(if (turnIsWhite) R.string.board_a11y_white else R.string.board_a11y_black)
    val parts = mutableListOf(stringResource(R.string.board_a11y_board))
    if (lastMoveFrom >= 0 && lastMoveTo >= 0) {
        parts += stringResource(
            R.string.board_a11y_last_move,
            Square.toAlgebraic(lastMoveFrom),
            Square.toAlgebraic(lastMoveTo),
        )
    }
    parts += stringResource(R.string.board_a11y_to_move, side)
    if (inCheck) parts += stringResource(R.string.board_a11y_in_check, side)
    return parts.joinToString(" ")
}

/** How long a piece takes to slide to its destination square. */
private const val MOVE_ANIMATION_MS = 180

/**
 * How long the arriving pawn takes to become the piece it promoted to. Runs
 * after the slide, so a promotion animates for MOVE_ANIMATION_MS + this —
 * still comfortably inside the fastest replay auto-play interval (1000 ms).
 */
private const val PROMOTION_ANIMATION_MS = 120

/** How far a captured piece shrinks while fading out. */
private const val CAPTURE_SHRINK = 0.25f

/** How far the promoting piece scales down at the mid-point of the cross-fade. */
private const val PROMOTION_DIP = 0.25f

/** Top-left pixel offset of a 0x88 square, honouring board orientation. */
private fun squareTopLeft(
    sq: Int,
    squareSize: Float,
    orientation: com.chess99.engine.Color,
): Offset {
    val whiteAtBottom = orientation == com.chess99.engine.Color.WHITE
    return Offset(
        BoardGeometry.viewFile(sq, whiteAtBottom) * squareSize,
        BoardGeometry.viewRank(sq, whiteAtBottom) * squareSize,
    )
}

/**
 * Pure board geometry, split out from the drawing code so it can be unit
 * tested on the JVM (no Compose or Android classes involved).
 */
internal object BoardGeometry {
    /** Column a piece is drawn in, 0 = left edge, given board orientation. */
    fun viewFile(sq: Int, whiteAtBottom: Boolean): Int {
        val file = Square.file(sq)
        return if (whiteAtBottom) file else 7 - file
    }

    /** Row a piece is drawn in, 0 = top edge, given board orientation. */
    fun viewRank(sq: Int, whiteAtBottom: Boolean): Int {
        val rank = Square.rank(sq)
        return if (whiteAtBottom) rank else 7 - rank
    }

    /**
     * Origin and destination of the rook in a castling move, or null when the
     * move was not a castle. The king travels exactly two files; the rook has
     * already been placed on the square the king crossed, so we slide it in
     * from the corner it started on.
     */
    fun castlingRookSlide(from: Int, to: Int, movedPieceIsKing: Boolean): Pair<Int, Int>? {
        if (!movedPieceIsKing) return null
        if (Square.rank(from) != Square.rank(to)) return null
        val fileDelta = Square.file(to) - Square.file(from)
        val rank = Square.rank(to)
        return when (fileDelta) {
            2 -> (rank * 16 + 7) to (rank * 16 + 5)  // king-side: h-file rook -> f-file
            -2 -> (rank * 16 + 0) to (rank * 16 + 3) // queen-side: a-file rook -> d-file
            else -> null
        }
    }
}

private fun DrawScope.drawPieceImage(
    image: ImageBitmap,
    topLeft: Offset,
    squareSize: Float,
    alpha: Float = 1f,
    scale: Float = 1f,
) {
    val drawnSize = squareSize * scale
    val size = drawnSize.roundToInt()
    if (size <= 0) return
    // Shrinking keeps the piece centred on its square rather than pinned to the
    // top-left corner of it.
    val inset = (squareSize - drawnSize) / 2f
    drawImage(
        image = image,
        srcOffset = IntOffset.Zero,
        srcSize = IntSize(image.width, image.height),
        dstOffset = IntOffset((topLeft.x + inset).roundToInt(), (topLeft.y + inset).roundToInt()),
        dstSize = IntSize(size, size),
        alpha = alpha.coerceIn(0f, 1f),
        filterQuality = FilterQuality.High,
    )
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

private fun DrawScope.drawArrowOnBoard(
    from: Offset,
    to: Offset,
    color: Color,
    squareSize: Float,
) {
    val shaftWidth = squareSize * 0.15f
    val headLength = squareSize * 0.35f
    val headWidth = squareSize * 0.3f

    val dx = to.x - from.x
    val dy = to.y - from.y
    val length = kotlin.math.sqrt(dx * dx + dy * dy)
    if (length < 1f) return

    val ux = dx / length
    val uy = dy / length

    // Shaft: from slightly past start to slightly before arrowhead
    val shaftStart = Offset(from.x + ux * squareSize * 0.3f, from.y + uy * squareSize * 0.3f)
    val shaftEnd = Offset(to.x - ux * headLength, to.y - uy * headLength)

    // Perpendicular unit vector
    val px = -uy
    val py = ux

    // Draw shaft as a filled rectangle (two triangles)
    val s1 = Offset(shaftStart.x + px * shaftWidth / 2, shaftStart.y + py * shaftWidth / 2)
    val s2 = Offset(shaftStart.x - px * shaftWidth / 2, shaftStart.y - py * shaftWidth / 2)
    val s3 = Offset(shaftEnd.x + px * shaftWidth / 2, shaftEnd.y + py * shaftWidth / 2)
    val s4 = Offset(shaftEnd.x - px * shaftWidth / 2, shaftEnd.y - py * shaftWidth / 2)

    val shaftPath = androidx.compose.ui.graphics.Path().apply {
        moveTo(s1.x, s1.y)
        lineTo(s3.x, s3.y)
        lineTo(s4.x, s4.y)
        lineTo(s2.x, s2.y)
        close()
    }
    drawPath(shaftPath, color)

    // Draw arrowhead as a filled triangle
    val h1 = to
    val h2 = Offset(shaftEnd.x + px * headWidth / 2, shaftEnd.y + py * headWidth / 2)
    val h3 = Offset(shaftEnd.x - px * headWidth / 2, shaftEnd.y - py * headWidth / 2)

    val headPath = androidx.compose.ui.graphics.Path().apply {
        moveTo(h1.x, h1.y)
        lineTo(h2.x, h2.y)
        lineTo(h3.x, h3.y)
        close()
    }
    drawPath(headPath, color)
}

// ── Colors (matching web frontend) ───────────────────────────────────

private val LightSquareColor = Color(0xFFF0D9B5) // cream/beige
private val DarkSquareColor = Color(0xFFB58863)   // brown
private val LastMoveColor = Color(0x6600FF00)     // green with alpha
private val SelectedSquareColor = Color(0x66FFFF00) // yellow with alpha
private val CheckColor = Color(0x66FF0000)        // red with alpha
private val LegalMoveColor = Color(0x331A1A1A)    // dark with alpha
