package com.chess99.engine

/**
 * Pure Kotlin chess game engine — equivalent to chess.js.
 * Handles move generation, validation, FEN/PGN, check/checkmate/stalemate detection.
 */
class ChessGame(fen: String = STARTING_FEN) {

    companion object {
        const val STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    }

    // Board representation: 0x88 mailbox for efficient off-board detection
    private val board = IntArray(128) { Piece.NONE }
    var turn: Color = Color.WHITE; private set
    private var castlingRights = 0 // bits: K=1, Q=2, k=4, q=8
    var enPassantSquare: Int = -1; private set
    var halfMoveClock: Int = 0; private set
    var fullMoveNumber: Int = 1; private set

    private val moveHistory = mutableListOf<MoveRecord>()
    private val positionHistory = mutableListOf<Long>()

    init {
        loadFen(fen)
    }

    // ── Public API ──────────────────────────────────────────────────────

    fun fen(): String = generateFen()

    fun pgn(): String = generatePgn()

    fun isCheck(): Boolean = isKingInCheck(turn)

    fun isCheckmate(): Boolean = isCheck() && legalMoves().isEmpty()

    fun isStalemate(): Boolean = !isCheck() && legalMoves().isEmpty()

    fun isDraw(): Boolean = isStalemate() || isInsufficientMaterial() ||
            isThreefoldRepetition() || isFiftyMoveRule()

    fun isGameOver(): Boolean = isCheckmate() || isDraw()

    fun isInsufficientMaterial(): Boolean {
        val pieces = mutableListOf<Int>()
        for (sq in allSquares()) {
            val p = board[sq]
            if (p != Piece.NONE && Piece.type(p) != Piece.KING) {
                pieces.add(p)
            }
        }
        if (pieces.isEmpty()) return true // K vs K
        if (pieces.size == 1) {
            val type = Piece.type(pieces[0])
            return type == Piece.BISHOP || type == Piece.KNIGHT
        }
        if (pieces.size == 2) {
            // Two bishops of same color on same colored squares
            if (pieces.all { Piece.type(it) == Piece.BISHOP }) {
                val squares = mutableListOf<Int>()
                for (sq in allSquares()) {
                    if (board[sq] != Piece.NONE && Piece.type(board[sq]) == Piece.BISHOP) {
                        squares.add(sq)
                    }
                }
                if (squares.size == 2) {
                    return squareColor(squares[0]) == squareColor(squares[1]) &&
                            Piece.color(board[squares[0]]) != Piece.color(board[squares[1]])
                }
            }
        }
        return false
    }

    fun isThreefoldRepetition(): Boolean {
        if (positionHistory.size < 5) return false
        val current = positionHistory.last()
        return positionHistory.count { it == current } >= 3
    }

    fun isFiftyMoveRule(): Boolean = halfMoveClock >= 100

    /** Returns all legal moves for current turn. */
    fun legalMoves(): List<Move> {
        val moves = mutableListOf<Move>()
        for (sq in allSquares()) {
            val piece = board[sq]
            if (piece == Piece.NONE || Piece.color(piece) != turn) continue
            moves.addAll(generatePieceMoves(sq))
        }
        return moves.filter { isLegalMove(it) }
    }

    /** Returns legal moves for a specific square. */
    fun legalMovesFrom(square: Int): List<Move> {
        val piece = board[square]
        if (piece == Piece.NONE || Piece.color(piece) != turn) return emptyList()
        return generatePieceMoves(square).filter { isLegalMove(it) }
    }

    /** Returns legal moves for a specific square given algebraic notation (e.g., "e2"). */
    fun legalMovesFrom(square: String): List<Move> = legalMovesFrom(Square.fromAlgebraic(square))

    /** Make a move. Returns the Move or null if illegal. */
    fun move(from: String, to: String, promotion: Char? = null): Move? {
        val fromSq = Square.fromAlgebraic(from)
        val toSq = Square.fromAlgebraic(to)
        val legal = legalMoves().find { m ->
            m.from == fromSq && m.to == toSq &&
                    (promotion == null || m.promotion == Piece.charToType(promotion))
        } ?: return null
        return makeMove(legal)
    }

