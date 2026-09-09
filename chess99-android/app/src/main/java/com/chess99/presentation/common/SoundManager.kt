package com.chess99.presentation.common

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.chess99.R
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages chess game sound effects.
 * Uses SoundPool for low-latency playback.
 *
 * Sound triggers match web frontend:
 * - move: Every legal piece movement
 * - check: When a move results in check
 * - gameEnd: When game completes (checkmate, stalemate, resignation)
 */
@Singleton
class SoundManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val soundPool: SoundPool
    private var moveSound: Int = 0
    private var checkSound: Int = 0
    private var gameEndSound: Int = 0
    private var captureSound: Int = 0
    private val loadedSounds = java.util.concurrent.ConcurrentHashMap.newKeySet<Int>()
    private var isMuted = false

    init {
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(4)
            .setAudioAttributes(attrs)
            .build()

        soundPool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) loadedSounds.add(sampleId)
        }

        // Reuse Chess99's existing web game sounds in the native package.
        moveSound = soundPool.load(context, R.raw.move, 1)
        checkSound = soundPool.load(context, R.raw.check, 1)
        gameEndSound = soundPool.load(context, R.raw.game_end, 1)
        captureSound = soundPool.load(context, R.raw.capture, 1)
    }

    fun playMove() { play(moveSound) }
    fun playCheck() { play(checkSound) }
    fun playGameEnd() { play(gameEndSound) }
    fun playCapture() { play(captureSound) }

    fun setMuted(muted: Boolean) { isMuted = muted }

    private fun play(soundId: Int) {
        if (isMuted || !loadedSounds.contains(soundId)) return
        soundPool.play(soundId, 1.0f, 1.0f, 1, 0, 1.0f)
    }

    fun release() {
        soundPool.release()
    }
}
