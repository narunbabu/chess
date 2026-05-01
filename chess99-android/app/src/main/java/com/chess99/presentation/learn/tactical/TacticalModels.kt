package com.chess99.presentation.learn.tactical

import com.chess99.engine.Color

data class TacticalStage(
    val id: Int,
    val title: String,
    val eloRange: String,
    val description: String,
    val themes: List<String>,
    val puzzleCount: Int,
    val unlocked: Boolean,
    val colorHex: Long,
    val icon: String,
    val dataFile: String,
    val unlockAfter: Int,
)

data class TacticalPuzzle(
    val id: String,
    val stage: Int,
    val fen: String,
    val moves: List<String>,
    val themes: List<String>,
    val difficulty: String,
    val rating: Int,
    val explanation: String,
    val playerColor: String,
)

data class StageProgress(
    val attempted: Int = 0,
    val solved: Int = 0,
    val unlocked: Boolean = false,
    val lastIndex: Int = 0,
    val completedPuzzleIds: Set<String> = emptySet(),
)

data class TacticalProgress(
    val rating: Int = 1000,
    val peakRating: Int = 1000,
    val totalAttempted: Int = 0,
    val totalSolved: Int = 0,
    val streak: Int = 0,
    val bestStreak: Int = 0,
    val stageProgress: Map<Int, StageProgress> = emptyMap(),
    val badges: List<TacticalBadge> = emptyList(),
)

data class PuzzleScoreResult(
    val cctScore: Int?,
    val execScore: Int,
    val combined: Int?,
    val cctQuality: Float,
    val cctAttempted: Boolean,
    val myFound: Int,
    val myTotal: Int,
    val oppFound: Int,
    val oppTotal: Int,
    val solutionShown: Boolean,
)

data class RatingDelta(
    val value: Int,
    val sign: String,
)

data class TacticalBadge(
    val id: String,
    val name: String,
    val description: String,
    val icon: String,
    val tier: String,
    val isUnlocked: Boolean = false,
    val unlockedAt: String? = null,
)

object TacticalStages {

    val stages = listOf(
        TacticalStage(
            id = 0,
            title = "Beginner Tactics",
            eloRange = "800 → 1400",
            description = "Master the fundamentals: forks, pins, back-rank mates, and skewers.",
            themes = listOf("Fork", "Pin", "Back rank mate", "Skewer", "Hanging pieces"),
            puzzleCount = 500,
            unlocked = true,
            colorHex = 0xFF4ADE80,
            icon = "♟",
            dataFile = "beginner_puzzles.json",
            unlockAfter = 15,
        ),
        TacticalStage(
            id = 1,
            title = "Tactical Sharpness",
            eloRange = "1400 → 1650",
            description = "Stop missing multi-move tactics. Master double attacks, discovered checks, and removing the defender.",
            themes = listOf("Double attacks", "Pins", "Discovered attacks", "Removing the defender"),
            puzzleCount = 500,
            unlocked = false,
            colorHex = 0xFF81B64C,
            icon = "⚡",
            dataFile = "stage1_puzzles.json",
            unlockAfter = 20,
        ),
        TacticalStage(
            id = 2,
            title = "Calculation Depth",
            eloRange = "1650 → 1900",
            description = "Calculate forcing lines clearly. Zwischenzug, deflection, sacrifices, and in-between moves.",
            themes = listOf("Zwischenzug", "Deflection", "Sacrifices", "Forcing variations"),
            puzzleCount = 500,
            unlocked = false,
            colorHex = 0xFF5B8DD9,
            icon = "🧠",
            dataFile = "stage2_puzzles.json",
            unlockAfter = 20,
        ),
        TacticalStage(
            id = 3,
            title = "Positional Tactics",
            eloRange = "1900 → 2100",
            description = "See tactics arising from position — quiet moves, overloaded pieces, and zugzwang.",
            themes = listOf("Quiet moves", "Overloaded pieces", "Trapped pieces", "Zugzwang"),
            puzzleCount = 500,
            unlocked = false,
            colorHex = 0xFFC9882A,
            icon = "🎯",
            dataFile = "stage3_puzzles.json",
            unlockAfter = 20,
        ),
        TacticalStage(
            id = 4,
            title = "Master Calculation",
            eloRange = "2100 → 2200+",
            description = "Long forcing lines, defensive resources, and endgame precision at master level.",
            themes = listOf("Long forcing lines", "Defensive resources", "Endgame tactics", "Quiet killers"),
            puzzleCount = 500,
            unlocked = false,
            colorHex = 0xFFC93A3A,
            icon = "🏆",
            dataFile = "stage4_puzzles.json",
            unlockAfter = 999,
        ),
    )

    fun defaultProgress(): TacticalProgress {
        val stageMap = stages.associate { stage ->
            stage.id to StageProgress(unlocked = stage.id == 0)
        }
        return TacticalProgress(stageProgress = stageMap)
    }

    fun computePuzzleScore(
        wrongCount: Int = 0,
        cctMyFound: Int = 0,
        cctMyTotal: Int = 0,
        cctOppFound: Int = 0,
        cctOppTotal: Int = 0,
        solutionShown: Boolean = false,
    ): PuzzleScoreResult {
        val cctAttempted = cctMyTotal > 0 || cctOppTotal > 0

        val cctScore: Int?
        val cctQuality: Float
        if (!cctAttempted) {
            cctScore = null
            cctQuality = 0f
        } else {
            val myQuality = if (cctMyTotal > 0) cctMyFound.toFloat() / cctMyTotal else 1f
            val oppQuality = if (cctOppTotal > 0) cctOppFound.toFloat() / cctOppTotal else 1f
            cctQuality = (myQuality + oppQuality) / 2f
            cctScore = (cctQuality * 100).toInt()
        }

        val execScore = when {
            solutionShown -> 0
            wrongCount == 0 -> 100
            wrongCount == 1 -> 75
            wrongCount == 2 -> 50
            wrongCount == 3 -> 25
            else -> 10
        }

        val combined = if (cctAttempted) (cctScore!! * 0.4f + execScore * 0.6f).toInt() else null

        return PuzzleScoreResult(
            cctScore = cctScore,
            execScore = execScore,
            combined = combined,
            cctQuality = cctQuality,
            cctAttempted = cctAttempted,
            myFound = cctMyFound,
            myTotal = cctMyTotal,
            oppFound = cctOppFound,
            oppTotal = cctOppTotal,
            solutionShown = solutionShown,
        )
    }

    fun computeRatingDelta(
        puzzle: TacticalPuzzle,
        success: Boolean,
        wrongCount: Int,
        cctQuality: Float = 1f,
    ): RatingDelta {
        val base = when (puzzle.difficulty) {
            "very hard" -> 12
            "hard" -> 8
            "medium" -> 5
            else -> 3
        }
        if (success) {
            val bonus = if (wrongCount == 0) (base * 0.4f).toInt() else 0
            val raw = base + bonus
            val mult = when {
                cctQuality >= 0.9f -> 1.0f
                cctQuality >= 0.7f -> 0.85f
                cctQuality >= 0.5f -> 0.70f
                else -> 0.50f
            }
            return RatingDelta(value = maxOf(1, (raw * mult).toInt()), sign = "+")
        }
        return RatingDelta(value = (base * 0.3f).toInt(), sign = "-")
    }
}
