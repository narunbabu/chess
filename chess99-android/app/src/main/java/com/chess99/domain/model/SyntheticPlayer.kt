package com.chess99.domain.model

import androidx.annotation.StringRes
import com.chess99.R

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

enum class SkillGroup(@StringRes val label: Int) {
    BEGINNER(R.string.companion_difficulty_beginner),
    INTERMEDIATE(R.string.companion_difficulty_intermediate),
    ADVANCED(R.string.companion_difficulty_advanced),
}
