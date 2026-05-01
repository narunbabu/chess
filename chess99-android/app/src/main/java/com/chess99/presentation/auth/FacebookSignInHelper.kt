package com.chess99.presentation.auth

import android.app.Activity
import android.content.Intent
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.FacebookSdk
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import kotlinx.coroutines.suspendCancellableCoroutine
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Facebook Sign-In integration using the Facebook Login SDK.
 *
 * Flow:
 *   1. Call [signIn] with an Activity context
 *   2. Facebook SDK presents the login dialog (Custom Tab or Facebook app)
 *   3. On success, the access token is returned to the caller
 *   4. The access token is sent to the backend via [com.chess99.data.api.AuthApi.facebookMobileLogin]
 *
 * The [callbackManager] must receive onActivityResult from the hosting Activity.
 */
@Singleton
class FacebookSignInHelper @Inject constructor() {

    val callbackManager: CallbackManager = CallbackManager.Factory.create()

    /**
     * Initiate Facebook Sign-In and return the result.
     *
     * @param activity Must be an Activity for Facebook SDK to present the login UI.
     * @return [FacebookSignInResult] indicating success, failure, or cancellation.
     */
    suspend fun signIn(activity: Activity): FacebookSignInResult {
        return suspendCancellableCoroutine { continuation ->
            LoginManager.getInstance().registerCallback(
                callbackManager,
                object : FacebookCallback<LoginResult> {
                    override fun onSuccess(result: LoginResult) {
                        val token = result.accessToken.token
                        val userId = result.accessToken.userId
                        Timber.d("Facebook Sign-In success: userId=$userId")
                        continuation.resume(FacebookSignInResult.Success(token, userId))
                    }

                    override fun onCancel() {
                        Timber.d("Facebook Sign-In cancelled by user")
                        continuation.resume(FacebookSignInResult.Cancelled)
                    }

                    override fun onError(error: FacebookException) {
                        Timber.e(error, "Facebook Sign-In error")
                        continuation.resume(FacebookSignInResult.Failure(error))
                    }
                },
            )

            LoginManager.getInstance().logInWithReadPermissions(
                activity,
                listOf("email", "public_profile"),
            )
        }
    }

    /**
     * Forward activity results to the Facebook CallbackManager.
     * Must be called from the hosting Activity's onActivityResult.
     */
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        return callbackManager.onActivityResult(requestCode, resultCode, data)
    }
}

sealed class FacebookSignInResult {
    data class Success(
        val accessToken: String,
        val userId: String,
    ) : FacebookSignInResult()

    data class Failure(
        val exception: Exception,
    ) : FacebookSignInResult()

    data object Cancelled : FacebookSignInResult()
}