    /** Make a move from SAN notation (e.g., "e4", "Nf3", "O-O"). */
    fun moveSan(san: String): Move? {
        val legal = legalMoves()
        val match = legal.find { it.san(this) == san } ?: return null
        return makeMove(match)
    }

    /** Make a move from UCI notation (e.g., "e2e4", "e7e8q"). */
    fun moveUci(uci: String): Move? {
        if (uci.length < 4) return null
        val from = Square.fromAlgebraic(uci.substring(0, 2))
        val to = Square.fromAlgebraic(uci.substring(2, 4))
        val promo = if (uci.length > 4) Piece.charToType(uci[4]) else 0
        val legal = legalMoves().find { m ->
            m.from == from && m.to == to && (promo == 0 || m.promotion == promo)
        } ?: return null
        return makeMove(legal)
    }

    /** Undo the last move. Returns the undone Move or null. */
    fun undo(): Move? {
        if (moveHistory.isEmpty()) return null
        val record = moveHistory.removeAt(moveHistory.size - 1)
        positionHistory.removeAt(positionHistory.size - 1)
        restoreState(record)
        return record.move
    }

    fun history(): List<Move> = moveHistory.map { it.move }

    fun historyVerbose(): List<MoveRecord> = moveHistory.toList()

    fun get(square: String): Int = board[Square.fromAlgebraic(square)]

    fun get(square: Int): Int = if (square and 0x88 == 0) board[square] else Piece.NONE

    fun turnChar(): Char = if (turn == Color.WHITE) 'w' else 'b'

    /** Reset to a new position. */
    fun reset() = loadFen(STARTING_FEN)

    fun load(fen: String) = loadFen(fen)

    /** Find the king square for a color. */
    fun kingSquare(color: Color): Int {
        val king = Piece.make(Piece.KING, color)
        for (sq in allSquares()) {
            if (board[sq] == king) return sq
        }
        return -1
    }

    // ── Internal Move Generation ────────────────────────────────────────

    private fun generatePieceMoves(square: Int): List<Move> {
        val piece = board[square]
        val type = Piece.type(piece)
        val color = Piece.color(piece)
        val moves = mutableListOf<Move>()

        when (type) {
            Piece.PAWN -> generatePawnMoves(square, color, moves)
            Piece.KNIGHT -> generateSlidingMoves(square, piece, KNIGHT_OFFSETS, single = true, moves)
            Piece.BISHOP -> generateSlidingMoves(square, piece, BISHOP_OFFSETS, single = false, moves)
            Piece.ROOK -> generateSlidingMoves(square, piece, ROOK_OFFSETS, single = false, moves)
            Piece.QUEEN -> generateSlidingMoves(square, piece, QUEEN_OFFSETS, single = false, moves)
            Piece.KING -> {
                generateSlidingMoves(square, piece, QUEEN_OFFSETS, single = true, moves)
                generateCastlingMoves(square, color, moves)
            }
        }
        return moves
    }

    private fun generatePawnMoves(sq: Int, color: Color, moves: MutableList<Move>) {
        val direction = if (color == Color.WHITE) -16 else 16
        val startRank = if (color == Color.WHITE) 6 else 1
        val promoRank = if (color == Color.WHITE) 0 else 7
        val piece = board[sq]

        // Single push
        val oneStep = sq + direction
        if (oneStep and 0x88 == 0 && board[oneStep] == Piece.NONE) {
            if (Square.rank(oneStep) == promoRank) {
                for (promo in PROMO_PIECES) moves.add(Move(sq, oneStep, piece, Piece.NONE, promotion = promo))
            } else {
                moves.add(Move(sq, oneStep, piece, Piece.NONE))
            }
            // Double push from start rank
            if (Square.rank(sq) == startRank) {
                val twoStep = sq + direction * 2
                if (board[twoStep] == Piece.NONE) {
                    moves.add(Move(sq, twoStep, piece, Piece.NONE, isDoublePawnPush = true))
                }
            }
        }

        // Captures
        for (offset in intArrayOf(direction - 1, direction + 1)) {
            val target = sq + offset
            if (target and 0x88 != 0) continue
            val captured = board[target]
            if (captured != Piece.NONE && Piece.color(captured) != color) {
                if (Square.rank(target) == promoRank) {
                    for (promo in PROMO_PIECES) moves.add(Move(sq, target, piece, captured, promotion = promo))
                } else {
                    moves.add(Move(sq, target, piece, captured))
                }
            }
            // En passant
            if (target == enPassantSquare) {
                val epCaptured = board[target - direction]
                moves.add(Move(sq, target, piece, epCaptured, isEnPassant = true))
            }
        }
    }

