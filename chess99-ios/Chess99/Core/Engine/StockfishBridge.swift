import Foundation

/// Bridge to the Stockfish chess engine binary.
///
/// The Stockfish binary is compiled as an xcframework:
/// 1. Compile Stockfish C++ for iOS (arm64) and Simulator (arm64, x86_64)
/// 2. Create xcframework bundle
/// 3. Add Obj-C bridging header for C++ interop
///
/// Communication uses stdin/stdout via Process pipes (or direct C function calls via bridging header).
/// This implementation uses the process-based approach for simplicity.
///
/// For production, replace with direct C function calls via bridging header for better performance.
final class StockfishBridge: @unchecked Sendable {
    static let shared = StockfishBridge()

    private var inputPipe: Pipe?
    private var outputPipe: Pipe?
    private var process: Process?
    private var outputBuffer: [String] = []
    private let queue = DispatchQueue(label: "com.chess99.stockfish", qos: .userInitiated)
    private let outputLock = NSLock()
    private var isRunning = false

    // In production iOS, we use a different approach since Process is not available.
    // Instead, we call Stockfish C functions directly via the bridging header.
    // This is a reference implementation showing the communication protocol.

    private init() {}

    /// Start the Stockfish engine.
    func start() throws {
        guard !isRunning else { return }

        // NOTE: On iOS, Process is not available. In production:
        // 1. Link Stockfish as a static library via xcframework
        // 2. Call stockfish_init() via bridging header
        // 3. Use stockfish_command(cmd) to send UCI commands
        // 4. Use stockfish_read_line() to read output

        // For the architecture, we define the communication protocol here.
        // The actual C/Obj-C bridge implementation would go in:
        // - Chess99-Bridging-Header.h
        // - StockfishWrapper.mm (Obj-C++ wrapper)

        isRunning = true
        outputBuffer.removeAll()
    }

    /// Send a UCI command to the engine.
    func sendCommand(_ command: String) {
        guard isRunning else { return }
        queue.async { [weak self] in
            // In production: stockfish_command(command.cString(using: .utf8))
            // For development, simulate basic responses
            self?.simulateResponse(to: command)
        }
    }

    /// Read one line from engine output. Returns nil if no output available.
    func readLine() -> String? {
        outputLock.lock()
        defer { outputLock.unlock() }
        return outputBuffer.isEmpty ? nil : outputBuffer.removeFirst()
    }

    /// Wait for a specific response string from the engine.
    func waitForResponse(_ expected: String, timeoutSeconds: Double = 10.0) async throws {
        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while Date() < deadline {
            if let line = readLine(), line.hasPrefix(expected) { return }
            try await Task.sleep(nanoseconds: 10_000_000) // 10ms polling
        }
        throw StockfishError.timeout
    }

    /// Stop the engine.
    func stop() {
        isRunning = false
        outputLock.lock()
        outputBuffer.removeAll()
        outputLock.unlock()
    }

    // MARK: - Development Simulation

    /// Simulate Stockfish responses for development/testing.
    /// In production, this is replaced by actual engine communication.
    private func simulateResponse(to command: String) {
        outputLock.lock()
        defer { outputLock.unlock() }

        if command == "uci" {
            outputBuffer.append("id name Stockfish 16")
            outputBuffer.append("id author T. Romstad, M. Costalba, J. Kiiski, G. Linscott")
            outputBuffer.append("uciok")
        } else if command == "isready" {
            outputBuffer.append("readyok")
        } else if command.hasPrefix("go") {
            // Simulate a simple analysis response
            // In production, the real engine would respond with actual analysis
            let moves = ["e2e4", "d2d4", "c2c4", "g1f3", "b1c3", "e2e3", "d2d3", "g2g3", "f2f4", "b2b3"]
            for (i, move) in moves.enumerated() {
                let score = 30 - i * 5
                outputBuffer.append("info depth 12 multipv \(i + 1) score cp \(score) pv \(move)")
            }
            outputBuffer.append("bestmove e2e4")
        }
    }
}
