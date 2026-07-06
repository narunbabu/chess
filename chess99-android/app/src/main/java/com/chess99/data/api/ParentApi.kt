package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Parent dashboard / "My Kids" report-card REST API endpoints.
 * Lets a guardian link a child account, view weekly report cards, email them,
 * and manage the child's display name / password.
 *
 * Backend routes: chess-backend/routes/api_v1.php (prefix: parent/)
 *   GET    parent/children                                 -> ParentDashboardController@index
 *   POST   parent/children/invitations                     -> ParentDashboardController@requestLink
 *   POST   parent/children/{relationship}/accept           -> ParentDashboardController@accept
 *   DELETE parent/children/{relationship}                  -> ParentDashboardController@revoke
 *   GET    parent/children/{relationship}                  -> ParentDashboardController@show
 *   POST   parent/children/{relationship}/weekly-report    -> ParentDashboardController@sendWeeklyReport
 *   PATCH  parent/children/{relationship}/profile          -> ParentDashboardController@updateChildProfile
 *
 * Mirrors chess-frontend/src/services/parentDashboardService.js
 */
interface ParentApi {

    /** Full dashboard: active children (with report cards), pending children, and guardian requests. */
    @GET("parent/children")
    suspend fun getDashboard(): Response<JsonObject>

    /** Invite/link a child by email. Body: { child_email, relationship_label? }. */
    @POST("parent/children/invitations")
    suspend fun requestLink(@Body body: JsonObject): Response<JsonObject>

    /** Accept a pending guardian link (called by the child account). */
    @POST("parent/children/{relationship}/accept")
    suspend fun acceptLink(@Path("relationship") relationshipId: Int): Response<JsonObject>

    /** Revoke/cancel a link (guardian or child). */
    @DELETE("parent/children/{relationship}")
    suspend fun revokeLink(@Path("relationship") relationshipId: Int): Response<JsonObject>

    /** Detailed weekly report card for a single linked child. */
    @GET("parent/children/{relationship}")
    suspend fun getChildReport(@Path("relationship") relationshipId: Int): Response<JsonObject>

    /** Queue an on-demand weekly report email for a linked child. */
    @POST("parent/children/{relationship}/weekly-report")
    suspend fun sendWeeklyReport(@Path("relationship") relationshipId: Int): Response<JsonObject>

    /** Update a linked child's display name and/or password. Body: { name?, password?, password_confirmation? }. */
    @PATCH("parent/children/{relationship}/profile")
    suspend fun updateChildProfile(
        @Path("relationship") relationshipId: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>
}
