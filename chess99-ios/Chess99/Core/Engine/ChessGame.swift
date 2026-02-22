import Foundation

/// Pure Swift chess game engine — equivalent to chess.js.
/// Handles move generation, validation, FEN/PGN, check/checkmate/stalemate detection.
/// Uses 0x88 board representation for efficient off-board detection.
final class ChessGame {
    static let startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    private var board = [Int](repeating: Piece.none, count: 128)
    private(set) var turn: PieceColor = .white
    private var castlingRights: UInt8 = 0 // K=1, Q=2, k=4, q=8
    private(set) var enPassantSquare: Int = -1
    private(set) var halfMoveClock: Int = 0
    private(set) var fullMoveNumber: Int = 1

    private var moveHistory: [MoveRecord] = []
    private var positionHistory: [UInt64] = []

    init(fen: String = ChessGame.startingFEN) {
        loadFEN(fen)
    }

    // MARK: - Public API

    func fen() -> String { generateFEN() }
    func pgn() -> String { generatePGN() }

    func isCheck() -> Bool { isKingInCheck(turn) }
    func isCheckmate() -> Bool { isCheck() && legalMoves().isEmpty }
    func isStalemate() -> Bool { !isCheck() && legalMoves().isEmpty }
    func isDraw() -> Bool { isStalemate() || isInsufficientMaterial() || isThreefoldRepetition() || isFiftyMoveRule() }
    func isGameOver() -> Bool { isCheckmate() || isDraw() }

    func isInsufficientMaterial() -> Bool {
        var pieces: [Int] = []
        for sq in allSquares() {
            let p = board[sq]
            if p != Piece.none && Piece.type(p) != Piece.king { pieces.append(p) }
        }
        if pieces.isEmpty { return true } // K vs K
        if pieces.count == 1 {
            let t = Piece.type(pieces[0])
            return t == Piece.bishop || t == Piece.knight
        }
        if pieces.count == 2 && pieces.allSatisfy({ Piece.type($0) == Piece.bishop }) {
            var squares: [Int] = []
            for sq in allSquares() {
                if board[sq] != Piece.none && Piece.type(board[sq]) == Piece.bishop { squares.append(sq) }
            }
            if squares.count == 2 {
                return squareColor(squares[0]) == squareColor(squares[1]) &&
                       Piece.color(board[squares[0]]) != Piece.color(board[squares[1]])
            }
        }
        return false
    }

    func isThreefoldRepetition() -> Bool {
        guard positionHistory.count >= 5 else { return false }
        let current = positionHistory.last!
        return positionHistory.filter { $0 == current }.count >= 3
    }

    func isFiftyMoveRule() -> Bool { halfMoveClock >= 100 }

    /// All legal moves for current turn.
    func legalMoves() -> [Move] {
        var moves: [Move] = []
        for sq in allSquares() {
            let piece = board[sq]
            guard piece != Piece.none, Piece.color(piece) == turn else { continue }
            moves.append(contentsOf: generatePieceMoves(sq))
        }
        return moves.filter { isLegalMove($0) }
    }

    /// Legal moves from a specific square (algebraic, e.g. "e2").
    func legalMovesFrom(_ square: String) -> [Move] {
        legalMovesFrom(Square.fromAlgebraic(square))
    }

    func legalMovesFrom(_ square: Int) -> [Move] {
        let piece = board[square]
        guard piece != Piece.none, Piece.color(piece) == turn else { return [] }
        return generatePieceMoves(square).filter { isLegalMove($0) }
    }

    /// Make a move. Returns the Move or nil if illegal.
    @discardableResult
    func move(from: String, to: String, promotion: Character? = nil) -> Move? {
        let fromSq = Square.fromAlgebraic(from)
        let toSq = Square.fromAlgebraic(to)
        guard let legal = legalMoves().first(where: { m in
            m.from == fromSq && m.to == toSq &&
            (promotion == nil || m.promotion == Piece.charToType(promotion!))
        }) else { return nil }
        return makeMove(legal)
    }

    /// Make a move from SAN notation (e.g., "e4", "Nf3", "O-O").
    @discardableResult
    func moveSAN(_ san: String) -> Move? {
        guard let match = legalMoves().first(where: { $0.san(in: self) == san }) else { return nil }
        return makeMove(match)
    }

