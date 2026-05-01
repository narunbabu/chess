package com.chess99.domain.model

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

enum class MoveClassification(val icon: String, val label: String) {
    BRILLIANT("★", "Brilliant"),
    EXCELLENT("⭐", "Excellent"),
    GOOD("✓", "Good"),
    INACCURACY("?!", "Inaccuracy"),
    MISTAKE("?", "Mistake"),
    BLUNDER("??", "Blunder"),
    BOOK("📗", "Book"),
}

data class QualityCounts(
    val white: Map<String, Int> = emptyMap(),
    val black: Map<String, Int> = emptyMap(),
)
