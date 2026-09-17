package com.chess99

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.chess99.R
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class Chess99App : Application() {

    override fun onCreate() {
        super.onCreate()

        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val gameChannel = NotificationChannel(
            "chess99_game",
            getString(R.string.notif_channel_game),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notif_channel_game_desc)
            enableVibration(true)
        }

        val tournamentChannel = NotificationChannel(
            "chess99_tournament",
            getString(R.string.notif_channel_tournament),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = getString(R.string.notif_channel_tournament_legacy_desc)
        }

        val socialChannel = NotificationChannel(
            "chess99_social",
            getString(R.string.notif_channel_social),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notif_channel_social_desc)
        }

        val systemChannel = NotificationChannel(
            "chess99_system",
            getString(R.string.notif_channel_system),
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = getString(R.string.notif_channel_system_desc)
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(gameChannel, tournamentChannel, socialChannel, systemChannel)
        )
    }
}