    /// Make a move from UCI notation (e.g., "e2e4", "e7e8q").
    @discardableResult
    func moveUCI(_ uci: String) -> Move? {
        guard uci.count >= 4 else { return nil }
        let from = Square.fromAlgebraic(String(uci.prefix(2)))
        let to = Square.fromAlgebraic(String(uci.dropFirst(2).prefix(2)))
        let promo = uci.count > 4 ? Piece.charToType(uci[uci.index(uci.startIndex, offsetBy: 4)]) : 0
        guard let legal = legalMoves().first(where: { m in
            m.from == from && m.to == to && (promo == 0 || m.promotion == promo)
        }) else { return nil }
        return makeMove(legal)
    }

    /// Undo the last move.
    @discardableResult
    func undo() -> Move? {
        guard let record = moveHistory.popLast() else { return nil }
        positionHistory.removeLast()
        restoreState(record)
        return record.move
    }

    func history() -> [Move] { moveHistory.map(\.move) }
    func historyVerbose() -> [MoveRecord] { moveHistory }

    func get(_ square: String) -> Int { board[Square.fromAlgebraic(square)] }
    func get(_ square: Int) -> Int { (square & 0x88 == 0) ? board[square] : Piece.none }

    func turnChar() -> Character { turn == .white ? "w" : "b" }

    func reset() { loadFEN(Self.startingFEN) }
    func load(_ fen: String) { loadFEN(fen) }

    func kingSquare(_ color: PieceColor) -> Int {
        let king = Piece.make(Piece.king, color)
        for sq in allSquares() {
            if board[sq] == king { return sq }
        }
        return -1
    }

    // MARK: - Move Generation

    private func generatePieceMoves(_ square: Int) -> [Move] {
        let piece = board[square]
        let type = Piece.type(piece)
        let color = Piece.color(piece)
        var moves: [Move] = []

        switch type {
        case Piece.pawn: generatePawnMoves(square, color, &moves)
        case Piece.knight: generateSlidingMoves(square, piece, Self.knightOffsets, single: true, &moves)
        case Piece.bishop: generateSlidingMoves(square, piece, Self.bishopOffsets, single: false, &moves)
        case Piece.rook: generateSlidingMoves(square, piece, Self.rookOffsets, single: false, &moves)
        case Piece.queen: generateSlidingMoves(square, piece, Self.queenOffsets, single: false, &moves)
        case Piece.king:
            generateSlidingMoves(square, piece, Self.queenOffsets, single: true, &moves)
            generateCastlingMoves(square, color, &moves)
        default: break
        }
        return moves
    }

    private func generatePawnMoves(_ sq: Int, _ color: PieceColor, _ moves: inout [Move]) {
        let direction = color == .white ? -16 : 16
        let startRank = color == .white ? 6 : 1
        let promoRank = color == .white ? 0 : 7
        let piece = board[sq]

        let oneStep = sq + direction
        if oneStep & 0x88 == 0 && board[oneStep] == Piece.none {
            if Square.rank(oneStep) == promoRank {
                for promo in Self.promoPieces { moves.append(Move(from: sq, to: oneStep, piece: piece, captured: Piece.none, promotion: promo)) }
            } else {
                moves.append(Move(from: sq, to: oneStep, piece: piece, captured: Piece.none))
            }
            if Square.rank(sq) == startRank {
                let twoStep = sq + direction * 2
                if board[twoStep] == Piece.none {
                    moves.append(Move(from: sq, to: twoStep, piece: piece, captured: Piece.none, isDoublePawnPush: true))
                }
            }
        }

        for offset in [direction - 1, direction + 1] {
            let target = sq + offset
            guard target & 0x88 == 0 else { continue }
            let captured = board[target]
            if captured != Piece.none && Piece.color(captured) != color {
                if Square.rank(target) == promoRank {
                    for promo in Self.promoPieces { moves.append(Move(from: sq, to: target, piece: piece, captured: captured, promotion: promo)) }
                } else {
                    moves.append(Move(from: sq, to: target, piece: piece, captured: captured))
                }
            }
            if target == enPassantSquare {
                let epCaptured = board[target - direction]
                moves.append(Move(from: sq, to: target, piece: piece, captured: epCaptured, isEnPassant: true))
            }
        }
    }

    private func generateSlidingMoves(_ sq: Int, _ piece: Int, _ offsets: [Int], single: Bool, _ moves: inout [Move]) {
        let color = Piece.color(piece)
        for offset in offsets {
            var target = sq + offset
            while target & 0x88 == 0 {
                let captured = board[target]
                if captured == Piece.none {
                    moves.append(Move(from: sq, to: target, piece: piece, captured: Piece.none))
                } else {
                    if Piece.color(captured) != color {
                        moves.append(Move(from: sq, to: target, piece: piece, captured: captured))
                    }
                    break
                }
                if single { break }
                target += offset
            }
        }
    }

