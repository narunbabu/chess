import Foundation

/// Stockfish engine wrapper using xcframework bridge.
/// Sends UCI commands, parses responses, provides async/await API.
///
/// Architecture:
/// - Stockfish compiled as .xcframework (C++ with Obj-C bridging header)
/// - Communication via stdin/stdout pipes on a background thread
/// - This actor wraps the bridge with game-level logic (difficulty, MultiPV, think time)
///
/// Difficulty mapping matches web frontend (computerMoveUtils.js):
/// - Depth 1-16 → movetime 100-2500ms
/// - Lower depths use MultiPV to select from top N moves
/// - Minimum perceived think time: 1500ms
actor StockfishEngine {
    static let shared = StockfishEngine()

    static let minDepth = 1
    static let maxDepth = 16
    static let defaultDepth = 2
    static let numTopMoves = 10
    static let minPerceivedThinkTimeMs: UInt64 = 1500

    enum EngineState {
        case idle, initializing, thinking, error
    }

    enum DifficultyTier {
        case easy, medium, hard, expert
    }

    private(set) var state: EngineState = .idle
    private var isInitialized = false

    // MARK: - Difficulty Mapping

    /// Map depth (1-16) to Stockfish movetime in milliseconds. Matches web frontend.
    static func mapDepthToMoveTime(_ depth: Int) -> Int {
        switch max(minDepth, min(maxDepth, depth)) {
        case 1: return 100; case 2: return 150; case 3: return 200; case 4: return 250
        case 5: return 300; case 6: return 400; case 7: return 500; case 8: return 600
        case 9: return 700; case 10: return 800; case 11: return 1000; case 12: return 1200
        case 13: return 1500; case 14: return 1800; case 15: return 2200; case 16: return 2500
        default: return 150
        }
    }

    static func difficultyTier(_ depth: Int) -> DifficultyTier {
        switch depth {
        case 1...4: return .easy
        case 5...8: return .medium
        case 9...12: return .hard
        default: return .expert
        }
    }

    /// Number of undo chances per difficulty tier.
    static func undoChances(depth: Int, isRated: Bool) -> Int {
        if isRated { return 0 }
        switch difficultyTier(depth) {
        case .easy: return 5
        case .medium: return 3
        case .hard: return 2
        case .expert: return 1
        }
    }

    // MARK: - Engine Lifecycle

    /// Initialize the Stockfish engine. Must be called before getBestMove.
    func initialize() async throws {
        guard !isInitialized else { return }
        state = .initializing

        do {
            try StockfishBridge.shared.start()
            StockfishBridge.shared.sendCommand("uci")
            try await StockfishBridge.shared.waitForResponse("uciok")
            StockfishBridge.shared.sendCommand("setoption name MultiPV value \(Self.numTopMoves)")
            StockfishBridge.shared.sendCommand("ucinewgame")
            StockfishBridge.shared.sendCommand("isready")
            try await StockfishBridge.shared.waitForResponse("readyok")
            isInitialized = true
            state = .idle
        } catch {
            state = .error
            throw error
        }
    }

    /// Shutdown the engine and release resources.
    func shutdown() {
        if isInitialized {
            StockfishBridge.shared.sendCommand("quit")
            StockfishBridge.shared.stop()
            isInitialized = false
        }
        state = .idle
    }

    // MARK: - Move Generation

    /// Get the best move for a given position and difficulty.
    /// Includes artificial delay to ensure minimum perceived think time (1500ms).
    func getBestMove(fen: String, depth: Int) async throws -> StockfishResult {
        guard isInitialized else { throw StockfishError.notInitialized }
        state = .thinking

        let startTime = ContinuousClock.now
        let moveTime = Self.mapDepthToMoveTime(depth)

        do {
            StockfishBridge.shared.sendCommand("position fen \(fen)")
            StockfishBridge.shared.sendCommand("go movetime \(moveTime)")

            var rankedMoves: [RankedMove] = []
            var bestMove = ""

            while true {
                try Task.checkCancellation()
                guard let line = StockfishBridge.shared.readLine() else { continue }

                if line.hasPrefix("bestmove") {
                    bestMove = line.split(separator: " ").dropFirst().first.map(String.init) ?? ""
                    break
                }

                if line.hasPrefix("info"), line.contains("pv") {
                    if let ranked = parseInfoLine(line) {
                        rankedMoves.append(ranked)
                    }
                }
            }

            let selectedMove = selectMoveFromRankedList(rankedMoves, depth: depth, fallback: bestMove)

            // Enforce minimum perceived think time
            let elapsed = ContinuousClock.now - startTime
            let elapsedMs = elapsed.components.seconds * 1000 + elapsed.components.attoseconds / 1_000_000_000_000_000
            let delay = Int64(Self.minPerceivedThinkTimeMs) - elapsedMs
            if delay > 0 {
                try await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000)
            }

            state = .idle
            let totalElapsed = ContinuousClock.now - startTime
            let totalMs = totalElapsed.components.seconds * 1000 + totalElapsed.components.attoseconds / 1_000_000_000_000_000
            return StockfishResult(
                bestMove: selectedMove,
                rankedMoves: rankedMoves,
                thinkTimeMs: totalMs
            )
        } catch is CancellationError {
            StockfishBridge.shared.sendCommand("stop")
            state = .idle
            throw CancellationError()
        } catch {
            state = .error
            throw error
        }
    }

    /// Reset engine state for a new game.
    func newGame() async throws {
        guard isInitialized else { return }
        StockfishBridge.shared.sendCommand("ucinewgame")
        StockfishBridge.shared.sendCommand("isready")
        try await StockfishBridge.shared.waitForResponse("readyok")
    }

    // MARK: - Move Selection

    private func selectMoveFromRankedList(_ rankedMoves: [RankedMove], depth: Int, fallback: String) -> String {
        guard !rankedMoves.isEmpty else { return fallback }

        let sorted = rankedMoves.sorted { $0.rank < $1.rank }
        let tier = Self.difficultyTier(depth)

        let range: ClosedRange<Int>
        switch tier {
        case .easy:
            let start = min(4, sorted.count - 1)
            let end = min(7, sorted.count - 1)
            range = start...end
        case .medium:
            let start = min(1, sorted.count - 1)
            let end = min(3, sorted.count - 1)
            range = start...end
        case .hard:
            let end = min(1, sorted.count - 1)
            range = 0...end
        case .expert:
            range = 0...0
        }

        let candidates = Array(sorted[range])
        return candidates.randomElement()?.uci ?? sorted.first!.uci
    }

    // MARK: - UCI Parsing

    private func parseInfoLine(_ line: String) -> RankedMove? {
        let parts = line.split(separator: " ").map(String.init)
        var multipv = 0, score = 0, depth = 0
        var isMate = false, pvMove = ""

        var i = 0
        while i < parts.count {
            switch parts[i] {
            case "multipv": multipv = Int(parts[safe: i + 1] ?? "") ?? 0
            case "depth": depth = Int(parts[safe: i + 1] ?? "") ?? 0
            case "score":
                let scoreType = parts[safe: i + 1]
                let scoreVal = Int(parts[safe: i + 2] ?? "") ?? 0
                if scoreType == "cp" { score = scoreVal }
                else if scoreType == "mate" { score = scoreVal; isMate = true }
            case "pv": pvMove = parts[safe: i + 1] ?? ""
            default: break
            }
            i += 1
        }

        guard multipv > 0, !pvMove.isEmpty else { return nil }
        return RankedMove(rank: multipv, uci: pvMove, score: score, isMate: isMate, depth: depth)
    }
}

// MARK: - Supporting Types

struct StockfishResult {
    let bestMove: String
    let rankedMoves: [RankedMove]
    let thinkTimeMs: Int64
}

struct RankedMove {
    let rank: Int
    let uci: String
    let score: Int
    let isMate: Bool
    let depth: Int
}

enum StockfishError: Error {
    case notInitialized
    case engineCrashed
    case timeout
}

// MARK: - Array Safe Subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