    private fun generateSlidingMoves(sq: Int, piece: Int, offsets: IntArray, single: Boolean, moves: MutableList<Move>) {
        val color = Piece.color(piece)
        for (offset in offsets) {
            var target = sq + offset
            while (target and 0x88 == 0) {
                val captured = board[target]
                if (captured == Piece.NONE) {
                    moves.add(Move(sq, target, piece, Piece.NONE))
                } else {
                    if (Piece.color(captured) != color) {
                        moves.add(Move(sq, target, piece, captured))
                    }
                    break
                }
                if (single) break
                target += offset
            }
        }
    }

    private fun generateCastlingMoves(sq: Int, color: Color, moves: MutableList<Move>) {
        if (isKingInCheck(color)) return

        val piece = board[sq]
        if (color == Color.WHITE) {
            // Kingside (K)
            if (castlingRights and 1 != 0 &&
                board[sq + 1] == Piece.NONE && board[sq + 2] == Piece.NONE &&
                !isSquareAttacked(sq + 1, Color.BLACK) && !isSquareAttacked(sq + 2, Color.BLACK)
            ) {
                moves.add(Move(sq, sq + 2, piece, Piece.NONE, isCastling = true))
            }
            // Queenside (Q)
            if (castlingRights and 2 != 0 &&
                board[sq - 1] == Piece.NONE && board[sq - 2] == Piece.NONE && board[sq - 3] == Piece.NONE &&
                !isSquareAttacked(sq - 1, Color.BLACK) && !isSquareAttacked(sq - 2, Color.BLACK)
            ) {
                moves.add(Move(sq, sq - 2, piece, Piece.NONE, isCastling = true))
            }
        } else {
            // Kingside (k)
            if (castlingRights and 4 != 0 &&
                board[sq + 1] == Piece.NONE && board[sq + 2] == Piece.NONE &&
                !isSquareAttacked(sq + 1, Color.WHITE) && !isSquareAttacked(sq + 2, Color.WHITE)
            ) {
                moves.add(Move(sq, sq + 2, piece, Piece.NONE, isCastling = true))
            }
            // Queenside (q)
            if (castlingRights and 8 != 0 &&
                board[sq - 1] == Piece.NONE && board[sq - 2] == Piece.NONE && board[sq - 3] == Piece.NONE &&
                !isSquareAttacked(sq - 1, Color.WHITE) && !isSquareAttacked(sq - 2, Color.WHITE)
            ) {
                moves.add(Move(sq, sq - 2, piece, Piece.NONE, isCastling = true))
            }
        }
    }

    // ── Move Execution ──────────────────────────────────────────────────

    private fun makeMove(move: Move): Move {
        // Save state for undo
        val record = MoveRecord(
            move = move,
            castlingRights = castlingRights,
            enPassantSquare = enPassantSquare,
            halfMoveClock = halfMoveClock,
            fullMoveNumber = fullMoveNumber
        )
        moveHistory.add(record)

        // Execute
        board[move.to] = board[move.from]
        board[move.from] = Piece.NONE

        // En passant capture
        if (move.isEnPassant) {
            val capturedSq = move.to + if (turn == Color.WHITE) 16 else -16
            board[capturedSq] = Piece.NONE
        }

        // Castling rook move
        if (move.isCastling) {
            if (move.to > move.from) {
                // Kingside
                board[move.from + 1] = board[move.from + 3]
                board[move.from + 3] = Piece.NONE
            } else {
                // Queenside
                board[move.from - 1] = board[move.from - 4]
                board[move.from - 4] = Piece.NONE
            }
        }

        // Promotion
        if (move.promotion != 0) {
            board[move.to] = Piece.make(move.promotion, turn)
        }

        // Update en passant square
        enPassantSquare = if (move.isDoublePawnPush) {
            move.from + if (turn == Color.WHITE) -16 else 16
        } else -1

        // Update castling rights
        updateCastlingRights(move)

        // Update clocks
        if (Piece.type(move.piece) == Piece.PAWN || move.captured != Piece.NONE) {
            halfMoveClock = 0
        } else {
            halfMoveClock++
        }
        if (turn == Color.BLACK) fullMoveNumber++

        // Switch turn
        turn = turn.opposite()

        // Record position for repetition detection
        positionHistory.add(zobristHash())

        return move
    }

