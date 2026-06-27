package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Organization management REST API endpoints.
 * Mirrors chess-backend OrganizationController (routes/api_v1.php organizations routes).
 *
 * All endpoints require authentication (Sanctum). The backend enforces
 * organization-admin permissions on create/invite; the app surfaces server errors.
 */
interface OrganizationApi {

    /** List / search organizations. Returns { data: [{ id, name, type, users_count, ... }] }. */
    @GET("organizations")
    suspend fun list(
        @Query("search") search: String? = null,
        @Query("type") type: String? = null,
    ): Response<JsonObject>

    /**
     * Create an organization.
     * Body: { name, type, contact_email, description?, website?, slug? }.
     */
    @POST("organizations")
    suspend fun create(@Body body: JsonObject): Response<JsonObject>

    /** List members of an organization with their roles. */
    @GET("organizations/{id}/members")
    suspend fun members(@Path("id") id: Int): Response<JsonObject>

    /** Invite a member by email. Body: { email, role? (member|organization_admin) }. */
    @POST("organizations/{id}/invitations")
    suspend fun invite(@Path("id") id: Int, @Body body: JsonObject): Response<JsonObject>

    /** Accept an organization invitation. */
    @POST("organizations/invitations/{invitationId}/accept")
    suspend fun acceptInvitation(@Path("invitationId") invitationId: Int): Response<JsonObject>

    /** Reject an organization invitation. */
    @POST("organizations/invitations/{invitationId}/reject")
    suspend fun rejectInvitation(@Path("invitationId") invitationId: Int): Response<JsonObject>
}
