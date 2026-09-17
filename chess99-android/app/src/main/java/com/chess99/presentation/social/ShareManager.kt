package com.chess99.presentation.social

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.view.Window
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.graphics.createBitmap
import androidx.core.net.toUri
import com.chess99.R
import com.chess99.data.api.SocialApi
import com.google.gson.JsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import timber.log.Timber

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

    private fun formatShareText(context: Context, game: ShareableGame): String {
        val resultText = when (game.result) {
            "white" -> context.getString(R.string.share_result_win, game.whitePlayer)
            "black" -> context.getString(R.string.share_result_win, game.blackPlayer)
            "draw" -> context.getString(R.string.share_result_draw)
            else -> game.result
        }

        val ratingText = when {
            game.ratingChange > 0 -> "+${game.ratingChange}"
            game.ratingChange < 0 -> "${game.ratingChange}"
            else -> "+0"
        }

        return buildString {
            appendLine(context.getString(R.string.share_text_header))
            appendLine(context.getString(R.string.share_text_players, game.whitePlayer, game.blackPlayer))
            appendLine(context.getString(R.string.share_text_result, resultText))
            appendLine(context.getString(R.string.share_text_rating, ratingText))
            appendLine(
                context.getString(
                    R.string.share_text_moves,
                    game.totalMoves,
                    game.timeControl.replace("|", "+"),
                ),
            )
            appendLine()
            appendLine("$BASE_URL/game/${game.gameId}")
        }
    }

    // ── General Share Sheet ─────────────────────────────────────────────

    fun shareGameResult(context: Context, game: ShareableGame) {
        val shareText = formatShareText(context, game)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_subject_game_result))
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        val chooser = Intent.createChooser(intent, context.getString(R.string.share_chooser_game_result))
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
        trackShare(game.gameId, "other")
    }

    // ── WhatsApp Share ──────────────────────────────────────────────────

    fun shareToWhatsApp(context: Context, game: ShareableGame) {
        val shareText = formatShareText(context, game)
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
            "white" -> context.getString(R.string.share_result_win, game.whitePlayer)
            "black" -> context.getString(R.string.share_result_win, game.blackPlayer)
            "draw" -> context.getString(R.string.share_result_draw)
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
                val browserIntent = Intent(Intent.ACTION_VIEW, url.toUri())
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
            val browserIntent = Intent(Intent.ACTION_VIEW, url.toUri())
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(browserIntent)
            trackShare(game.gameId, "facebook")
        }
    }

    // ── Copy Game Link ──────────────────────────────────────────────────

    fun copyGameLink(context: Context, gameId: Int) {
        val link = "$BASE_URL/game/$gameId"
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(context.getString(R.string.share_clip_label), link)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, R.string.share_link_copied, Toast.LENGTH_SHORT).show()
        trackShare(gameId, "copy")
    }

    // ── Invite / Referral Link ──────────────────────────────────────────

    fun shareInviteLink(context: Context, userId: Int) {
        val inviteText = buildString {
            appendLine(context.getString(R.string.share_invite_body))
            appendLine()
            appendLine("$BASE_URL/invite/$userId")
        }

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_invite_subject))
            putExtra(Intent.EXTRA_TEXT, inviteText)
        }
        val chooser = Intent.createChooser(intent, context.getString(R.string.share_chooser_invite))
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
                putExtra(
                    Intent.EXTRA_TEXT,
                    context.getString(R.string.share_screenshot_text, "$BASE_URL/game/$gameId"),
                )
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, context.getString(R.string.share_chooser_screenshot))
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            trackShare(gameId, "screenshot")
        } catch (e: Exception) {
            Timber.e(e, "Failed to capture and share screenshot")
            Toast.makeText(context, R.string.share_screenshot_failed, Toast.LENGTH_SHORT).show()
        }
    }

    // ── Victory Image Capture & Share (PixelCopy — API 26+) ─────────────

    /**
     * Capture the CURRENT screen to a PNG and share it via the system chooser.
     *
     * Uses the modern [PixelCopy] API (reliable on API 26+, unlike the
     * deprecated drawingCache which returns a black bitmap on recent Android).
     * The bitmap is written to `cacheDir/share_images/` and shared through the
     * `com.chess99.fileprovider` FileProvider.
     *
     * The whole window is captured (board + result card + move list), so the
     * shared image is a full "victory screenshot". Never crashes: on any
     * failure it falls back to the text share ([shareGameResult]).
     *
     * Must be called from the main thread with a [view] that is attached to an
     * Activity window (e.g. Compose's LocalView.current).
     */
    suspend fun captureAndShare(view: View, context: Context, game: ShareableGame) {
        val caption = shareCaption(context, game)
        try {
            val window = (view.context as? Activity)?.window
                ?: (context as? Activity)?.window
            if (window == null) {
                Timber.w("No Activity window available for capture, sharing text instead")
                shareGameResult(context, game)
                return
            }

            val bitmap = withContext(Dispatchers.Main) { capturePixels(window, view) }
            if (bitmap == null) {
                shareGameResult(context, game)
                return
            }

            val file = withContext(Dispatchers.IO) {
                val cacheDir = File(context.cacheDir, "share_images")
                cacheDir.mkdirs()
                val imageFile = File(cacheDir, "chess99_victory_${game.gameId}.png")
                FileOutputStream(imageFile).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                }
                imageFile
            }

            val uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file)

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_subject_game_result))
                putExtra(Intent.EXTRA_TEXT, caption)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, context.getString(R.string.share_chooser_your_game))
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            trackShare(game.gameId, "victory_image")
        } catch (e: Exception) {
            // Kid-safe: never surface raw exception text; quietly fall back to
            // the text share so the child can still celebrate their win.
            Timber.e(e, "Failed to capture and share victory image")
            try {
                shareGameResult(context, game)
            } catch (e2: Exception) {
                Timber.e(e2, "Text share fallback also failed")
                Toast.makeText(context, R.string.share_failed, Toast.LENGTH_SHORT).show()
            }
        }
    }

    /** Kid-safe one-line caption accompanying the shared image. */
    private fun shareCaption(context: Context, game: ShareableGame): String {
        val resultText = when (game.result) {
            "white" -> context.getString(R.string.share_result_win, game.whitePlayer)
            "black" -> context.getString(R.string.share_result_win, game.blackPlayer)
            "draw" -> context.getString(R.string.share_result_draw_sentence)
            else -> game.result
        }
        return context.getString(
            R.string.share_caption,
            resultText,
            game.whitePlayer,
            game.blackPlayer,
            BASE_URL,
        )
    }

    /** Suspending PixelCopy request. Returns null on any failure. */
    private suspend fun capturePixels(window: Window, view: View): Bitmap? =
        suspendCancellableCoroutine { cont ->
            try {
                val width = view.width.takeIf { it > 0 } ?: window.decorView.width
                val height = view.height.takeIf { it > 0 } ?: window.decorView.height
                if (width <= 0 || height <= 0) {
                    cont.resume(null)
                    return@suspendCancellableCoroutine
                }
                val bitmap = createBitmap(width, height) // ARGB_8888
                val handler = Handler(Looper.getMainLooper())
                PixelCopy.request(window, bitmap, { result ->
                    if (result == PixelCopy.SUCCESS) {
                        cont.resume(bitmap)
                    } else {
                        Timber.w("PixelCopy failed with result=$result")
                        cont.resume(null)
                    }
                }, handler)
            } catch (e: Exception) {
                Timber.e(e, "PixelCopy request threw")
                cont.resume(null)
            }
        }

    // ── PGN File Share ───────────────────────────────────────────────────

    /**
     * Save PGN content to a temp file and share via ACTION_SEND.
     * Uses FileProvider to grant URI permissions to the receiving app.
     */
    fun sharePgnFile(context: Context, pgnContent: String, gameId: Int) {
        try {
            val cacheDir = File(context.cacheDir, "pgn_files")
            cacheDir.mkdirs()
            val pgnFile = File(cacheDir, "chess99-game-$gameId.pgn")
            pgnFile.writeText(pgnContent)

            val uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, pgnFile)

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/x-chess-pgn"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_subject_pgn, gameId))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, context.getString(R.string.share_chooser_pgn))
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
        } catch (e: Exception) {
            Timber.e(e, "Failed to share PGN file")
            // Fallback: share as text
            val fallbackIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_subject_pgn_text, gameId))
                putExtra(Intent.EXTRA_TEXT, pgnContent)
            }
            val chooser = Intent.createChooser(fallbackIntent, context.getString(R.string.share_chooser_pgn))
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
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
