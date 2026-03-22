package com.chess99.presentation.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.chess99.BuildConfig
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Google Sign-In integration using the modern Credential Manager API.
 *
 * Flow:
 *   1. Build a [GetGoogleIdOption] with the server client ID
 *   2. Call [CredentialManager.getCredential] (suspending, shows account picker)
 *   3. Extract [GoogleIdTokenCredential] from the result
 *   4. Return the ID token to be sent to the backend via AuthApi.googleMobileLogin
 *
 * Dependencies (already in build.gradle):
 *   - google.identity       (com.google.android.libraries.identity.googleid)
 *   - credentials           (androidx.credentials:credentials)
 *   - credentials.play.services (androidx.credentials:credentials-play-services-auth)
 *
 * The server client ID is expected as a BuildConfig field: GOOGLE_SERVER_CLIENT_ID.
 * If not set, falls back to an empty string and logs a warning.
 */
@Singleton
class GoogleSignInHelper @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val credentialManager = CredentialManager.create(context)

    /**
     * Initiate Google Sign-In and return the result.
     *
     * @param activityContext Must be an Activity context (not Application) because
     *   the Credential Manager needs it to present the account chooser UI.
     * @return [GoogleSignInResult] indicating success, failure, or cancellation.
     */
    suspend fun signIn(activityContext: Context): GoogleSignInResult {
        val serverClientId = try {
            @Suppress("UNNECESSARY_SAFE_CALL")
            BuildConfig::class.java.getField("GOOGLE_SERVER_CLIENT_ID")
                ?.get(null) as? String ?: ""
        } catch (_: NoSuchFieldException) {
            Timber.w("GOOGLE_SERVER_CLIENT_ID not found in BuildConfig; Google Sign-In may fail")
            ""
        }

        if (serverClientId.isBlank()) {
            Timber.w("Google server client ID is empty — sign-in will likely fail")
        }

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(serverClientId)
            .setAutoSelectEnabled(true)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        return try {
            val result = credentialManager.getCredential(activityContext, request)
            val credential = result.credential

            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
            val idToken = googleIdTokenCredential.idToken
            val email = googleIdTokenCredential.id
            val displayName = googleIdTokenCredential.displayName ?: ""

            Timber.d("Google Sign-In success: email=$email, name=$displayName")

            GoogleSignInResult.Success(
                idToken = idToken,
                email = email,
                name = displayName,
            )
        } catch (e: GetCredentialCancellationException) {
            Timber.d("Google Sign-In cancelled by user")
            GoogleSignInResult.Cancelled
        } catch (e: GetCredentialException) {
            Timber.e(e, "Google Sign-In credential error: ${e.type}")
            GoogleSignInResult.Failure(e)
        } catch (e: Exception) {
            Timber.e(e, "Google Sign-In unexpected error")
            GoogleSignInResult.Failure(e)
        }
    }
}

/**
 * Result of a Google Sign-In attempt.
 */
sealed class GoogleSignInResult {
    /**
     * Sign-in succeeded. Contains the Google ID token (JWT) to send
     * to the backend, plus the user's email and display name.
     */
    data class Success(
        val idToken: String,
        val email: String,
        val name: String,
    ) : GoogleSignInResult()

    /**
     * Sign-in failed with an exception.
     */
    data class Failure(
        val exception: Exception,
    ) : GoogleSignInResult()

    /**
     * User cancelled the sign-in flow.
     */
    data object Cancelled : GoogleSignInResult()
}
