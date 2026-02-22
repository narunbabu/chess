import SwiftUI

/// Custom Canvas-based chess board component for SwiftUI.
/// Features:
/// - 8x8 grid with configurable colors
/// - Unicode chess piece rendering
/// - Drag-and-drop + tap-tap move input
/// - Legal move highlighting (dots)
/// - Last move highlighting (colored squares)
/// - Check indicator (red king square)
/// - Board orientation flip
/// - Haptic feedback on capture/pickup
struct ChessBoardView: View {
    let game: ChessGame
    var boardOrientation: PieceColor = .white
    var isInteractive: Bool = true
    var lastMoveFrom: Int = -1
    var lastMoveTo: Int = -1
    var onMove: ((_ from: String, _ to: String, _ promotion: Character?) -> Void)?

    @State private var selectedSquare: Int = -1
    @State private var legalMoveTargets: [Int] = []
    @State private var dragFrom: Int = -1
    @State private var draggedPiece: Int = Piece.none
    @State private var dragOffset: CGPoint = .zero
    @State private var isDragging: Bool = false

    private let lightSquareColor = Color(red: 240/255, green: 217/255, blue: 181/255)
    private let darkSquareColor = Color(red: 181/255, green: 136/255, blue: 99/255)
    private let lastMoveColor = Color.green.opacity(0.4)
    private let selectedSquareColor = Color.yellow.opacity(0.4)
    private let checkColor = Color.red.opacity(0.4)
    private let legalMoveColor = Color.black.opacity(0.1)

    var body: some View {
        GeometryReader { geometry in
            let boardSize = min(geometry.size.width, geometry.size.height)
            let squareSize = boardSize / 8

            ZStack {
                // Board squares layer
                Canvas { context, size in
                    let sqSize = size.width / 8

                    for rank in 0..<8 {
                        for file in 0..<8 {
                            let sq = rank * 16 + file
                            let isLight = (rank + file) % 2 == 0
                            let (vf, vr) = viewPosition(file: file, rank: rank)
                            let rect = CGRect(
                                x: CGFloat(vf) * sqSize,
                                y: CGFloat(vr) * sqSize,
                                width: sqSize,
                                height: sqSize
                            )

                            // Base color
                            var color: Color = isLight ? lightSquareColor : darkSquareColor

                            // Last move
                            if sq == lastMoveFrom || sq == lastMoveTo {
                                color = lastMoveColor
                            }
                            // Selected
                            if sq == selectedSquare {
                                color = selectedSquareColor
                            }
                            // Check
                            if game.isCheck() && sq == game.kingSquare(game.turn) {
                                color = checkColor
                            }

                            context.fill(Path(rect), with: .color(color))

                            // Legal move indicators
                            if legalMoveTargets.contains(sq) {
                                let center = CGPoint(x: rect.midX, y: rect.midY)
                                let hasPiece = game.get(sq) != Piece.none
                                if hasPiece {
                                    // Capture ring
                                    let outerPath = Path(ellipseIn: CGRect(
                                        x: center.x - sqSize * 0.42,
                                        y: center.y - sqSize * 0.42,
                                        width: sqSize * 0.84,
                                        height: sqSize * 0.84
                                    ))
                                    context.fill(outerPath, with: .color(legalMoveColor))
                                    let innerPath = Path(ellipseIn: CGRect(
                                        x: center.x - sqSize * 0.35,
                                        y: center.y - sqSize * 0.35,
                                        width: sqSize * 0.70,
                                        height: sqSize * 0.70
                                    ))
                                    context.fill(innerPath, with: .color(color))
                                } else {
                                    // Move dot
                                    let dotPath = Path(ellipseIn: CGRect(
                                        x: center.x - sqSize * 0.15,
                                        y: center.y - sqSize * 0.15,
                                        width: sqSize * 0.30,
                                        height: sqSize * 0.30
                                    ))
                                    context.fill(dotPath, with: .color(legalMoveColor))
                                }
                            }
                        }
                    }

                    // Coordinates
                    for file in 0..<8 {
                        let (vf, _) = viewPosition(file: file, rank: 7)
                        let label = String(Character(UnicodeScalar(Int(Character("a").asciiValue!) + file)!))
                        let point = CGPoint(
                            x: CGFloat(vf) * sqSize + sqSize - 10,
                            y: 8 * sqSize - 12
                        )
                        context.draw(Text(label).font(.system(size: sqSize * 0.15)).foregroundColor(.gray),
                                     at: point)
                    }
                    for rank in 0..<8 {
                        let (_, vr) = viewPosition(file: 0, rank: rank)
                        let label = "\(8 - rank)"
                        let point = CGPoint(x: 6, y: CGFloat(vr) * sqSize + 8)
                        context.draw(Text(label).font(.system(size: sqSize * 0.15)).foregroundColor(.gray),
                                     at: point)
                    }
                }

                // Pieces layer (using Text for Unicode chess symbols)
                ForEach(0..<8, id: \.self) { rank in
                    ForEach(0..<8, id: \.self) { file in
                        let sq = rank * 16 + file
                        let piece = game.get(sq)
                        if piece != Piece.none && !(isDragging && sq == dragFrom) {
                            let (vf, vr) = viewPosition(file: file, rank: rank)
                            Text(pieceUnicode(piece))
                                .font(.system(size: squareSize * 0.7))
                                .position(
                                    x: CGFloat(vf) * squareSize + squareSize / 2,
                                    y: CGFloat(vr) * squareSize + squareSize / 2
                                )
                        }
                    }
                }

                // Dragged piece
                if isDragging && draggedPiece != Piece.none {
                    Text(pieceUnicode(draggedPiece))
                        .font(.system(size: squareSize * 0.85))
                        .position(x: dragOffset.x, y: dragOffset.y)
                }

                // Interaction layer
                if isInteractive {
                    Color.clear
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 5)
                                .onChanged { value in
                                    if !isDragging {
                                        // Start drag
                                        let sq = viewToBoard(
                                            x: value.startLocation.x,
                                            y: value.startLocation.y,
                                            squareSize: squareSize
                                        )
                                        let piece = game.get(sq)
                                        if piece != Piece.none && Piece.color(piece) == game.turn {
                                            draggedPiece = piece
                                            dragFrom = sq
                                            isDragging = true
                                            selectedSquare = sq
                                            legalMoveTargets = game.legalMovesFrom(sq).map(\.to)
                                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                        }
                                    }
                                    dragOffset = value.location
                                }
                                .onEnded { value in
                                    if isDragging && dragFrom != -1 {
                                        let sq = viewToBoard(
                                            x: value.location.x,
                                            y: value.location.y,
                                            squareSize: squareSize
                                        )
                                        if legalMoveTargets.contains(sq) {
                                            let fromAlg = Square.toAlgebraic(dragFrom)
                                            let toAlg = Square.toAlgebraic(sq)
                                            let isPromo = Piece.type(draggedPiece) == Piece.pawn &&
                                                (Square.rank(sq) == 0 || Square.rank(sq) == 7)
                                            if game.get(sq) != Piece.none {
                                                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                                            }
                                            onMove?(fromAlg, toAlg, isPromo ? "q" : nil)
                                        }
                                    }
                                    resetDragState()
                                }
                        )
                        .simultaneousGesture(
                            TapGesture()
                                .onEnded {
                                    // Tap handled via onTapGesture below
                                }
                        )
                        .onTapGesture { location in
                            handleTap(at: location, squareSize: squareSize)
                        }
                }
            }
            .frame(width: boardSize, height: boardSize)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    // MARK: - Coordinate Conversion

