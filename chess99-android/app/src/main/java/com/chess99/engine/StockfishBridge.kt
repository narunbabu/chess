package com.chess99.engine

import android.content.Context
import java.io.*
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * JNI bridge to the Stockfish chess engine binary.
 *
 * The Stockfish binary is bundled in the app's native libs (jniLibs/) for each ABI:
 * - arm64-v8a, armeabi-v7a, x86_64
 *
 * Communication uses stdin/stdout via Process streams.
 * Thread-safe via synchronized blocks and blocking queue.
 *
 * Setup instructions:
 * 1. Cross-compile Stockfish for Android NDK targets
 * 2. Place binaries in app/src/main/jniLibs/{abi}/libstockfish.so
 * 3. Or use the process-based approach (copy binary to app files, chmod +x, exec)
 */
object StockfishBridge {

    private var process: Process? = null
    private var writer: BufferedWriter? = null
    private var reader: BufferedReader? = null
    private val outputQueue = LinkedBlockingQueue<String>()
    private var readerThread: Thread? = null
    private var isRunning = false

    /**
     * Initialize the engine process.
     * Extracts the Stockfish binary from assets and starts it.
     */
    @Synchronized
    fun init(context: Context? = null) {
        if (isRunning) return

        // In production, extract stockfish binary from assets to internal storage
        // For now, use a process-based approach with the bundled binary
        val stockfishPath = context?.let { extractBinary(it) } ?: "stockfish"

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

    /**
     * Extract the Stockfish binary from assets to internal storage.
     * Returns the path to the executable.
     */
    private fun extractBinary(context: Context): String {
        val binaryName = "stockfish"
        val binaryFile = File(context.filesDir, binaryName)

        if (!binaryFile.exists()) {
            try {
                context.assets.open(binaryName).use { input ->
                    FileOutputStream(binaryFile).use { output ->
                        input.copyTo(output)
                    }
                }
                binaryFile.setExecutable(true)
            } catch (e: Exception) {
                throw RuntimeException("Failed to extract Stockfish binary", e)
            }
        }

        return binaryFile.absolutePath
    }
}
