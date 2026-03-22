package com.chess99.presentation.payment

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import com.razorpay.Checkout
import org.json.JSONObject
import timber.log.Timber

/**
 * Razorpay checkout integration for Chess99 Android.
 *
 * Uses the standard Razorpay Android SDK Activity-based pattern:
 *   1. ViewModel calls createOrder → receives RazorpayOrderData
 *   2. PricingScreen / parent composable renders RazorpayCheckoutLauncher
 *   3. This composable launches the Razorpay checkout form
 *   4. On success/failure, callbacks notify the ViewModel
 *
 * Note: The hosting Activity must implement
 * `com.razorpay.PaymentResultListener` (or `PaymentResultWithDataListener`)
 * for the SDK callback to work. This utility handles creating the
 * Checkout options and opening the form.
 *
 * Razorpay SDK dependency: `com.razorpay:checkout:1.6.+`
 */

/**
 * Composable that auto-launches Razorpay checkout when [orderData] is non-null.
 * Should be placed in the composition tree of a screen that has access to the
 * current Activity context.
 *
 * @param orderData  The order details from the backend's create-order response.
 * @param prefillName  User's name to prefill in checkout form.
 * @param prefillEmail  User's email to prefill in checkout form.
 * @param onSuccess  Called with (paymentId, orderId, signature) on successful payment.
 * @param onFailure  Called with error description on failure/cancellation.
 * @param onDismissed  Called when order data is consumed (to clear pending state).
 */
@Composable
fun RazorpayCheckoutLauncher(
    orderData: RazorpayOrderData?,
    prefillName: String = "",
    prefillEmail: String = "",
    onSuccess: (paymentId: String, orderId: String, signature: String) -> Unit,
    onFailure: (errorMessage: String) -> Unit,
    onDismissed: () -> Unit,
) {
    val context = LocalContext.current

    LaunchedEffect(orderData) {
        if (orderData == null) return@LaunchedEffect

        val activity = context as? Activity
        if (activity == null) {
            onFailure("Could not get Activity context")
            onDismissed()
            return@LaunchedEffect
        }

        try {
            launchRazorpayCheckout(
                activity = activity,
                orderData = orderData,
                prefillName = prefillName,
                prefillEmail = prefillEmail,
                onSuccess = onSuccess,
                onFailure = onFailure,
            )
        } catch (e: Exception) {
            Timber.e(e, "Razorpay checkout launch failed")
            onFailure("Checkout launch failed: ${e.message}")
        }

        // Clear the pending order so the launcher doesn't re-fire on recomposition
        onDismissed()
    }
}

/**
 * Launches the Razorpay checkout form using the Android SDK.
 *
 * The [Activity] **must** implement one of:
 * - `com.razorpay.PaymentResultListener`
 * - `com.razorpay.PaymentResultWithDataListener`
 *
 * When using PaymentResultWithDataListener, the SDK provides
 * `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`
 * directly in `onPaymentSuccess(data)`.
 *
 * **Important**: The Razorpay key is provided by the backend in the
 * create-order response. Do not hard-code it.
 *
 * @param activity   The current Activity (must implement Razorpay listener).
 * @param orderData  Order details from backend create-order.
 * @param prefillName  Name to prefill.
 * @param prefillEmail  Email to prefill.
 * @param onSuccess  Success callback (paymentId, orderId, signature).
 * @param onFailure  Failure callback (error description).
 */
fun launchRazorpayCheckout(
    activity: Activity,
    orderData: RazorpayOrderData,
    prefillName: String = "",
    prefillEmail: String = "",
    onSuccess: (String, String, String) -> Unit,
    onFailure: (String) -> Unit,
) {
    try {
        val checkout = Checkout()

        // Set the Razorpay key from the backend response
        checkout.setKeyID(orderData.razorpayKey)

        // Build checkout options JSON
        val options = JSONObject().apply {
            put("name", "Chess99")
            put("description", orderData.description)
            put("order_id", orderData.orderId)
            // Razorpay expects amount in smallest currency unit (paise for INR)
            put("amount", orderData.amount)
            put("currency", orderData.currency)

            // Prefill
            put("prefill", JSONObject().apply {
                if (prefillName.isNotBlank()) put("name", prefillName)
                if (prefillEmail.isNotBlank()) put("email", prefillEmail)
            })

            // Theme
            put("theme", JSONObject().apply {
                put("color", "#1B5E20") // Chess99 brand green
            })

            // Retry
            put("retry", JSONObject().apply {
                put("enabled", true)
                put("max_count", 3)
            })

            // Notes for server-side reference
            put("notes", JSONObject().apply {
                put("plan_id", orderData.planId)
                put("source", "android_app")
            })
        }

        Timber.d("Opening Razorpay checkout for order: ${orderData.orderId}")
        checkout.open(activity, options)

    } catch (e: Exception) {
        Timber.e(e, "Razorpay checkout error")
        onFailure("Payment initialization failed: ${e.message}")
    }
}

/**
 * Data class representing the information needed by the Razorpay checkout UI.
 * This is also defined in PaymentViewModel.kt — using that definition.
 * Kept here for documentation reference.
 *
 * @see RazorpayOrderData in PaymentViewModel.kt
 */