    private func viewPosition(file: Int, rank: Int) -> (Int, Int) {
        let vf = boardOrientation == .white ? file : 7 - file
        let vr = boardOrientation == .white ? rank : 7 - rank
        return (vf, vr)
    }

    private func viewToBoard(x: CGFloat, y: CGFloat, squareSize: CGFloat) -> Int {
        let file = Int(x / squareSize).clamped(to: 0...7)
        let rank = Int(y / squareSize).clamped(to: 0...7)
        let actualFile = boardOrientation == .white ? file : 7 - file
        let actualRank = boardOrientation == .white ? rank : 7 - rank
        return actualRank * 16 + actualFile
    }

    // MARK: - Input Handling

    private func handleTap(at location: CGPoint, squareSize: CGFloat) {
        let sq = viewToBoard(x: location.x, y: location.y, squareSize: squareSize)

        if selectedSquare != -1 && legalMoveTargets.contains(sq) {
            let fromAlg = Square.toAlgebraic(selectedSquare)
            let toAlg = Square.toAlgebraic(sq)
            let piece = game.get(selectedSquare)
            let isPromo = Piece.type(piece) == Piece.pawn &&
                (Square.rank(sq) == 0 || Square.rank(sq) == 7)
            if game.get(sq) != Piece.none {
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            }
            onMove?(fromAlg, toAlg, isPromo ? "q" : nil)
            selectedSquare = -1
            legalMoveTargets = []
        } else if selectedSquare == sq {
            selectedSquare = -1
            legalMoveTargets = []
        } else {
            let piece = game.get(sq)
            if piece != Piece.none && Piece.color(piece) == game.turn {
                selectedSquare = sq
                legalMoveTargets = game.legalMovesFrom(sq).map(\.to)
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            } else {
                selectedSquare = -1
                legalMoveTargets = []
            }
        }
    }

    private func resetDragState() {
        isDragging = false
        draggedPiece = Piece.none
        dragFrom = -1
        selectedSquare = -1
        legalMoveTargets = []
    }

    // MARK: - Piece Rendering

    private func pieceUnicode(_ piece: Int) -> String {
        let isWhite = Piece.color(piece) == .white
        switch Piece.type(piece) {
        case Piece.king: return isWhite ? "\u{2654}" : "\u{265A}"
        case Piece.queen: return isWhite ? "\u{2655}" : "\u{265B}"
        case Piece.rook: return isWhite ? "\u{2656}" : "\u{265C}"
        case Piece.bishop: return isWhite ? "\u{2657}" : "\u{265D}"
        case Piece.knight: return isWhite ? "\u{2658}" : "\u{265E}"
        case Piece.pawn: return isWhite ? "\u{2659}" : "\u{265F}"
        default: return ""
        }
    }
}

// MARK: - Helpers

private extension Int {
    func clamped(to range: ClosedRange<Int>) -> Int {
        Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
    }
}