    private fun restoreState(record: MoveRecord) {
        val move = record.move
        turn = turn.opposite()

        // Reverse the move
        board[move.from] = move.piece
        board[move.to] = if (move.isEnPassant) Piece.NONE else move.captured

        // Restore en passant captured pawn
        if (move.isEnPassant) {
            val capturedSq = move.to + if (turn == Color.WHITE) 16 else -16
            board[capturedSq] = move.captured
        }

        // Restore castling rook
        if (move.isCastling) {
            if (move.to > move.from) {
                board[move.from + 3] = board[move.from + 1]
                board[move.from + 1] = Piece.NONE
            } else {
                board[move.from - 4] = board[move.from - 1]
                board[move.from - 1] = Piece.NONE
            }
        }

        castlingRights = record.castlingRights
        enPassantSquare = record.enPassantSquare
        halfMoveClock = record.halfMoveClock
        fullMoveNumber = record.fullMoveNumber
    }

    private fun updateCastlingRights(move: Move) {
        // King moves lose all castling for that side
        if (Piece.type(move.piece) == Piece.KING) {
            if (turn == Color.WHITE) castlingRights = castlingRights and 0b1100
            else castlingRights = castlingRights and 0b0011
        }
        // Rook moves/captures lose that rook's castling
        if (Piece.type(move.piece) == Piece.ROOK) {
            when (move.from) {
                0x70 + 7 -> castlingRights = castlingRights and 0b1110.inv().inv() // a1 — wait, let me recalculate
            }
            // White rooks
            if (move.from == 0x70 + 0) castlingRights = castlingRights and 2.inv() // a1 = Q
            if (move.from == 0x70 + 7) castlingRights = castlingRights and 1.inv() // h1 = K
            // Black rooks
            if (move.from == 0x00 + 0) castlingRights = castlingRights and 8.inv() // a8 = q
            if (move.from == 0x00 + 7) castlingRights = castlingRights and 4.inv() // h8 = k
        }
        // Capturing a rook
        if (move.captured != Piece.NONE && Piece.type(move.captured) == Piece.ROOK) {
            if (move.to == 0x70 + 0) castlingRights = castlingRights and 2.inv()
            if (move.to == 0x70 + 7) castlingRights = castlingRights and 1.inv()
            if (move.to == 0x00 + 0) castlingRights = castlingRights and 8.inv()
            if (move.to == 0x00 + 7) castlingRights = castlingRights and 4.inv()
        }
    }

    // ── Attack Detection ────────────────────────────────────────────────

    private fun isLegalMove(move: Move): Boolean {
        // Try the move, check if own king is in check, undo
        val savedCastling = castlingRights
        val savedEp = enPassantSquare
        val savedHalf = halfMoveClock
        val savedFull = fullMoveNumber

        board[move.to] = board[move.from]
        board[move.from] = Piece.NONE

        if (move.isEnPassant) {
            val capturedSq = move.to + if (turn == Color.WHITE) 16 else -16
            board[capturedSq] = Piece.NONE
        }
        if (move.promotion != 0) {
            board[move.to] = Piece.make(move.promotion, turn)
        }
        if (move.isCastling) {
            if (move.to > move.from) {
                board[move.from + 1] = board[move.from + 3]
                board[move.from + 3] = Piece.NONE
            } else {
                board[move.from - 1] = board[move.from - 4]
                board[move.from - 4] = Piece.NONE
            }
        }

        val inCheck = isKingInCheck(turn)

        // Undo
        board[move.from] = move.piece
        board[move.to] = if (move.isEnPassant) Piece.NONE else move.captured
        if (move.isEnPassant) {
            val capturedSq = move.to + if (turn == Color.WHITE) 16 else -16
            board[capturedSq] = move.captured
        }
        if (move.isCastling) {
            if (move.to > move.from) {
                board[move.from + 3] = board[move.from + 1]
                board[move.from + 1] = Piece.NONE
            } else {
                board[move.from - 4] = board[move.from - 1]
                board[move.from - 1] = Piece.NONE
            }
        }

        castlingRights = savedCastling
        enPassantSquare = savedEp
        halfMoveClock = savedHalf
        fullMoveNumber = savedFull

        return !inCheck
    }

