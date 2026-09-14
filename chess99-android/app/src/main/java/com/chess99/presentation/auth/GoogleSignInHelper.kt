package com.chess99.presentation.auth

import android.annotation.SuppressLint
import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.chess99.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
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
 * The server client ID is injected into BuildConfig from a Gradle property or
 * environment variable. Release builds fail configuration validation when it
 * is absent, while debug builds hide the Google button.
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
        val serverClientId = BuildConfig.GOOGLE_SERVER_CLIENT_ID
        if (!BuildConfig.GOOGLE_SIGN_IN_ENABLED || serverClientId.isBlank()) {
            val error = IllegalStateException("Google Sign-In is not configured")
            Timber.e(error, "Refusing to launch an unconfigured Google Sign-In flow")
            return GoogleSignInResult.Failure(error)
        }

        // GetSignInWithGoogleOption, not GetGoogleIdOption: this method is only
        // ever reached from an explicit "Sign in with Google" button. See the
        // class KDoc for why the One Tap option is the wrong tool here.
        // Lint 31.9.1 misses the GoogleIdTokenCredential handling below: both
        // Google token types are checked before GoogleIdTokenCredential.createFrom.
        @SuppressLint("CredentialManagerSignInWithGoogle")
        val signInWithGoogleOption = GetSignInWithGoogleOption.Builder(serverClientId).build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(signInWithGoogleOption)
            .build()

        return try {
            val result = credentialManager.getCredential(activityContext, request)
            val credential = result.credential

            // Credential Manager can hand back other credential types (a saved
            // password, a passkey) depending on what the device offers. Only a
            // Google ID token credential can be exchanged with our backend, so
            // check before parsing rather than letting createFrom() throw.
            // The Sign-in-with-Google flow reports its own subtype, so accept both.
            if (credential !is CustomCredential ||
                (
                    credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL &&
                        credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL
                    )
            ) {
                val error = IllegalStateException("Unexpected credential type: ${credential.type}")
                Timber.e(error, "Google Sign-In returned a non-Google credential")
                return GoogleSignInResult.Failure(error)
            }

            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
            val idToken = googleIdTokenCredential.idToken
            val email = googleIdTokenCredential.id
            val displayName = googleIdTokenCredential.displayName ?: ""

            // SECURITY (L4): do not log the user's email/name (PII).
            Timber.d("Google Sign-In success")

            GoogleSignInResult.Success(
                idToken = idToken,
                email = email,
                name = displayName,
            )
        } catch (e: GetCredentialCancellationException) {
            Timber.d("Google Sign-In cancelled by user")
            GoogleSignInResult.Cancelled
        } catch (e: NoCredentialException) {
            // Play Services had nothing to offer and showed no picker. Two very
            // different causes reach here and the exception alone cannot tell
            // them apart:
            //   1. the device genuinely has no Google account, or
            //   2. this build's package + signing SHA-1 is not registered as an
            //      Android OAuth client in the Cloud project that owns the
            //      server client ID, so Play Services declines outright.
            // (2) is the more common cause on a side-loaded build, so log enough
            // to distinguish them rather than asserting (1) to the user.
            Timber.w(
                e,
                "Google Sign-In: no credential returned (type=%s). Either no Google " +
                    "account on the device, or package %s / this build's signing SHA-1 " +
                    "is not registered as an Android OAuth client in the project owning " +
                    "the server client ID.",
                e.type,
                context.packageName,
            )
            GoogleSignInResult.NoCredential
        } catch (e: GetCredentialException) {
            Timber.e(e, "Google Sign-In credential error: type=%s msg=%s", e.type, e.errorMessage)
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

    /**
     * The device has no Google account available to sign in with. Distinct
     * from [Failure]: nothing went wrong, there is simply nothing to pick.
     */
    data object NoCredential : GoogleSignInResult()
}