    private func generateCastlingMoves(_ sq: Int, _ color: PieceColor, _ moves: inout [Move]) {
        guard !isKingInCheck(color) else { return }
        let piece = board[sq]
        let enemy = color.opposite

        if color == .white {
            if castlingRights & 1 != 0 &&
               board[sq + 1] == Piece.none && board[sq + 2] == Piece.none &&
               !isSquareAttacked(sq + 1, by: enemy) && !isSquareAttacked(sq + 2, by: enemy) {
                moves.append(Move(from: sq, to: sq + 2, piece: piece, captured: Piece.none, isCastling: true))
            }
            if castlingRights & 2 != 0 &&
               board[sq - 1] == Piece.none && board[sq - 2] == Piece.none && board[sq - 3] == Piece.none &&
               !isSquareAttacked(sq - 1, by: enemy) && !isSquareAttacked(sq - 2, by: enemy) {
                moves.append(Move(from: sq, to: sq - 2, piece: piece, captured: Piece.none, isCastling: true))
            }
        } else {
            if castlingRights & 4 != 0 &&
               board[sq + 1] == Piece.none && board[sq + 2] == Piece.none &&
               !isSquareAttacked(sq + 1, by: enemy) && !isSquareAttacked(sq + 2, by: enemy) {
                moves.append(Move(from: sq, to: sq + 2, piece: piece, captured: Piece.none, isCastling: true))
            }
            if castlingRights & 8 != 0 &&
               board[sq - 1] == Piece.none && board[sq - 2] == Piece.none && board[sq - 3] == Piece.none &&
               !isSquareAttacked(sq - 1, by: enemy) && !isSquareAttacked(sq - 2, by: enemy) {
                moves.append(Move(from: sq, to: sq - 2, piece: piece, captured: Piece.none, isCastling: true))
            }
        }
    }

    // MARK: - Move Execution

    @discardableResult
    private func makeMove(_ move: Move) -> Move {
        let record = MoveRecord(
            move: move,
            castlingRights: castlingRights,
            enPassantSquare: enPassantSquare,
            halfMoveClock: halfMoveClock,
            fullMoveNumber: fullMoveNumber
        )
        moveHistory.append(record)

        board[move.to] = board[move.from]
        board[move.from] = Piece.none

        if move.isEnPassant {
            let capturedSq = move.to + (turn == .white ? 16 : -16)
            board[capturedSq] = Piece.none
        }

        if move.isCastling {
            if move.to > move.from {
                board[move.from + 1] = board[move.from + 3]
                board[move.from + 3] = Piece.none
            } else {
                board[move.from - 1] = board[move.from - 4]
                board[move.from - 4] = Piece.none
            }
        }

        if move.promotion != 0 {
            board[move.to] = Piece.make(move.promotion, turn)
        }

        enPassantSquare = move.isDoublePawnPush ?
            move.from + (turn == .white ? -16 : 16) : -1

        updateCastlingRights(move)

        if Piece.type(move.piece) == Piece.pawn || move.captured != Piece.none {
            halfMoveClock = 0
        } else {
            halfMoveClock += 1
        }
        if turn == .black { fullMoveNumber += 1 }

        turn = turn.opposite
        positionHistory.append(zobristHash())
        return move
    }

    private func restoreState(_ record: MoveRecord) {
        let move = record.move
        turn = turn.opposite

        board[move.from] = move.piece
        board[move.to] = move.isEnPassant ? Piece.none : move.captured

        if move.isEnPassant {
            let capturedSq = move.to + (turn == .white ? 16 : -16)
            board[capturedSq] = move.captured
        }

        if move.isCastling {
            if move.to > move.from {
                board[move.from + 3] = board[move.from + 1]
                board[move.from + 1] = Piece.none
            } else {
                board[move.from - 4] = board[move.from - 1]
                board[move.from - 1] = Piece.none
            }
        }

        castlingRights = record.castlingRights
        enPassantSquare = record.enPassantSquare
        halfMoveClock = record.halfMoveClock
        fullMoveNumber = record.fullMoveNumber
    }

