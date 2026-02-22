import Foundation

struct Game: Codable, Identifiable, Equatable {
    let id: Int
    let whitePlayerId: Int?
    let blackPlayerId: Int?
    let status: String
    let result: String?
    let endReason: String?
    let fen: String?
    let pgn: String?
    let timeControl: String?
    let gameMode: String?
    let whitePlayer: User?
    let blackPlayer: User?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status, result, fen, pgn
        case whitePlayerId = "white_player_id"
        case blackPlayerId = "black_player_id"
        case endReason = "end_reason"
        case timeControl = "time_control"
        case gameMode = "game_mode"
        case whitePlayer = "white_player"
        case blackPlayer = "black_player"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum GameStatus: String, Codable {
    case waiting, active, paused, completed, abandoned
}

enum GameMode: String, Codable {
    case casual, rated, championship
}

/// Standardized game result matching web frontend contract
struct GameResult: Codable, Equatable {
    let status: ResultStatus
    let details: String
    let endReason: EndReason
    let winner: Winner?

    enum CodingKeys: String, CodingKey {
        case status, details, winner
        case endReason = "end_reason"
    }
}

enum ResultStatus: String, Codable {
    case won, lost, draw
}

enum EndReason: String, Codable {
    case checkmate, resignation, timeout, stalemate
    case insufficientMaterial = "insufficient_material"
    case threefoldRepetition = "threefold_repetition"
    case fiftyMoveRule = "fifty_move_rule"
    case agreement
}

enum Winner: String, Codable {
    case player, opponent
}