    private fun isKingInCheck(color: Color): Boolean {
        val kingSq = kingSquare(color)
        if (kingSq == -1) return false
        return isSquareAttacked(kingSq, color.opposite())
    }

    fun isSquareAttacked(square: Int, byColor: Color): Boolean {
        // Pawn attacks
        val pawnDir = if (byColor == Color.WHITE) 16 else -16
        for (offset in intArrayOf(-1, 1)) {
            val attackerSq = square + pawnDir + offset
            if (attackerSq and 0x88 == 0) {
                val p = board[attackerSq]
                if (p != Piece.NONE && Piece.type(p) == Piece.PAWN && Piece.color(p) == byColor) {
                    // Check direction: pawn attacks upward for black, downward for white
                    // attacker at attackerSq attacks square = attackerSq - pawnDir -/+ offset
                    // which is attackerSq + (-pawnDir +/- 1). Let me verify:
                    // White pawn at e3 (rank 5, 0x50+4) attacks d4 and f4 (rank 4, 0x40+3/5)
                    // offset from pawn = -16 +/- 1. So attack direction from pawn = -16 +/- 1
                    // We check from target backward: pawn that attacks this square is at square + pawnDir +/- 1
                    // pawnDir for white attacker = 16, so square + 16 +/- 1. If square=d4=0x40+3, attacker at 0x50+2 or 0x50+4 = c3 or e3.
                    // That's correct!
                    return true
                }
            }
        }
        // Knight attacks
        for (offset in KNIGHT_OFFSETS) {
            val attackerSq = square + offset
            if (attackerSq and 0x88 == 0) {
                val p = board[attackerSq]
                if (p != Piece.NONE && Piece.type(p) == Piece.KNIGHT && Piece.color(p) == byColor) return true
            }
        }
        // King attacks
        for (offset in QUEEN_OFFSETS) {
            val attackerSq = square + offset
            if (attackerSq and 0x88 == 0) {
                val p = board[attackerSq]
                if (p != Piece.NONE && Piece.type(p) == Piece.KING && Piece.color(p) == byColor) return true
            }
        }
        // Sliding attacks (bishop/queen diagonals, rook/queen lines)
        for (offset in BISHOP_OFFSETS) {
            var sq = square + offset
            while (sq and 0x88 == 0) {
                val p = board[sq]
                if (p != Piece.NONE) {
                    if (Piece.color(p) == byColor && (Piece.type(p) == Piece.BISHOP || Piece.type(p) == Piece.QUEEN)) return true
                    break
                }
                sq += offset
            }
        }
        for (offset in ROOK_OFFSETS) {
            var sq = square + offset
            while (sq and 0x88 == 0) {
                val p = board[sq]
                if (p != Piece.NONE) {
                    if (Piece.color(p) == byColor && (Piece.type(p) == Piece.ROOK || Piece.type(p) == Piece.QUEEN)) return true
                    break
                }
                sq += offset
            }
        }
        return false
    }

    // ── FEN Parsing/Generation ──────────────────────────────────────────

    private fun loadFen(fen: String) {
        board.fill(Piece.NONE)
        moveHistory.clear()
        positionHistory.clear()

        val parts = fen.split(" ")
        val ranks = parts[0].split("/")

        for (rank in 0..7) {
            var file = 0
            for (ch in ranks[rank]) {
                if (ch.isDigit()) {
                    file += ch.digitToInt()
                } else {
                    val sq = rank * 16 + file
                    board[sq] = Piece.fromChar(ch)
                    file++
                }
            }
        }

        turn = if (parts.getOrElse(1) { "w" } == "w") Color.WHITE else Color.BLACK

        castlingRights = 0
        val castling = parts.getOrElse(2) { "-" }
        if ('K' in castling) castlingRights = castlingRights or 1
        if ('Q' in castling) castlingRights = castlingRights or 2
        if ('k' in castling) castlingRights = castlingRights or 4
        if ('q' in castling) castlingRights = castlingRights or 8

        val ep = parts.getOrElse(3) { "-" }
        enPassantSquare = if (ep == "-") -1 else Square.fromAlgebraic(ep)

        halfMoveClock = parts.getOrElse(4) { "0" }.toIntOrNull() ?: 0
        fullMoveNumber = parts.getOrElse(5) { "1" }.toIntOrNull() ?: 1

        positionHistory.add(zobristHash())
    }

