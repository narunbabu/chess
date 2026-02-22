package com.chess99.data.websocket

import com.chess99.BuildConfig
import com.chess99.data.local.TokenManager
import com.pusher.client.Pusher
import com.pusher.client.PusherOptions
import com.pusher.client.channel.Channel
import com.pusher.client.channel.PresenceChannel
import com.pusher.client.channel.PrivateChannel
import com.pusher.client.connection.ConnectionEventListener
import com.pusher.client.connection.ConnectionState
import com.pusher.client.connection.ConnectionStateChange
import com.pusher.client.util.HttpAuthorizer
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages WebSocket connections via Pusher Java Client to Laravel Reverb.
 * Handles connection lifecycle, channel subscriptions, and reconnection.
 */
@Singleton
class PusherManager @Inject constructor(
    private val tokenManager: TokenManager,
) {
    private var pusher: Pusher? = null
    private val subscribedChannels = mutableSetOf<String>()
    private var connectionListener: ConnectionListener? = null

    interface ConnectionListener {
        fun onConnected(socketId: String)
        fun onDisconnected()
        fun onError(message: String)
    }

    fun setConnectionListener(listener: ConnectionListener) {
        this.connectionListener = listener
    }

    fun connect() {
        if (pusher?.connection?.state == ConnectionState.CONNECTED) {
            Timber.d("Already connected to WebSocket")
            return
        }

        val token = tokenManager.getToken() ?: run {
            Timber.w("No auth token available for WebSocket connection")
            return
        }

        val baseUrl = BuildConfig.API_BASE_URL.removeSuffix("/")
        val authorizer = HttpAuthorizer("$baseUrl/websocket/broadcasting/auth").apply {
            setHeaders(
                mapOf(
                    "Authorization" to "Bearer $token",
                    "Accept" to "application/json",
                )
            )
        }

        val options = PusherOptions().apply {
            setHost(BuildConfig.WS_HOST)
            setWsPort(BuildConfig.WS_PORT)
            setWssPort(BuildConfig.WS_PORT)
            isUseTLS = BuildConfig.WS_USE_TLS
            setAuthorizer(authorizer)
            setActivityTimeout(120000)
            setPongTimeout(30000)
        }

        pusher = Pusher(BuildConfig.WS_KEY, options).apply {
            connect(object : ConnectionEventListener {
                override fun connectionEstablished(change: ConnectionStateChange) {
                    val socketId = connection.socketId
                    Timber.d("WebSocket connected, socketId: $socketId")
                    connectionListener?.onConnected(socketId)
                }

                override fun connectionError(
                    message: String,
                    code: String?,
                    e: Exception?,
                ) {
                    Timber.e(e, "WebSocket connection error: $message (code: $code)")
                    connectionListener?.onError(message)
                }
            }, ConnectionState.ALL)
        }
    }

    fun disconnect() {
        subscribedChannels.clear()
        pusher?.disconnect()
        pusher = null
        connectionListener?.onDisconnected()
    }

    fun subscribeToPrivateChannel(channelName: String): PrivateChannel? {
        val fullName = if (channelName.startsWith("private-")) channelName
        else "private-$channelName"

        if (subscribedChannels.contains(fullName)) {
            Timber.d("Already subscribed to $fullName")
            return pusher?.getPrivateChannel(fullName)
        }

        return pusher?.subscribePrivate(fullName)?.also {
            subscribedChannels.add(fullName)
            Timber.d("Subscribed to private channel: $fullName")
        }
    }

    fun subscribeToPresenceChannel(channelName: String): PresenceChannel? {
        val fullName = if (channelName.startsWith("presence-")) channelName
        else "presence-$channelName"

        if (subscribedChannels.contains(fullName)) {
            Timber.d("Already subscribed to $fullName")
            return pusher?.getPresenceChannel(fullName)
        }

        return pusher?.subscribePresence(fullName)?.also {
            subscribedChannels.add(fullName)
            Timber.d("Subscribed to presence channel: $fullName")
        }
    }

    fun subscribeToChannel(channelName: String): Channel? {
        if (subscribedChannels.contains(channelName)) {
            return pusher?.getChannel(channelName)
        }

        return pusher?.subscribe(channelName)?.also {
            subscribedChannels.add(channelName)
        }
    }

    fun unsubscribe(channelName: String) {
        pusher?.unsubscribe(channelName)
        subscribedChannels.remove(channelName)
        // Also remove with prefix variants
        subscribedChannels.remove("private-$channelName")
        subscribedChannels.remove("presence-$channelName")
        Timber.d("Unsubscribed from channel: $channelName")
    }

    fun isConnected(): Boolean =
        pusher?.connection?.state == ConnectionState.CONNECTED

    fun getSocketId(): String? = pusher?.connection?.socketId
}