    private func updateCastlingRights(_ move: Move) {
        if Piece.type(move.piece) == Piece.king {
            if turn == .white { castlingRights &= 0b1100 }
            else { castlingRights &= 0b0011 }
        }
        if Piece.type(move.piece) == Piece.rook {
            if move.from == 0x70 + 0 { castlingRights &= ~UInt8(2) }
            if move.from == 0x70 + 7 { castlingRights &= ~UInt8(1) }
            if move.from == 0x00 + 0 { castlingRights &= ~UInt8(8) }
            if move.from == 0x00 + 7 { castlingRights &= ~UInt8(4) }
        }
        if move.captured != Piece.none && Piece.type(move.captured) == Piece.rook {
            if move.to == 0x70 + 0 { castlingRights &= ~UInt8(2) }
            if move.to == 0x70 + 7 { castlingRights &= ~UInt8(1) }
            if move.to == 0x00 + 0 { castlingRights &= ~UInt8(8) }
            if move.to == 0x00 + 7 { castlingRights &= ~UInt8(4) }
        }
    }

    // MARK: - Attack Detection

    private func isLegalMove(_ move: Move) -> Bool {
        let savedCastling = castlingRights
        let savedEp = enPassantSquare
        let savedHalf = halfMoveClock
        let savedFull = fullMoveNumber

        board[move.to] = board[move.from]
        board[move.from] = Piece.none
        if move.isEnPassant {
            let capturedSq = move.to + (turn == .white ? 16 : -16)
            board[capturedSq] = Piece.none
        }
        if move.promotion != 0 { board[move.to] = Piece.make(move.promotion, turn) }
        if move.isCastling {
            if move.to > move.from {
                board[move.from + 1] = board[move.from + 3]; board[move.from + 3] = Piece.none
            } else {
                board[move.from - 1] = board[move.from - 4]; board[move.from - 4] = Piece.none
            }
        }

        let inCheck = isKingInCheck(turn)

        board[move.from] = move.piece
        board[move.to] = move.isEnPassant ? Piece.none : move.captured
        if move.isEnPassant {
            let capturedSq = move.to + (turn == .white ? 16 : -16)
            board[capturedSq] = move.captured
        }
        if move.isCastling {
            if move.to > move.from {
                board[move.from + 3] = board[move.from + 1]; board[move.from + 1] = Piece.none
            } else {
                board[move.from - 4] = board[move.from - 1]; board[move.from - 1] = Piece.none
            }
        }

        castlingRights = savedCastling
        enPassantSquare = savedEp
        halfMoveClock = savedHalf
        fullMoveNumber = savedFull

        return !inCheck
    }

    private func isKingInCheck(_ color: PieceColor) -> Bool {
        let kingSq = kingSquare(color)
        guard kingSq != -1 else { return false }
        return isSquareAttacked(kingSq, by: color.opposite)
    }

    func isSquareAttacked(_ square: Int, by byColor: PieceColor) -> Bool {
        // Pawn attacks
        let pawnDir = byColor == .white ? 16 : -16
        for offset in [-1, 1] {
            let attackerSq = square + pawnDir + offset
            if attackerSq & 0x88 == 0 {
                let p = board[attackerSq]
                if p != Piece.none && Piece.type(p) == Piece.pawn && Piece.color(p) == byColor { return true }
            }
        }
        // Knight
        for offset in Self.knightOffsets {
            let sq = square + offset
            if sq & 0x88 == 0 {
                let p = board[sq]
                if p != Piece.none && Piece.type(p) == Piece.knight && Piece.color(p) == byColor { return true }
            }
        }
        // King
        for offset in Self.queenOffsets {
            let sq = square + offset
            if sq & 0x88 == 0 {
                let p = board[sq]
                if p != Piece.none && Piece.type(p) == Piece.king && Piece.color(p) == byColor { return true }
            }
        }
        // Bishop/Queen diagonals
        for offset in Self.bishopOffsets {
            var sq = square + offset
            while sq & 0x88 == 0 {
                let p = board[sq]
                if p != Piece.none {
                    if Piece.color(p) == byColor && (Piece.type(p) == Piece.bishop || Piece.type(p) == Piece.queen) { return true }
                    break
                }
                sq += offset
            }
        }
        // Rook/Queen lines
        for offset in Self.rookOffsets {
            var sq = square + offset
            while sq & 0x88 == 0 {
                let p = board[sq]
                if p != Piece.none {
                    if Piece.color(p) == byColor && (Piece.type(p) == Piece.rook || Piece.type(p) == Piece.queen) { return true }
                    break
                }
                sq += offset
            }
        }
        return false
    }

    // MARK: - FEN

