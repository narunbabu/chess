package com.chess99.domain.model

data class Game(
    val id: Int,
    val whitePlayerId: Int?,
    val blackPlayerId: Int?,
    val status: GameStatus,
    val result: String? = null,
    val endReason: String? = null,
    val fen: String = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    val pgn: String? = null,
    val timeControl: String? = null,
    val gameMode: GameMode = GameMode.CASUAL,
    val whitePlayer: User? = null,
    val blackPlayer: User? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

enum class GameStatus {
    WAITING,
    ACTIVE,
    PAUSED,
    COMPLETED,
    ABANDONED;

    companion object {
        fun fromString(value: String): GameStatus =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: WAITING
    }
}

enum class GameMode {
    CASUAL,
    RATED,
    CHAMPIONSHIP;

    companion object {
        fun fromString(value: String): GameMode =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: CASUAL
    }
}
