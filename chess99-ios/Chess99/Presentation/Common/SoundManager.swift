import AVFoundation

/// Manages chess game sound effects.
/// Uses AVAudioPlayer for reliable playback.
///
/// Sound triggers match web frontend:
/// - move: Every legal piece movement
/// - capture: When a piece is captured
/// - check: When a move results in check
/// - gameEnd: When game completes (checkmate, stalemate, resignation)
final class SoundManager {
    static let shared = SoundManager()

    private var movePlayer: AVAudioPlayer?
    private var capturePlayer: AVAudioPlayer?
    private var checkPlayer: AVAudioPlayer?
    private var gameEndPlayer: AVAudioPlayer?
    private var isMuted = false

    private init() {
        // Configure audio session for game sounds
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)

        // Load sound files from bundle
        // NOTE: Add these sound files to the Xcode project:
        // movePlayer = loadSound("move", ext: "mp3")
        // capturePlayer = loadSound("capture", ext: "mp3")
        // checkPlayer = loadSound("check", ext: "mp3")
        // gameEndPlayer = loadSound("game_end", ext: "mp3")
    }

    func playMove() { play(movePlayer) }
    func playCapture() { play(capturePlayer) }
    func playCheck() { play(checkPlayer) }
    func playGameEnd() { play(gameEndPlayer) }

    func setMuted(_ muted: Bool) { isMuted = muted }

    private func play(_ player: AVAudioPlayer?) {
        guard !isMuted, let player = player else { return }
        player.currentTime = 0
        player.play()
    }

    private func loadSound(_ name: String, ext: String) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else { return nil }
        return try? AVAudioPlayer(contentsOf: url)
    }
}
