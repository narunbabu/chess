package com.chess99.domain.model

/**
 * Standardized game result matching the web frontend's resultStandardization.js contract.
 */
data class GameResult(
    val status: ResultStatus,
    val details: String,
    val endReason: EndReason,
    val winner: Winner? = null,
)

enum class ResultStatus {
    WON, LOST, DRAW;

    companion object {
        fun fromString(value: String): ResultStatus =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: DRAW
    }
}

enum class EndReason {
    CHECKMATE,
    RESIGNATION,
    TIMEOUT,
    STALEMATE,
    INSUFFICIENT_MATERIAL,
    THREEFOLD_REPETITION,
    FIFTY_MOVE_RULE,
    AGREEMENT;

    companion object {
        fun fromString(value: String): EndReason =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: CHECKMATE
    }
}

enum class Winner {
    PLAYER, OPPONENT;

    companion object {
        fun fromString(value: String): Winner? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}
