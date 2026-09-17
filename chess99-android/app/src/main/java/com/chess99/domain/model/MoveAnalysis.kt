package com.chess99.domain.model

import com.chess99.R

/**
 * Full analysis report for a completed game.
 * Mirrors the backend GameAnalysis model returned by POST /api/games/{id}/analyze.
 */
data class GameAnalysisReport(
    val status: AnalysisStatus = AnalysisStatus.IDLE,
    val moveAnalyses: List<AnalyzedMove> = emptyList(),
    val accuracyWhite: Float = 0f,
    val accuracyBlack: Float = 0f,
    val acplWhite: Float = 0f,
    val acplBlack: Float = 0f,
    val qualityCounts: QualityCounts = QualityCounts(),
    val openingName: String? = null,
    val progress: Int = 0,     // 0-100 during LOADING
    val error: String? = null,
)

enum class AnalysisStatus { IDLE, LOADING, DONE, ERROR }

data class AnalyzedMove(
    val moveNumber: Int,
    val color: String,         // "white" or "black"
    val san: String,           // e.g. "Nf3"
    val from: String = "",
    val to: String = "",
    val evalBeforeCp: Int = 0, // centipawn eval before the move
    val evalAfterCp: Int = 0,  // centipawn eval after the move
    val cpLoss: Int = 0,       // centipawn loss from player's perspective
    val bestMove: String? = null,
    val classification: MoveClassification = MoveClassification.GOOD,
    val isMateBefore: Boolean = false,
    val isMateAfter: Boolean = false,
)

/** `icon` is a glyph, not copy; the label is a string resource. */
enum class MoveClassification(
    val icon: String,
    @androidx.annotation.StringRes val labelRes: Int,
) {
    BRILLIANT("★", R.string.move_class_brilliant),
    EXCELLENT("⭐", R.string.move_class_excellent),
    GOOD("✓", R.string.move_class_good),
    INACCURACY("?!", R.string.move_class_inaccuracy),
    MISTAKE("?", R.string.move_class_mistake),
    BLUNDER("??", R.string.move_class_blunder),
    BOOK("📗", R.string.move_class_book),
}

data class QualityCounts(
    val white: Map<String, Int> = emptyMap(),
    val black: Map<String, Int> = emptyMap(),
)
