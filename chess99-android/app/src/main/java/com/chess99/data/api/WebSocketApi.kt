package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * WebSocket-related REST API endpoints.
 * These endpoints are called via HTTP but relate to the real-time game system.
 * Mirrors chess-frontend/src/services/WebSocketGameService.js
 */
interface WebSocketApi {

    // ── Handshake & Connection ──────────────────────────────────────────

    @POST("websocket/handshake")
    suspend fun handshake(@Body body: JsonObject): Response<JsonObject>

    @POST("websocket/heartbeat")
    suspend fun heartbeat(@Body body: JsonObject): Response<JsonObject>

    // ── Game State ──────────────────────────────────────────────────────

    @GET("websocket/games/{gameId}/state")
    suspend fun getGameState(@Path("gameId") gameId: Int): Response<JsonObject>

    @GET("websocket/room-state")
    suspend fun getRoomState(
        @Query("game_id") gameId: Int,
        @Query("compact") compact: Int = 1,
        @Query("since_move") sinceMoveCount: Int = -1,
    ): Response<JsonObject>

    // ── Moves ───────────────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/move")
    suspend fun sendMove(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    // ── Game Status ─────────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/status")
    suspend fun updateGameStatus(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("websocket/games/{gameId}/resign")
    suspend fun resign(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/forfeit")
    suspend fun forfeit(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("websocket/games/{gameId}/claim-timeout")
    suspend fun claimTimeout(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    // ── Pause & Resume ──────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/pause")
    suspend fun pauseGame(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("websocket/games/{gameId}/resume")
    suspend fun resumeGame(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("websocket/games/{gameId}/resume-request")
    suspend fun requestResume(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("websocket/games/{gameId}/resume-response")
    suspend fun respondToResume(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    // ── Draw ────────────────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/draw/offer")
    suspend fun offerDraw(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/draw/accept")
    suspend fun acceptDraw(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/draw/decline")
    suspend fun declineDraw(@Path("gameId") gameId: Int): Response<JsonObject>

    // ── Undo ────────────────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/undo/request")
    suspend fun requestUndo(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/undo/accept")
    suspend fun acceptUndo(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/undo/decline")
    suspend fun declineUndo(@Path("gameId") gameId: Int): Response<JsonObject>

    // ── Chat ────────────────────────────────────────────────────────────

    @GET("websocket/games/{gameId}/chat")
    suspend fun getChatMessages(@Path("gameId") gameId: Int): Response<JsonObject>

    @POST("websocket/games/{gameId}/chat")
    suspend fun sendChatMessage(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    // ── Ping ────────────────────────────────────────────────────────────

    @POST("websocket/games/{gameId}/ping-opponent")
    suspend fun pingOpponent(
        @Path("gameId") gameId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>
}
