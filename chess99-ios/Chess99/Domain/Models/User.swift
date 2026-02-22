import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: Int
    let name: String
    let email: String
    let avatarUrl: String?
    let rating: Int?
    let isProvisional: Bool?
    let gamesPlayed: Int?
    let peakRating: Int?
    let tutorialXp: Int?
    let tutorialLevel: Int?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, email, rating
        case avatarUrl = "avatar_url"
        case isProvisional = "is_provisional"
        case gamesPlayed = "games_played"
        case peakRating = "peak_rating"
        case tutorialXp = "tutorial_xp"
        case tutorialLevel = "tutorial_level"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
