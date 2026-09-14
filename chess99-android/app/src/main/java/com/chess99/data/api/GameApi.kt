package com.chess99.data.api

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface GameApi {
    @POST("games/computer")
    suspend fun createComputerGame(@Body body: JsonObject): Response<JsonObject>

    @POST("games")
    suspend fun createGame(@Body body: JsonObject): Response<JsonObject>

    @GET("games/active")
    suspend fun getActiveGames(): Response<JsonObject>

    @GET("games/daily-quota")
    suspend fun getDailyQuota(): Response<JsonObject>

    // GameController::unfinishedGames answers with a bare JSON array, which a
    // Response<JsonObject> converter rejects before any parsing runs.
    @GET("games/unfinished")
    suspend fun getUnfinishedGames(): Response<JsonElement>

    @POST("games/create-from-unfinished")
    suspend fun createFromUnfinished(@Body body: JsonObject): Response<JsonObject>

    @GET("games/{id}")
    suspend fun getGame(@Path("id") id: Int): Response<JsonObject>

    @GET("games/public/{id}")
    suspend fun getPublicGame(@Path("id") id: Int): Response<JsonObject>

    @GET("games/{id}/moves")
    suspend fun getGameMoves(@Path("id") id: Int): Response<JsonObject>

    // SECURITY: REST POST games/{id}/move removed 2026-06-12 (unvalidated server-side).
    // Multiplayer moves go through WebSocketApi.sendMove (validated path).

    @POST("games/{id}/resign")
    suspend fun resign(@Path("id") id: Int): Response<JsonObject>

    // Mark a game finished server-side. For rated synthetic (bot) games this is
    // the ONLY path that applies Elo — the WebSocket move/finalize flow skips
    // Elo for synthetic games (GameRoomService::applyRatedGameElo returns early
    // when computer_player_id/synthetic_player_id is set; synthetic Elo lives in
    // GameController::completeGame -> applyRatedSyntheticElo). Rated
    // human-vs-human games apply Elo automatically server-side, so we do not
    // need this call for them.
    @POST("games/{id}/complete")
    suspend fun completeGame(@Path("id") id: Int, @Body body: JsonObject): Response<JsonObject>

    @POST("games/{id}/pause-navigation")
    suspend fun pauseNavigation(@Path("id") id: Int): Response<JsonObject>

    @DELETE("games/{id}/unfinished")
    suspend fun deleteUnfinished(@Path("id") id: Int): Response<JsonObject>

    @GET("games")
    suspend fun getUserGames(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
    ): Response<JsonObject>

    @POST("games/{id}/mode")
    suspend fun setGameMode(@Path("id") id: Int, @Body body: JsonObject): Response<JsonObject>

    @GET("games/{id}/mode")
    suspend fun getGameMode(@Path("id") id: Int): Response<JsonObject>

    @GET("games/{id}/rating-change")
    suspend fun getRatingChange(@Path("id") id: Int): Response<JsonObject>

    // Draw offers
    @POST("games/{id}/draw/offer")
    suspend fun offerDraw(@Path("id") id: Int): Response<JsonObject>

    @POST("games/{id}/draw/accept")
    suspend fun acceptDraw(@Path("id") id: Int): Response<JsonObject>

    @POST("games/{id}/draw/decline")
    suspend fun declineDraw(@Path("id") id: Int): Response<JsonObject>

    @POST("games/{id}/draw/cancel")
    suspend fun cancelDraw(@Path("id") id: Int): Response<JsonObject>

    @GET("games/{id}/draw/status")
    suspend fun getDrawStatus(@Path("id") id: Int): Response<JsonObject>

    // Game analysis (Stockfish full-game analysis)
    @POST("games/{id}/analyze")
    suspend fun analyzeGame(@Path("id") id: Int): Response<JsonObject>

    @GET("games/{id}/analysis")
    suspend fun getGameAnalysis(@Path("id") id: Int): Response<JsonObject>

    // PGN export
    @GET("games/{id}/pgn")
    suspend fun getPgn(@Path("id") id: Int): Response<ResponseBody>

    // Undo (via WebSocket API prefix)
    @POST("websocket/games/{id}/undo/request")
    suspend fun requestUndo(@Path("id") id: Int): Response<JsonObject>

    @POST("websocket/games/{id}/undo/accept")
    suspend fun acceptUndo(@Path("id") id: Int): Response<JsonObject>

    @POST("websocket/games/{id}/undo/decline")
    suspend fun declineUndo(@Path("id") id: Int): Response<JsonObject>
}
