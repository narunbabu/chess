import SwiftUI

/// Chess game timer display.
/// Shows remaining time for a player with active/inactive visual states.
/// Matches web frontend timer behavior (10 min per player).
struct GameTimerView: View {
    let timeSeconds: Int
    let isActive: Bool
    let playerName: String

    private var minutes: Int { timeSeconds / 60 }
    private var seconds: Int { timeSeconds % 60 }
    private var isLowTime: Bool { timeSeconds < 60 }

    var body: some View {
        HStack {
            Text(playerName)
                .font(.subheadline)
                .fontWeight(.medium)

            Spacer()

            Text(String(format: "%d:%02d", minutes, seconds))
                .font(.system(.title2, design: .monospaced))
                .fontWeight(.bold)
        }
        .foregroundColor(foregroundColor)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(backgroundColor)
        .cornerRadius(8)
    }

    private var backgroundColor: Color {
        if isActive && isLowTime { return .red }
        if isActive { return .green }
        return Color(.systemGray5)
    }

    private var foregroundColor: Color {
        isActive ? .white : .primary
    }
}

/// Player info bar showing name, rating, and captured pieces.
struct PlayerInfoBar: View {
    let name: String
    var rating: Int? = nil
    var capturedPieces: String = ""
    var isCurrentTurn: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isCurrentTurn ? Color.green : Color.clear)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(name)
                        .font(.body)
                        .fontWeight(.medium)
                    if let rating = rating {
                        Text("(\(rating))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                if !capturedPieces.isEmpty {
                    Text(capturedPieces)
                        .font(.caption)
                        .tracking(2)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }
}
