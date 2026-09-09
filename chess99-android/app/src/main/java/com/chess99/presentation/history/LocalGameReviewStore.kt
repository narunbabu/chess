package com.chess99.presentation.history

import android.content.Context
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.presentation.game.GameMode
import com.chess99.presentation.game.GameMoveRecord
import com.chess99.presentation.game.GameResultState
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The latest fully local computer game, retained independently from auth and
 * the network so guest/offline results always have a review destination.
 */
data class LocalGameReviewRecord(
    val startingFen: String = ChessGame.STARTING_FEN,
    val moves: List<GameMoveRecord>,
    val result: GameResultState,
    val playerColor: Color,
    val opponentName: String,
    val difficulty: Int,
    val gameMode: GameMode,
    val completedAtEpochMillis: Long,
)

@Singleton
class LocalGameReviewStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    @Volatile private var memoryReview: LocalGameReviewRecord? = null

    fun save(review: LocalGameReviewRecord): Boolean {
        // Keep the just-finished game reviewable in this process even on the
        // rare device-storage failure; a failed disk write must not erase it.
        memoryReview = review
        return preferences.edit()
            .putString(KEY_LATEST_REVIEW, LocalGameReviewJson.encode(review))
            .commit()
    }

    fun load(): LocalGameReviewRecord? {
        memoryReview?.let { return it }
        val json = preferences.getString(KEY_LATEST_REVIEW, null) ?: return null
        return LocalGameReviewJson.decode(json)
            ?.also { memoryReview = it }
    }

    companion object {
        private const val PREFERENCES_NAME = "chess99_local_game_review"
        private const val KEY_LATEST_REVIEW = "latest_review"
    }
}

/** Pure codec so process-restart compatibility is covered by local JVM tests. */
internal object LocalGameReviewJson {
    private val gson = Gson()

    fun encode(review: LocalGameReviewRecord): String = gson.toJson(review)

    fun decode(json: String): LocalGameReviewRecord? = runCatching {
        // Gson can populate Kotlin non-null fields with null when a saved
        // record is incomplete. Validate inside the guarded block, before UI.
        val review = gson.fromJson(json, LocalGameReviewRecord::class.java)
        require(review.startingFen.isNotBlank())
        require(review.opponentName.isNotBlank())
        requireNotNull(review.playerColor)
        requireNotNull(review.gameMode)
        requireNotNull(review.result.status)
        require(review.result.details.isNotBlank())
        require(ChessGame(review.startingFen).fen() == review.startingFen)
        review.moves.forEach { move ->
            require(move.from.matches(Regex("[a-h][1-8]")) && move.to.matches(Regex("[a-h][1-8]")))
            require(move.san.isNotBlank())
            requireNotNull(move.playerColor)
            require(ChessGame(move.fen).fen() == move.fen)
        }
        review
    }.getOrNull()
}