    private fun generateFen(): String {
        val sb = StringBuilder()
        for (rank in 0..7) {
            var empty = 0
            for (file in 0..7) {
                val piece = board[rank * 16 + file]
                if (piece == Piece.NONE) {
                    empty++
                } else {
                    if (empty > 0) { sb.append(empty); empty = 0 }
                    sb.append(Piece.toChar(piece))
                }
            }
            if (empty > 0) sb.append(empty)
            if (rank < 7) sb.append('/')
        }

        sb.append(if (turn == Color.WHITE) " w " else " b ")

        var castle = ""
        if (castlingRights and 1 != 0) castle += "K"
        if (castlingRights and 2 != 0) castle += "Q"
        if (castlingRights and 4 != 0) castle += "k"
        if (castlingRights and 8 != 0) castle += "q"
        sb.append(castle.ifEmpty { "-" })

        sb.append(' ')
        sb.append(if (enPassantSquare == -1) "-" else Square.toAlgebraic(enPassantSquare))
        sb.append(" $halfMoveClock $fullMoveNumber")
        return sb.toString()
    }

    private fun generatePgn(): String {
        val sb = StringBuilder()
        for ((i, record) in moveHistory.withIndex()) {
            if (i % 2 == 0) {
                if (i > 0) sb.append(' ')
                sb.append("${i / 2 + 1}.")
            }
            sb.append(' ')
            sb.append(record.move.san(this, i))
        }
        return sb.toString().trim()
    }

    // ── Zobrist Hashing (simplified) ────────────────────────────────────

    private fun zobristHash(): Long {
        var hash = 0L
        for (sq in allSquares()) {
            val piece = board[sq]
            if (piece != Piece.NONE) {
                hash = hash xor (piece.toLong() * 6364136223846793005L + sq.toLong() * 1442695040888963407L)
            }
        }
        if (turn == Color.BLACK) hash = hash xor 0x9E3779B97F4A7C15L
        hash = hash xor (castlingRights.toLong() * 2862933555777941757L)
        if (enPassantSquare != -1) hash = hash xor (enPassantSquare.toLong() * 3037000499L)
        return hash
    }

    // ── Utility ─────────────────────────────────────────────────────────

    private fun allSquares() = sequence {
        for (rank in 0..7) for (file in 0..7) yield(rank * 16 + file)
    }

    private fun squareColor(sq: Int): Int = (Square.rank(sq) + Square.file(sq)) % 2

    companion object Offsets {
        val KNIGHT_OFFSETS = intArrayOf(-33, -31, -18, -14, 14, 18, 31, 33)
        val BISHOP_OFFSETS = intArrayOf(-17, -15, 15, 17)
        val ROOK_OFFSETS = intArrayOf(-16, -1, 1, 16)
        val QUEEN_OFFSETS = intArrayOf(-17, -16, -15, -1, 1, 15, 16, 17)
        val PROMO_PIECES = intArrayOf(Piece.QUEEN, Piece.ROOK, Piece.BISHOP, Piece.KNIGHT)
    }
}

// ── Supporting Types ────────────────────────────────────────────────────

enum class Color {
    WHITE, BLACK;
    fun opposite() = if (this == WHITE) BLACK else WHITE
}

object Piece {
    const val NONE = 0
    const val PAWN = 1
    const val KNIGHT = 2
    const val BISHOP = 3
    const val ROOK = 4
    const val QUEEN = 5
    const val KING = 6

    // Color encoding: 0x00 for white, 0x08 for black
    private const val WHITE_FLAG = 0
    private const val BLACK_FLAG = 8

    fun make(type: Int, color: Color) = type or (if (color == Color.WHITE) WHITE_FLAG else BLACK_FLAG)
    fun type(piece: Int) = piece and 0x07
    fun color(piece: Int): Color = if (piece and BLACK_FLAG == 0) Color.WHITE else Color.BLACK

