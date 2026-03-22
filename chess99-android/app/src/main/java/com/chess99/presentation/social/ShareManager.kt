package com.chess99.presentation.social

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.widget.Toast
import androidx.core.content.FileProvider
import com.chess99.data.api.SocialApi
import com.google.gson.JsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Singleton manager for sharing game results across platforms.
 * Handles Android share sheet, direct platform shares, clipboard, and referral links.
 *
 * Mirrors chess-frontend/src/components/play/DefeatCard.js sharing behavior.
 */
@Singleton
class ShareManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val socialApi: SocialApi,
) {

    companion object {
        private const val BASE_URL = "https://chess99.com"
        private const val FILE_PROVIDER_AUTHORITY = "com.chess99.fileprovider"
    }

    // ── Data Class ──────────────────────────────────────────────────────

    data class ShareableGame(
        val gameId: Int,
        val whitePlayer: String,
        val blackPlayer: String,
        val result: String, // "white", "black", "draw"
        val ratingChange: Int,
        val totalMoves: Int,
        val timeControl: String,
        val pgn: String = "",
    )

    // ── Share Text Formatting ───────────────────────────────────────────

    private fun formatShareText(game: ShareableGame): String {
        val resultText = when (game.result) {
            "white" -> "${game.whitePlayer} won"
            "black" -> "${game.blackPlayer} won"
            "draw" -> "Draw"
            else -> game.result
        }

        val ratingText = when {
            game.ratingChange > 0 -> "+${game.ratingChange}"
            game.ratingChange < 0 -> "${game.ratingChange}"
            else -> "+0"
        }

        return buildString {
            appendLine("Chess99 Game Result")
            appendLine("${game.whitePlayer} vs ${game.blackPlayer}")
            appendLine("Result: $resultText")
            appendLine("Rating: $ratingText")
            appendLine("Moves: ${game.totalMoves} | Time: ${game.timeControl.replace("|", "+")}")
            appendLine()
            appendLine("$BASE_URL/game/${game.gameId}")
        }
    }

    // ── General Share Sheet ─────────────────────────────────────────────

    fun shareGameResult(context: Context, game: ShareableGame) {
        val shareText = formatShareText(game)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Chess99 - Game Result")
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        val chooser = Intent.createChooser(intent, "Share game result")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
        trackShare(game.gameId, "other")
    }

    // ── WhatsApp Share ──────────────────────────────────────────────────

    fun shareToWhatsApp(context: Context, game: ShareableGame) {
        val shareText = formatShareText(game)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            `package` = "com.whatsapp"
            putExtra(Intent.EXTRA_TEXT, shareText)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            trackShare(game.gameId, "whatsapp")
        } catch (e: Exception) {
            Timber.w(e, "WhatsApp not installed, falling back to share sheet")
            shareGameResult(context, game)
        }
    }

    // ── Twitter/X Share ─────────────────────────────────────────────────

    fun shareToTwitter(context: Context, game: ShareableGame) {
        val resultText = when (game.result) {
            "white" -> "${game.whitePlayer} won"
            "black" -> "${game.blackPlayer} won"
            "draw" -> "Draw"
            else -> game.result
        }

        val ratingText = when {
            game.ratingChange > 0 -> "+${game.ratingChange}"
            game.ratingChange < 0 -> "${game.ratingChange}"
            else -> "+0"
        }

        val tweetText = buildString {
            append("${game.whitePlayer} vs ${game.blackPlayer}")
            append(" | $resultText")
            append(" ($ratingText)")
            append(" | ${game.totalMoves} moves")
            append("\n$BASE_URL/game/${game.gameId}")
            append("\n#Chess99 #Chess")
        }

        // Try Twitter app first
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            `package` = "com.twitter.android"
            putExtra(Intent.EXTRA_TEXT, tweetText)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            trackShare(game.gameId, "twitter")
        } catch (e: Exception) {
            // Fall back to X app
            try {
                val xIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    `package` = "com.twitter.android"
                    putExtra(Intent.EXTRA_TEXT, tweetText)
                }
                xIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(xIntent)
                trackShare(game.gameId, "twitter")
            } catch (e2: Exception) {
                Timber.w(e2, "Twitter/X not installed, falling back to browser")
                val url = "https://twitter.com/intent/tweet?text=${Uri.encode(tweetText)}"
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(browserIntent)
                trackShare(game.gameId, "twitter")
            }
        }
    }

    // ── Facebook Share ──────────────────────────────────────────────────

    fun shareToFacebook(context: Context, game: ShareableGame) {
        val gameUrl = "$BASE_URL/game/${game.gameId}"
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            `package` = "com.facebook.katana"
            putExtra(Intent.EXTRA_TEXT, gameUrl)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            trackShare(game.gameId, "facebook")
        } catch (e: Exception) {
            Timber.w(e, "Facebook not installed, falling back to browser")
            val url = "https://www.facebook.com/sharer/sharer.php?u=${Uri.encode(gameUrl)}"
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(browserIntent)
            trackShare(game.gameId, "facebook")
        }
    }

    // ── Copy Game Link ──────────────────────────────────────────────────

    fun copyGameLink(context: Context, gameId: Int) {
        val link = "$BASE_URL/game/$gameId"
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Chess99 Game Link", link)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "Game link copied!", Toast.LENGTH_SHORT).show()
        trackShare(gameId, "copy")
    }

    // ── Invite / Referral Link ──────────────────────────────────────────

    fun shareInviteLink(context: Context, userId: Int) {
        val inviteText = buildString {
            appendLine("Join me on Chess99 - the best way to play chess online!")
            appendLine()
            appendLine("$BASE_URL/invite/$userId")
        }

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Join Chess99!")
            putExtra(Intent.EXTRA_TEXT, inviteText)
        }
        val chooser = Intent.createChooser(intent, "Invite a friend")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    // ── Screenshot Capture & Share ──────────────────────────────────────

    /**
     * Capture a View as a bitmap and share it via the system share sheet.
     * Must be called from the main thread with a view that has been laid out.
     */
    suspend fun captureAndShareScreenshot(view: View, context: Context, gameId: Int) {
        try {
            // Capture on main thread
            val bitmap = withContext(Dispatchers.Main) {
                view.isDrawingCacheEnabled = true
                view.buildDrawingCache()
                val bmp = Bitmap.createBitmap(view.drawingCache)
                view.isDrawingCacheEnabled = false
                bmp
            }

            // Save to cache directory on IO thread
            val file = withContext(Dispatchers.IO) {
                val cacheDir = File(context.cacheDir, "share_images")
                cacheDir.mkdirs()
                val imageFile = File(cacheDir, "chess99_game_$gameId.png")
                FileOutputStream(imageFile).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                }
                imageFile
            }

            val uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file)

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, "Check out my game on Chess99!\n$BASE_URL/game/$gameId")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, "Share game screenshot")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            trackShare(gameId, "screenshot")
        } catch (e: Exception) {
            Timber.e(e, "Failed to capture and share screenshot")
            Toast.makeText(context, "Failed to share screenshot", Toast.LENGTH_SHORT).show()
        }
    }

    // ── Analytics Tracking ──────────────────────────────────────────────

    private fun trackShare(gameId: Int, platform: String) {
        // Fire-and-forget tracking — don't block the share action
        try {
            val body = JsonObject().apply {
                addProperty("game_id", gameId)
                addProperty("platform", platform)
            }
            // Note: This would need a coroutine scope in production.
            // For now, the ViewModel that calls share methods should handle tracking.
            Timber.d("Share tracked: game=$gameId platform=$platform")
        } catch (e: Exception) {
            Timber.w(e, "Failed to track share")
        }
    }
}