    private func loadFEN(_ fen: String) {
        board = [Int](repeating: Piece.none, count: 128)
        moveHistory.removeAll()
        positionHistory.removeAll()

        let parts = fen.split(separator: " ").map(String.init)
        let ranks = parts[0].split(separator: "/")

        for (rank, rankStr) in ranks.enumerated() {
            var file = 0
            for ch in rankStr {
                if let digit = ch.wholeNumberValue {
                    file += digit
                } else {
                    board[rank * 16 + file] = Piece.fromChar(ch)
                    file += 1
                }
            }
        }

        turn = (parts.count > 1 && parts[1] == "b") ? .black : .white

        castlingRights = 0
        let castling = parts.count > 2 ? parts[2] : "-"
        if castling.contains("K") { castlingRights |= 1 }
        if castling.contains("Q") { castlingRights |= 2 }
        if castling.contains("k") { castlingRights |= 4 }
        if castling.contains("q") { castlingRights |= 8 }

        let ep = parts.count > 3 ? parts[3] : "-"
        enPassantSquare = ep == "-" ? -1 : Square.fromAlgebraic(ep)

        halfMoveClock = parts.count > 4 ? (Int(parts[4]) ?? 0) : 0
        fullMoveNumber = parts.count > 5 ? (Int(parts[5]) ?? 1) : 1

        positionHistory.append(zobristHash())
    }

    private func generateFEN() -> String {
        var result = ""
        for rank in 0..<8 {
            var empty = 0
            for file in 0..<8 {
                let piece = board[rank * 16 + file]
                if piece == Piece.none {
                    empty += 1
                } else {
                    if empty > 0 { result += "\(empty)"; empty = 0 }
                    result.append(Piece.toChar(piece))
                }
            }
            if empty > 0 { result += "\(empty)" }
            if rank < 7 { result += "/" }
        }

        result += turn == .white ? " w " : " b "

        var castle = ""
        if castlingRights & 1 != 0 { castle += "K" }
        if castlingRights & 2 != 0 { castle += "Q" }
        if castlingRights & 4 != 0 { castle += "k" }
        if castlingRights & 8 != 0 { castle += "q" }
        result += castle.isEmpty ? "-" : castle

        result += " "
        result += enPassantSquare == -1 ? "-" : Square.toAlgebraic(enPassantSquare)
        result += " \(halfMoveClock) \(fullMoveNumber)"
        return result
    }

    private func generatePGN() -> String {
        var parts: [String] = []
        for (i, record) in moveHistory.enumerated() {
            if i % 2 == 0 { parts.append("\(i / 2 + 1).") }
            parts.append(record.move.san(in: self))
        }
        return parts.joined(separator: " ")
    }

    // MARK: - Zobrist Hashing (simplified)

    private func zobristHash() -> UInt64 {
        var hash: UInt64 = 0
        for sq in allSquares() {
            let piece = board[sq]
            if piece != Piece.none {
                hash ^= UInt64(bitPattern: Int64(piece)) &* 6364136223846793005 &+ UInt64(bitPattern: Int64(sq)) &* 1442695040888963407
            }
        }
        if turn == .black { hash ^= 0x9E3779B97F4A7C15 }
        hash ^= UInt64(castlingRights) &* 2862933555777941757
        if enPassantSquare != -1 { hash ^= UInt64(bitPattern: Int64(enPassantSquare)) &* 3037000499 }
        return hash
    }

    // MARK: - Utility

    private func allSquares() -> [Int] {
        var squares: [Int] = []
        squares.reserveCapacity(64)
        for rank in 0..<8 {
            for file in 0..<8 {
                squares.append(rank * 16 + file)
            }
        }
        return squares
    }

    private func squareColor(_ sq: Int) -> Int { (Square.rank(sq) + Square.file(sq)) % 2 }

    // MARK: - Constants

    static let knightOffsets = [-33, -31, -18, -14, 14, 18, 31, 33]
    static let bishopOffsets = [-17, -15, 15, 17]
    static let rookOffsets = [-16, -1, 1, 16]
    static let queenOffsets = [-17, -16, -15, -1, 1, 15, 16, 17]
    static let promoPieces = [Piece.queen, Piece.rook, Piece.bishop, Piece.knight]
}

// MARK: - Supporting Types

enum PieceColor {
    case white, black
    var opposite: PieceColor { self == .white ? .black : .white }
}

enum Piece {
    static let none = 0
    static let pawn = 1
    static let knight = 2
    static let bishop = 3
    static let rook = 4
    static let queen = 5
    static let king = 6
    private static let blackFlag = 8