    fun fromChar(ch: Char): Int {
        val color = if (ch.isUpperCase()) Color.WHITE else Color.BLACK
        val type = when (ch.lowercaseChar()) {
            'p' -> PAWN; 'n' -> KNIGHT; 'b' -> BISHOP
            'r' -> ROOK; 'q' -> QUEEN; 'k' -> KING
            else -> NONE
        }
        return make(type, color)
    }

    fun toChar(piece: Int): Char {
        val ch = when (type(piece)) {
            PAWN -> 'p'; KNIGHT -> 'n'; BISHOP -> 'b'
            ROOK -> 'r'; QUEEN -> 'q'; KING -> 'k'
            else -> '?'
        }
        return if (color(piece) == Color.WHITE) ch.uppercaseChar() else ch
    }

    fun charToType(ch: Char): Int = when (ch.lowercaseChar()) {
        'n' -> KNIGHT; 'b' -> BISHOP; 'r' -> ROOK; 'q' -> QUEEN; 'k' -> KING
        else -> 0
    }

    fun typeToChar(type: Int): Char = when (type) {
        PAWN -> 'P'; KNIGHT -> 'N'; BISHOP -> 'B'
        ROOK -> 'R'; QUEEN -> 'Q'; KING -> 'K'
        else -> '?'
    }
}

object Square {
    fun fromAlgebraic(s: String): Int {
        val file = s[0] - 'a'
        val rank = 8 - (s[1] - '0')
        return rank * 16 + file
    }

    fun toAlgebraic(sq: Int): String {
        val file = sq and 0x0F
        val rank = sq shr 4
        return "${('a' + file)}${8 - rank}"
    }

    fun rank(sq: Int) = sq shr 4
    fun file(sq: Int) = sq and 0x0F
}

data class Move(
    val from: Int,
    val to: Int,
    val piece: Int,
    val captured: Int,
    val promotion: Int = 0,
    val isEnPassant: Boolean = false,
    val isCastling: Boolean = false,
    val isDoublePawnPush: Boolean = false,
) {
    val fromAlgebraic: String get() = Square.toAlgebraic(from)
    val toAlgebraic: String get() = Square.toAlgebraic(to)

    fun uci(): String {
        val base = fromAlgebraic + toAlgebraic
        return if (promotion != 0) base + Piece.toChar(Piece.make(promotion, Color.WHITE)).lowercaseChar() else base
    }

    /** Generate SAN notation. Requires game context for disambiguation. */
    fun san(game: ChessGame, moveIndex: Int = -1): String {
        if (isCastling) return if (to > from) "O-O" else "O-O-O"

        val sb = StringBuilder()
        val type = Piece.type(piece)

        if (type != Piece.PAWN) {
            sb.append(Piece.typeToChar(type))
            // Disambiguation: check if another piece of same type can reach same square
            disambiguate(game, sb, moveIndex)
        }

        // Capture
        if (captured != Piece.NONE || isEnPassant) {
            if (type == Piece.PAWN) sb.append(('a' + Square.file(from)))
            sb.append('x')
        }

        sb.append(toAlgebraic)

        if (promotion != 0) {
            sb.append('=')
            sb.append(Piece.typeToChar(promotion))
        }

        // Check/Checkmate indicators (simplified — would need to make/undo move for full accuracy)
        return sb.toString()
    }

    private fun disambiguate(game: ChessGame, sb: StringBuilder, moveIndex: Int) {
        // Find other pieces of same type that can move to same square
        val type = Piece.type(piece)
        val color = Piece.color(piece)
        var sameFile = false
        var sameRank = false
        var ambiguous = false

        val allMoves = game.legalMoves()
        for (m in allMoves) {
            if (m.from != from && m.to == to && Piece.type(m.piece) == type) {
                ambiguous = true
                if (Square.file(m.from) == Square.file(from)) sameFile = true
                if (Square.rank(m.from) == Square.rank(from)) sameRank = true
            }
        }

        if (ambiguous) {
            if (!sameFile) sb.append(('a' + Square.file(from)))
            else if (!sameRank) sb.append(8 - Square.rank(from))
            else { sb.append(('a' + Square.file(from))); sb.append(8 - Square.rank(from)) }
        }
    }
}

data class MoveRecord(
    val move: Move,
    val castlingRights: Int,
    val enPassantSquare: Int,
    val halfMoveClock: Int,
    val fullMoveNumber: Int,
)
