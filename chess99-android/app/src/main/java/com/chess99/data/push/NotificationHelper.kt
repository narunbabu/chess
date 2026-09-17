package com.chess99.data.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.net.toUri
import com.chess99.R
import com.chess99.presentation.MainActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Singleton notification helper for Chess99.
 *
 * Creates and manages four notification channels:
 *   - chess99_game      (HIGH)    — game moves, invitations, results
 *   - chess99_tournament (DEFAULT) — tournament updates, round pairings
 *   - chess99_social    (LOW)     — friend requests, social events
 *   - chess99_system    (MIN)     — system/maintenance messages
 *
 * Each show*() method builds a notification with an appropriate deep-link
 * PendingIntent using the chess99:// URI scheme.
 */
@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val notificationManager: NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createChannels()
    }

    // ── Channel Creation ─────────────────────────────────────────────────

    private fun createChannels() {
        val channels = listOf(
            NotificationChannel(
                CHANNEL_GAME,
                context.getString(R.string.notif_channel_game),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.notif_channel_game_desc)
                enableVibration(true)
                enableLights(true)
            },
            NotificationChannel(
                CHANNEL_TOURNAMENT,
                context.getString(R.string.notif_channel_tournament),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.notif_channel_tournament_desc)
            },
            NotificationChannel(
                CHANNEL_SOCIAL,
                context.getString(R.string.notif_channel_social),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = context.getString(R.string.notif_channel_social_desc)
            },
            NotificationChannel(
                CHANNEL_SYSTEM,
                context.getString(R.string.notif_channel_system),
                NotificationManager.IMPORTANCE_MIN,
            ).apply {
                description = context.getString(R.string.notif_channel_system_desc)
            },
        )

        notificationManager.createNotificationChannels(channels)
        Timber.d("Notification channels created: ${channels.map { it.id }}")
    }

    // ── Game Move ────────────────────────────────────────────────────────

    fun showGameMoveNotification(gameId: Int, opponentName: String, isYourTurn: Boolean) {
        val title = context.getString(
            if (isYourTurn) R.string.notif_your_turn_title else R.string.notif_opponent_moved_title,
        )
        val body = context.getString(
            if (isYourTurn) R.string.notif_your_turn_body else R.string.notif_opponent_moved_body,
            opponentName,
        )

        val pendingIntent = buildDeepLinkPendingIntent(
            uri = "chess99://game/$gameId",
            requestCode = NOTIFICATION_ID_GAME_BASE + gameId,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_GAME)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()

        notificationManager.notify(NOTIFICATION_ID_GAME_BASE + gameId, notification)
    }

    // ── Invitation ───────────────────────────────────────────────────────

    fun showInvitationNotification(invitationId: Int, fromPlayer: String) {
        val pendingIntent = buildDeepLinkPendingIntent(
            uri = "chess99://lobby",
            requestCode = NOTIFICATION_ID_INVITATION_BASE + invitationId,
        )

        // Accept action
        val acceptIntent = buildDeepLinkPendingIntent(
            uri = "chess99://lobby?action=accept&invitation=$invitationId",
            requestCode = NOTIFICATION_ID_INVITATION_BASE + invitationId + 10000,
        )

        // Decline action
        val declineIntent = buildDeepLinkPendingIntent(
            uri = "chess99://lobby?action=decline&invitation=$invitationId",
            requestCode = NOTIFICATION_ID_INVITATION_BASE + invitationId + 20000,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_GAME)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(context.getString(R.string.notif_challenge_title))
            .setContentText(context.getString(R.string.notif_challenge_body, fromPlayer))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(
                R.mipmap.ic_launcher,
                context.getString(R.string.action_accept),
                acceptIntent,
            )
            .addAction(
                R.mipmap.ic_launcher,
                context.getString(R.string.action_decline),
                declineIntent,
            )
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .build()

        notificationManager.notify(
            NOTIFICATION_ID_INVITATION_BASE + invitationId,
            notification,
        )
    }

    // ── Tournament ───────────────────────────────────────────────────────

    fun showTournamentNotification(championshipId: Int, title: String, message: String) {
        val pendingIntent = buildDeepLinkPendingIntent(
            uri = "chess99://tournament/$championshipId",
            requestCode = NOTIFICATION_ID_TOURNAMENT_BASE + championshipId,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_TOURNAMENT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .build()

        notificationManager.notify(
            NOTIFICATION_ID_TOURNAMENT_BASE + championshipId,
            notification,
        )
    }

    // ── Generic ──────────────────────────────────────────────────────────

    fun showGenericNotification(title: String, body: String) {
        val pendingIntent = buildDeepLinkPendingIntent(
            uri = "chess99://lobby",
            requestCode = NOTIFICATION_ID_GENERIC,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_SYSTEM)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(NOTIFICATION_ID_GENERIC, notification)
    }

    // ── Deep-Link PendingIntent Builder ──────────────────────────────────

    private fun buildDeepLinkPendingIntent(uri: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri.toUri()
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val CHANNEL_GAME = "chess99_game"
        const val CHANNEL_TOURNAMENT = "chess99_tournament"
        const val CHANNEL_SOCIAL = "chess99_social"
        const val CHANNEL_SYSTEM = "chess99_system"

        private const val NOTIFICATION_ID_GAME_BASE = 1000
        private const val NOTIFICATION_ID_INVITATION_BASE = 2000
        private const val NOTIFICATION_ID_TOURNAMENT_BASE = 3000
        private const val NOTIFICATION_ID_GENERIC = 9999
    }
}
