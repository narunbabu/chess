package com.chess99.engine

import android.content.Context
import java.io.*
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * JNI bridge to the Stockfish chess engine binary.
 *
 * Stockfish 11 (classical eval, no NNUE) is compiled per-ABI by the NDK and
 * packaged as a fake shared library `libstockfish.so` under
 * `app/src/main/jniLibs/<abi>/` (arm64-v8a, armeabi-v7a, x86_64). Android only
 * allows exec() of binaries that live under `context.applicationInfo.nativeLibraryDir`
 * — since API 29, W^X enforcement blocks executing anything extracted to
 * app-writable storage (filesDir, cacheDir, etc). `useLegacyPackaging = true`
 * in app/build.gradle.kts guarantees the .so is extracted to nativeLibraryDir
 * as a real file at install time, so this path is always exec-legal.
 *
 * Communication uses stdin/stdout via Process streams.
 * Thread-safe via synchronized blocks and blocking queue.
 */
object StockfishBridge {

    private const val ENGINE_LIB_NAME = "libstockfish.so"

    private var process: Process? = null
    private var writer: BufferedWriter? = null
    private var reader: BufferedReader? = null
    private val outputQueue = LinkedBlockingQueue<String>()
    private var readerThread: Thread? = null
    private var isRunning = false

    /**
     * Initialize the engine process from the bundled native binary.
     *
     * @param context required — used to resolve applicationInfo.nativeLibraryDir.
     *   Throws IllegalArgumentException if null (callers must supply an
     *   application context; see StockfishEngine.initialize()).
     */
    @Synchronized
    fun init(context: Context? = null) {
        if (isRunning) return
        requireNotNull(context) { "StockfishBridge.init() requires a Context to locate the native engine binary" }

        val stockfishPath = File(context.applicationInfo.nativeLibraryDir, ENGINE_LIB_NAME).absolutePath
        val binaryFile = File(stockfishPath)
        if (!binaryFile.exists()) {
            // Shouldn't happen once packaged correctly for this ABI (T2) — internal
            // diagnostic message only; UI-facing copy is handled by callers (T4).
            throw IllegalStateException(
                "Stockfish binary missing at $stockfishPath (ABI ${android.os.Build.SUPPORTED_ABIS.firstOrNull()})"
            )
        }

        try {
            val pb = ProcessBuilder(stockfishPath)
            pb.redirectErrorStream(true)
            process = pb.start()

            writer = BufferedWriter(OutputStreamWriter(process!!.outputStream))
            reader = BufferedReader(InputStreamReader(process!!.inputStream))
            isRunning = true

            // Start reading output in background thread
            readerThread = Thread {
                try {
                    while (isRunning) {
                        val line = reader?.readLine() ?: break
                        outputQueue.put(line)
                    }
                } catch (_: IOException) {
                    // Engine process terminated
                } catch (_: InterruptedException) {
                    // Thread interrupted during shutdown
                }
            }.apply {
                isDaemon = true
                name = "stockfish-reader"
                start()
            }
        } catch (e: Exception) {
            destroy()
            throw RuntimeException("Failed to start Stockfish engine", e)
        }
    }

    /**
     * Send a UCI command to the engine.
     */
    @Synchronized
    fun sendCommand(command: String) {
        check(isRunning) { "Engine not running" }
        try {
            writer?.write(command)
            writer?.newLine()
            writer?.flush()
        } catch (e: IOException) {
            throw RuntimeException("Failed to send command: $command", e)
        }
    }

    /**
     * Read one line from engine output. Blocks up to 10 seconds.
     */
    fun readLine(): String? {
        return outputQueue.poll(10, TimeUnit.SECONDS)
    }

    /**
     * Wait for a specific response string from the engine.
     * Blocks until the expected response is received or timeout.
     */
    fun waitForResponse(expected: String, timeoutMs: Long = 10000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val line = outputQueue.poll(1, TimeUnit.SECONDS) ?: continue
            if (line.startsWith(expected)) return
        }
        throw RuntimeException("Timeout waiting for: $expected")
    }

    /**
     * Shutdown the engine process.
     */
    @Synchronized
    fun destroy() {
        isRunning = false
        try {
            writer?.close()
            reader?.close()
            process?.destroy()
        } catch (_: Exception) {}
        readerThread?.interrupt()
        outputQueue.clear()
        process = null
        writer = null
        reader = null
    }
}
