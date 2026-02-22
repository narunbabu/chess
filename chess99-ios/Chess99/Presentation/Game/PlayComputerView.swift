import SwiftUI

/// PlayComputer view with full game loop.
/// Two phases: Setup (color/difficulty selection) and Playing (board + controls).
struct PlayComputerView: View {
    @StateObject private var viewModel = PlayComputerViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            switch viewModel.gamePhase {
            case .setup:
                GameSetupView(
                    onStart: { color, difficulty, rated in
                        viewModel.setupGame(playerColor: color, difficulty: difficulty, isRated: rated)
                        viewModel.startGame()
                    }
                )
            case .playing, .completed:
                GamePlayView(viewModel: viewModel)
            case .replay:
                Text("Replay mode coming soon")
            }
        }
        .navigationTitle("Play vs Computer")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.clearError() } }
        )) {
            Button("OK") { viewModel.clearError() }
        } message: {
            Text(viewModel.error ?? "")
        }
        .onChange(of: viewModel.soundToPlay) { _, sound in
            guard let sound = sound else { return }
            switch sound {
            case .move: SoundManager.shared.playMove()
            case .capture: SoundManager.shared.playCapture()
            case .check: SoundManager.shared.playCheck()
            case .gameEnd: SoundManager.shared.playGameEnd()
            }
            viewModel.soundPlayed()
        }
    }
}

// MARK: - Setup View

struct GameSetupView: View {
    var onStart: (PieceColor, Int, Bool) -> Void

    @State private var selectedColor: PieceColor = .white
    @State private var difficulty: Double = 2
    @State private var isRated = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Game Setup")
                    .font(.title2)
                    .fontWeight(.bold)

                // Color selection
                VStack(spacing: 8) {
                    Text("Play as")
                        .font(.headline)

                    HStack(spacing: 16) {
                        colorButton(.white, label: "\u{2654} White")
                        colorButton(.black, label: "\u{265A} Black")
                    }
                }

                // Difficulty slider
                VStack(spacing: 8) {
                    Text("Difficulty: \(Int(difficulty))")
                        .font(.headline)
                    Text(difficultyLabel(Int(difficulty)))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Slider(value: $difficulty, in: 1...16, step: 1)
                }

                // Rated toggle
                Toggle(isOn: $isRated) {
                    VStack(alignment: .leading) {
                        Text("Rated Game")
                            .font(.headline)
                        Text(isRated ? "No undo, no pause, affects rating" : "\(StockfishEngine.undoChances(depth: Int(difficulty), isRated: false)) undo chances")
                            .font(.caption)
                            .foregroundColor(isRated ? .red : .secondary)
                    }
                }

                // Start button
                Button(action: { onStart(selectedColor, Int(difficulty), isRated) }) {
                    Text("Start Game")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            }
            .padding(24)
        }
    }

    private func colorButton(_ color: PieceColor, label: String) -> some View {
        Button(action: { selectedColor = color }) {
            Text(label)
                .font(.headline)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(selectedColor == color ? Color.green.opacity(0.2) : Color(.systemGray6))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selectedColor == color ? Color.green : Color.clear, lineWidth: 2)
                )
        }
        .buttonStyle(.plain)
    }

    private func difficultyLabel(_ depth: Int) -> String {
        let undos = StockfishEngine.undoChances(depth: depth, isRated: false)
        switch depth {
        case 1...4: return "Easy (\(undos) undos)"
        case 5...8: return "Medium (\(undos) undos)"
        case 9...12: return "Hard (\(undos) undos)"
        default: return "Expert (\(undos) undo)"
        }
    }
}

// MARK: - Game Play View

struct GamePlayView: View {
    @ObservedObject var viewModel: PlayComputerViewModel

    private var game: ChessGame {
        ChessGame(fen: viewModel.fen)
    }

    private var isPlayerTurn: Bool {
        game.turn == viewModel.playerColor && !viewModel.computerMoveInProgress
    }

