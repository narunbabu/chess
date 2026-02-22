package com.chess99

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
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
            "Game Notifications",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications for game moves, invitations, and results"
            enableVibration(true)
        }

        val tournamentChannel = NotificationChannel(
            "chess99_tournament",
            "Tournament Notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Notifications for tournament updates and reminders"
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(gameChannel)
        manager.createNotificationChannel(tournamentChannel)
    }
}
