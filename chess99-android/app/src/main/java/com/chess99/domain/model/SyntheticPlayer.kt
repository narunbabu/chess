package com.chess99.domain.model

data class SyntheticPlayer(
    val id: Int,
    val name: String,
    val rating: Int,
    val computerLevel: Int,
    val personality: String,
    val bio: String,
    val avatarUrl: String,
    val gamesPlayed: Int,
    val winRate: Double,
) {
    val personalityEmoji: String
        get() = when (personality.lowercase()) {
            "aggressive" -> "⚔️"
            "defensive" -> "🛡️"
            "balanced" -> "⚖️"
            "tactical" -> "🎯"
            "positional" -> "📐"
            else -> "🤖"
        }

    val skillGroup: SkillGroup
        get() = when {
            computerLevel <= 6 -> SkillGroup.BEGINNER
            computerLevel <= 10 -> SkillGroup.INTERMEDIATE
            else -> SkillGroup.ADVANCED
        }
}

enum class SkillGroup(val label: String) {
    BEGINNER("Beginner Friendly"),
    INTERMEDIATE("Intermediate"),
    ADVANCED("Advanced"),
}
