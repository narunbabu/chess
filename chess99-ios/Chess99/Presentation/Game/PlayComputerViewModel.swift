import Foundation
import Combine

/// ViewModel for PlayComputer screen.
/// Manages the full game loop: setup, moves, engine integration,
/// undo system, timer, game completion.
///
/// Matches web frontend PlayComputer.js behavior.
@MainActor
final class PlayComputerViewModel: ObservableObject {
    static let defaultTimeSeconds = 600 // 10 minutes

    // MARK: - Published State

    @Published var gamePhase: GamePhase = .setup
    @Published var fen: String = ChessGame.startingFEN
    @Published var playerColor: PieceColor = .white
    @Published var computerColor: PieceColor = .black
    @Published var difficulty: Int = StockfishEngine.defaultDepth
    @Published var isRated: Bool = false
    @Published var lastMoveFrom: Int = -1
    @Published var lastMoveTo: Int = -1
    @Published var moveHistory: [GameMoveRecord] = []
    @Published var undoChancesRemaining: Int = 0
    @Published var maxUndoChances: Int = 0
    @Published var playerTimeSeconds: Int = 600
    @Published var computerTimeSeconds: Int = 600
    @Published var activeTimer: PieceColor = .white
    @Published var isTimerRunning: Bool = false
    @Published var computerMoveInProgress: Bool = false
    @Published var gameResult: GameResultState?
    @Published var error: String?

    enum SoundToPlay { case move, capture, check, gameEnd }
    @Published var soundToPlay: SoundToPlay?

    // MARK: - Private

    private var game = ChessGame()
    private var computerTask: Task<Void, Never>?
    private var timerTask: Task<Void, Never>?

    // MARK: - Setup

    func setupGame(
        playerColor: PieceColor = .white,
        difficulty: Int = StockfishEngine.defaultDepth,
        isRated: Bool = false
    ) {
        game = ChessGame()
        let undos = StockfishEngine.undoChances(depth: difficulty, isRated: isRated)

        self.playerColor = playerColor
        self.computerColor = playerColor.opposite
        self.difficulty = difficulty
        self.isRated = isRated
        self.fen = game.fen()
        self.gamePhase = .setup
        self.undoChancesRemaining = undos
        self.maxUndoChances = undos
        self.playerTimeSeconds = Self.defaultTimeSeconds
        self.computerTimeSeconds = Self.defaultTimeSeconds
        self.moveHistory = []
        self.lastMoveFrom = -1
        self.lastMoveTo = -1
        self.gameResult = nil
        self.error = nil
    }

    func startGame() {
        Task {
            do {
                try await StockfishEngine.shared.initialize()
                try await StockfishEngine.shared.newGame()
            } catch {
                self.error = "Failed to start engine: \(error.localizedDescription)"
                return
            }

            gamePhase = .playing
            activeTimer = .white
            isTimerRunning = true
            startTimer()

            if playerColor == .black {
                await performComputerMove()
            }
        }
    }

    // MARK: - Player Move

    func onPlayerMove(from: String, to: String, promotion: Character?) {
        guard gamePhase == .playing, !computerMoveInProgress else { return }
        guard game.turn == playerColor else { return }

        guard let move = game.move(from: from, to: to, promotion: promotion) else { return }

        let sound: SoundToPlay
        if game.isCheck() { sound = .check }
        else if move.captured != Piece.none || move.isEnPassant { sound = .capture }
        else { sound = .move }

        let record = GameMoveRecord(
            moveNumber: game.historyVerbose().count,
            from: from, to: to,
            san: move.san(in: game),
            fen: game.fen(),
            playerColor: playerColor,
            captured: move.captured != Piece.none
        )

        fen = game.fen()
        lastMoveFrom = move.from
        lastMoveTo = move.to
        moveHistory.append(record)
        activeTimer = computerColor
        soundToPlay = sound

        if game.isGameOver() {
            handleGameOver()
            return
        }

        Task { await performComputerMove() }
    }

    // MARK: - Computer Move

    private func performComputerMove() async {
        computerMoveInProgress = true

        do {
            let result = try await StockfishEngine.shared.getBestMove(fen: game.fen(), depth: difficulty)
            guard let move = game.moveUCI(result.bestMove) else {
                // Fallback: try any legal move
                if let legal = game.legalMoves().first {
                    game.moveSAN(legal.san(in: game))
                }
                computerMoveInProgress = false
                return
            }

            let sound: SoundToPlay
            if game.isCheck() { sound = .check }
            else if move.captured != Piece.none || move.isEnPassant { sound = .capture }
            else { sound = .move }

            let record = GameMoveRecord(
                moveNumber: game.historyVerbose().count,
                from: move.fromAlgebraic, to: move.toAlgebraic,
                san: move.san(in: game),
                fen: game.fen(),
                playerColor: computerColor,
                captured: move.captured != Piece.none
            )

            fen = game.fen()
            lastMoveFrom = move.from
            lastMoveTo = move.to
            moveHistory.append(record)
            activeTimer = playerColor
            computerMoveInProgress = false
            soundToPlay = sound

            if game.isGameOver() {
                handleGameOver()
            }
        } catch {
            computerMoveInProgress = false
            self.error = "Engine error: \(error.localizedDescription)"
        }
    }