    var body: some View {
        VStack(spacing: 0) {
            // Opponent timer
            GameTimerView(
                timeSeconds: viewModel.computerTimeSeconds,
                isActive: viewModel.activeTimer == viewModel.computerColor && viewModel.isTimerRunning,
                playerName: "Computer (Lv.\(viewModel.difficulty))"
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 4)

            // Chess board
            ChessBoardView(
                game: game,
                boardOrientation: viewModel.playerColor,
                isInteractive: isPlayerTurn && viewModel.gamePhase == .playing,
                lastMoveFrom: viewModel.lastMoveFrom,
                lastMoveTo: viewModel.lastMoveTo,
                onMove: { from, to, promo in
                    viewModel.onPlayerMove(from: from, to: to, promotion: promo)
                }
            )
            .padding(.horizontal, 8)

            // Player timer
            GameTimerView(
                timeSeconds: viewModel.playerTimeSeconds,
                isActive: viewModel.activeTimer == viewModel.playerColor && viewModel.isTimerRunning,
                playerName: "You"
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 4)

            // Status
            if viewModel.computerMoveInProgress {
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Computer thinking...")
                        .font(.caption)
                }
                .padding(.vertical, 4)
            }

            // Controls
            if viewModel.gamePhase == .playing {
                HStack(spacing: 16) {
                    if !viewModel.isRated && viewModel.undoChancesRemaining > 0 {
                        Button(action: { viewModel.undoMove() }) {
                            Label("Undo (\(viewModel.undoChancesRemaining))", systemImage: "arrow.uturn.backward")
                        }
                        .buttonStyle(.bordered)
                        .disabled(!isPlayerTurn || viewModel.moveHistory.count < 2)
                    }

                    Button(action: { viewModel.resign() }) {
                        Label("Resign", systemImage: "flag.fill")
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }
                .padding(.vertical, 8)
            }

            // Game result
            if let result = viewModel.gameResult {
                GameResultCardView(result: result) {
                    viewModel.setupGame()
                }
            }

            // Move list
            if !viewModel.moveHistory.isEmpty {
                MoveListView(moves: viewModel.moveHistory)
                    .padding(.horizontal, 16)
            }

            Spacer()
        }
    }
}

// MARK: - Game Result Card

struct GameResultCardView: View {
    let result: GameResultState
    let onNewGame: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text(statusTitle)
                .font(.title2)
                .fontWeight(.bold)
            Text(result.details)
                .font(.subheadline)
            Button("New Game", action: onNewGame)
                .buttonStyle(.borderedProminent)
                .tint(.green)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(backgroundColor.opacity(0.15))
        .cornerRadius(12)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var statusTitle: String {
        switch result.status {
        case .won: return "Victory!"
        case .lost: return "Defeat"
        case .draw: return "Draw"
        }
    }

    private var backgroundColor: Color {
        switch result.status {
        case .won: return .green
        case .lost: return .red
        case .draw: return .orange
        }
    }
}

// MARK: - Move List

struct MoveListView: View {
    let moves: [GameMoveRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Moves")
                .font(.caption)
                .fontWeight(.bold)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    let pairs = stride(from: 0, to: moves.count, by: 2).map { i in
                        (i / 2 + 1, moves[i], i + 1 < moves.count ? moves[i + 1] : nil)
                    }
                    ForEach(pairs, id: \.0) { number, white, black in
                        HStack(spacing: 4) {
                            Text("\(number).")
                                .font(.caption2)
                                .frame(width: 28, alignment: .trailing)
                            Text(white.san)
                                .font(.caption)
                                .fontWeight(.medium)
                                .frame(width: 56, alignment: .leading)
                            if let black = black {
                                Text(black.san)
                                    .font(.caption)
                                    .frame(width: 56, alignment: .leading)
                            }
                            Spacer()
                        }
                    }
                }
            }
            .frame(maxHeight: 120)
        }
    }
}