    static func make(_ type: Int, _ color: PieceColor) -> Int {
        type | (color == .white ? 0 : blackFlag)
    }
    static func type(_ piece: Int) -> Int { piece & 0x07 }
    static func color(_ piece: Int) -> PieceColor { piece & blackFlag == 0 ? .white : .black }

    static func fromChar(_ ch: Character) -> Int {
        let color: PieceColor = ch.isUppercase ? .white : .black
        let type: Int
        switch ch.lowercased() {
        case "p": type = pawn; case "n": type = knight; case "b": type = bishop
        case "r": type = rook; case "q": type = queen; case "k": type = king
        default: type = none
        }
        return make(type, color)
    }

    static func toChar(_ piece: Int) -> Character {
        let ch: Character
        switch type(piece) {
        case pawn: ch = "p"; case knight: ch = "n"; case bishop: ch = "b"
        case rook: ch = "r"; case queen: ch = "q"; case king: ch = "k"
        default: ch = "?"
        }
        return color(piece) == .white ? Character(ch.uppercased()) : ch
    }

    static func charToType(_ ch: Character) -> Int {
        switch ch.lowercased() {
        case "n": return knight; case "b": return bishop; case "r": return rook
        case "q": return queen; case "k": return king
        default: return 0
        }
    }

    static func typeToChar(_ type: Int) -> Character {
        switch type {
        case pawn: return "P"; case knight: return "N"; case bishop: return "B"
        case rook: return "R"; case queen: return "Q"; case king: return "K"
        default: return "?"
        }
    }
}

enum Square {
    static func fromAlgebraic(_ s: String) -> Int {
        let chars = Array(s)
        let file = Int(chars[0].asciiValue! - Character("a").asciiValue!)
        let rank = 8 - Int(String(chars[1]))!
        return rank * 16 + file
    }

    static func toAlgebraic(_ sq: Int) -> String {
        let file = sq & 0x0F
        let rank = sq >> 4
        return "\(Character(UnicodeScalar(Int(Character("a").asciiValue!) + file)!))\(8 - rank)"
    }

    static func rank(_ sq: Int) -> Int { sq >> 4 }
    static func file(_ sq: Int) -> Int { sq & 0x0F }
}

struct Move: Equatable {
    let from: Int
    let to: Int
    let piece: Int
    let captured: Int
    var promotion: Int = 0
    var isEnPassant: Bool = false
    var isCastling: Bool = false
    var isDoublePawnPush: Bool = false

    var fromAlgebraic: String { Square.toAlgebraic(from) }
    var toAlgebraic: String { Square.toAlgebraic(to) }

    func uci() -> String {
        let base = fromAlgebraic + toAlgebraic
        if promotion != 0 {
            return base + String(Piece.toChar(Piece.make(promotion, .white))).lowercased()
        }
        return base
    }

    func san(in game: ChessGame) -> String {
        if isCastling { return to > from ? "O-O" : "O-O-O" }

        var result = ""
        let type = Piece.type(piece)

        if type != Piece.pawn {
            result.append(Piece.typeToChar(type))
            result += disambiguate(in: game)
        }

        if captured != Piece.none || isEnPassant {
            if type == Piece.pawn {
                result.append(Character(UnicodeScalar(Int(Character("a").asciiValue!) + Square.file(from))!))
            }
            result.append("x")
        }

        result += toAlgebraic

        if promotion != 0 {
            result.append("=")
            result.append(Piece.typeToChar(promotion))
        }

        return result
    }

    private func disambiguate(in game: ChessGame) -> String {
        let type = Piece.type(piece)
        var sameFile = false
        var sameRank = false
        var ambiguous = false

        for m in game.legalMoves() {
            if m.from != from && m.to == to && Piece.type(m.piece) == type {
                ambiguous = true
                if Square.file(m.from) == Square.file(from) { sameFile = true }
                if Square.rank(m.from) == Square.rank(from) { sameRank = true }
            }
        }

        guard ambiguous else { return "" }
        if !sameFile {
            return String(Character(UnicodeScalar(Int(Character("a").asciiValue!) + Square.file(from))!))
        } else if !sameRank {
            return "\(8 - Square.rank(from))"
        } else {
            return "\(Character(UnicodeScalar(Int(Character("a").asciiValue!) + Square.file(from))!))\(8 - Square.rank(from))"
        }
    }
}

struct MoveRecord {
    let move: Move
    let castlingRights: UInt8
    let enPassantSquare: Int
    let halfMoveClock: Int
    let fullMoveNumber: Int
}