    // MARK: - Undo

    func undoMove() {
        guard !isRated, undoChancesRemaining > 0, !computerMoveInProgress else { return }
        guard gamePhase == .playing, game.turn == playerColor else { return }
        guard game.historyVerbose().count >= 2 else { return }

        game.undo() // Computer's move
        game.undo() // Player's move

        fen = game.fen()
        lastMoveFrom = -1
        lastMoveTo = -1
        if moveHistory.count >= 2 {
            moveHistory.removeLast(2)
        }
        undoChancesRemaining -= 1
    }

    // MARK: - Resign

    func resign() {
        guard gamePhase == .playing else { return }
        computerTask?.cancel()
        stopTimer()

        gamePhase = .completed
        gameResult = GameResultState(
            status: .lost,
            endReason: .resignation,
            winner: .opponent,
            details: "You resigned"
        )
        isTimerRunning = false
        soundToPlay = .gameEnd
    }

    // MARK: - Game Over

    private func handleGameOver() {
        computerTask?.cancel()
        stopTimer()

        let result: GameResultState
        if game.isCheckmate() {
            let winnerColor = game.turn.opposite
            if winnerColor == playerColor {
                result = GameResultState(status: .won, endReason: .checkmate, winner: .player, details: "Checkmate! You win!")
            } else {
                result = GameResultState(status: .lost, endReason: .checkmate, winner: .opponent, details: "Checkmate! Computer wins.")
            }
        } else if game.isStalemate() {
            result = GameResultState(status: .draw, endReason: .stalemate, winner: .none, details: "Draw by stalemate")
        } else if game.isInsufficientMaterial() {
            result = GameResultState(status: .draw, endReason: .insufficientMaterial, winner: .none, details: "Draw by insufficient material")
        } else if game.isThreefoldRepetition() {
            result = GameResultState(status: .draw, endReason: .threefoldRepetition, winner: .none, details: "Draw by threefold repetition")
        } else if game.isFiftyMoveRule() {
            result = GameResultState(status: .draw, endReason: .fiftyMoveRule, winner: .none, details: "Draw by 50-move rule")
        } else {
            result = GameResultState(status: .draw, endReason: .unknown, winner: .none, details: "Game over")
        }

        gamePhase = .completed
        gameResult = result
        isTimerRunning = false
        soundToPlay = .gameEnd
    }

    // MARK: - Timer

    private func startTimer() {
        timerTask?.cancel()
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                guard let self = self else { return }
                guard self.isTimerRunning, self.gamePhase == .playing else { continue }

                if self.activeTimer == self.playerColor {
                    self.playerTimeSeconds -= 1
                    if self.playerTimeSeconds <= 0 {
                        self.playerTimeSeconds = 0
                        self.gamePhase = .completed
                        self.gameResult = GameResultState(status: .lost, endReason: .timeout, winner: .opponent, details: "You ran out of time")
                        self.isTimerRunning = false
                        self.soundToPlay = .gameEnd
                        return
                    }
                } else {
                    self.computerTimeSeconds -= 1
                    if self.computerTimeSeconds <= 0 {
                        self.computerTimeSeconds = 0
                        self.gamePhase = .completed
                        self.gameResult = GameResultState(status: .won, endReason: .timeout, winner: .player, details: "Computer ran out of time")
                        self.isTimerRunning = false
                        self.soundToPlay = .gameEnd
                        return
                    }
                }
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        isTimerRunning = false
    }

    func soundPlayed() { soundToPlay = nil }
    func clearError() { error = nil }

    deinit {
        computerTask?.cancel()
        timerTask?.cancel()
    }
}

// MARK: - State Types

enum GamePhase {
    case setup, playing, completed, replay
}

struct GameMoveRecord {
    let moveNumber: Int
    let from: String
    let to: String
    let san: String
    let fen: String
    let playerColor: PieceColor
    let captured: Bool
}

struct GameResultState {
    let status: ResultStatus
    let endReason: EndReason
    let winner: Winner
    let details: String
}

enum ResultStatus { case won, lost, draw }
enum EndReason { case checkmate, stalemate, timeout, resignation, insufficientMaterial, threefoldRepetition, fiftyMoveRule, unknown }
enum Winner { case player, opponent, none }
