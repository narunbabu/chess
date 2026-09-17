package com.chess99.presentation.payment

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R

/**
 * Subscription management screen.
 * Shows current plan details, expiry, and cancellation.
 *
 * NOTE: intentionally has no purchase/upgrade call-to-action — Google Play
 * policy prohibits directing users to non-Play payment methods for digital
 * goods, and this app ships without in-app purchases (planned via Play
 * Billing in v1.1). Subscriptions bought on the web are reflected here.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionScreen(
    onNavigateBack: () -> Unit,
    viewModel: PaymentViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Snackbar
    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.subscription_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoadingSubscription && state.currentSubscription == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Current plan card
            item {
                CurrentPlanCard(subscription = state.currentSubscription)
            }

            // Inline, non-blocking notice when the plan check itself failed
            // (S3 T6) — never a dialog, degrades gracefully to Free tier.
            state.planCheckNotice?.let { notice ->
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        ),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.Info,
                                null,
                                modifier = Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = notice,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }

            // Subscription details (if active paid subscription)
            val sub = state.currentSubscription
            if (sub != null && sub.tier != "free") {
                item {
                    SubscriptionDetailsCard(subscription = sub)
                }

                // Cancel subscription section
                if (sub.isActive) {
                    item {
                        CancelSubscriptionCard(
                            isProcessing = state.isProcessing,
                            onCancel = { viewModel.showCancelDialog() },
                        )
                    }
                }
            }

            // Restore purchases
            item {
                RestorePurchasesCard(
                    isProcessing = state.isProcessing,
                    onRestore = { viewModel.restorePurchases() },
                )
            }

            // Availability notice for free users (no purchase CTA — see note above)
            if (sub == null || sub.tier == "free") {
                item {
                    PlansUnavailableCard()
                }
            }

            // Bottom spacing
            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }

        // Cancel confirmation dialog
        if (state.showCancelDialog) {
            AlertDialog(
                onDismissRequest = { viewModel.dismissCancelDialog() },
                icon = {
                    Icon(
                        Icons.Default.Warning,
                        null,
                        tint = MaterialTheme.colorScheme.error,
                    )
                },
                title = { Text(stringResource(R.string.subscription_cancel_title)) },
                text = {
                    Text(stringResource(R.string.subscription_cancel_body))
                },
                confirmButton = {
                    Button(
                        onClick = { viewModel.cancelSubscription() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                        ),
                        enabled = !state.isProcessing,
                    ) {
                        if (state.isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onError,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(stringResource(R.string.subscription_cancel_action))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.dismissCancelDialog() }) {
                        Text(stringResource(R.string.subscription_keep))
                    }
                },
            )
        }

        // Error dialog
        state.error?.let { error ->
            AlertDialog(
                onDismissRequest = { viewModel.clearError() },
                title = { Text(stringResource(R.string.error_title)) },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text(stringResource(R.string.action_ok)) }
                },
            )
        }
    }
}

// ── Current Plan Card ────────────────────────────────────────────────────

@Composable
private fun CurrentPlanCard(
    subscription: Subscription?,
) {
    val tier = subscription?.tier ?: "free"
    val planName = subscription?.planName ?: stringResource(R.string.subscription_tier_free)

    val tierColor = when (tier) {
        "gold" -> Color(0xFFFFB300)
        "standard" -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    val tierIcon = when (tier) {
        "gold" -> Icons.Default.WorkspacePremium
        "standard" -> Icons.Default.Star
        else -> Icons.Default.Person
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Tier icon
            Icon(
                tierIcon,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = tierColor,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Plan name
            Text(
                text = planName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )

            // Status badge
            val statusColor = when {
                subscription?.isActive == true -> Color(0xFF4CAF50)
                subscription?.isCancelled == true -> Color(0xFFFF9800)
                subscription?.isExpired == true -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }

            val statusText = stringResource(
                when {
                    subscription?.isActive == true -> R.string.subscription_status_active
                    subscription?.isCancelled == true -> R.string.subscription_status_cancelled
                    subscription?.isExpired == true -> R.string.subscription_status_expired
                    tier == "free" -> R.string.subscription_status_free_tier
                    else -> R.string.subscription_status_none
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            SuggestionChip(
                onClick = { },
                label = {
                    Text(
                        statusText,
                        fontWeight = FontWeight.SemiBold,
                    )
                },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    containerColor = statusColor.copy(alpha = 0.12f),
                    labelColor = statusColor,
                ),
            )
        }
    }
}

// ── Subscription Details Card ────────────────────────────────────────────

@Composable
private fun SubscriptionDetailsCard(subscription: Subscription) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.subscription_details),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Started at
            if (subscription.startedAt.isNotBlank()) {
                DetailRow(
                    icon = Icons.Default.CalendarToday,
                    label = stringResource(R.string.subscription_started),
                    value = formatDate(subscription.startedAt),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // Expires at
            if (subscription.expiresAt.isNotBlank()) {
                DetailRow(
                    icon = Icons.Default.Event,
                    label = stringResource(
                        if (subscription.isCancelled) R.string.subscription_access_until
                        else R.string.subscription_renews_on
                    ),
                    value = formatDate(subscription.expiresAt),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // Auto-renew
            DetailRow(
                icon = Icons.Default.Autorenew,
                label = stringResource(R.string.subscription_auto_renew),
                value = stringResource(
                    if (subscription.autoRenew) R.string.subscription_enabled
                    else R.string.subscription_disabled
                ),
                valueColor = if (subscription.autoRenew) Color(0xFF4CAF50) else Color(0xFFFF9800),
            )

            // Cancellation notice
            if (subscription.isCancelled) {
                Spacer(modifier = Modifier.height(12.dp))
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                    ),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Info,
                            null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            stringResource(R.string.subscription_cancelled_notice),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = valueColor,
        )
    }
}

// ── Cancel Subscription Card ─────────────────────────────────────────────

@Composable
private fun CancelSubscriptionCard(
    isProcessing: Boolean,
    onCancel: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.subscription_cancel_action),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                stringResource(R.string.subscription_cancel_card_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = onCancel,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isProcessing,
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Icon(
                    Icons.Default.Cancel,
                    null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.subscription_cancel_action))
            }
        }
    }
}

// ── Restore Purchases Card ───────────────────────────────────────────────

@Composable
private fun RestorePurchasesCard(
    isProcessing: Boolean,
    onRestore: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.subscription_restore),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                stringResource(R.string.subscription_restore_body),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = onRestore,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isProcessing,
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Icon(
                    Icons.Default.Restore,
                    null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.subscription_restore))
            }
        }
    }
}

// ── Plans Availability Notice ────────────────────────────────────────────

@Composable
private fun PlansUnavailableCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                Icons.Default.Info,
                null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = stringResource(R.string.subscription_plans_unavailable),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// ── Utility ──────────────────────────────────────────────────────────────

/**
 * Simple date formatting — extracts the date portion from an ISO-8601 string.
 * Returns a human-readable format like "2026-03-15".
 */
private fun formatDate(isoDate: String): String {
    return isoDate.take(10).ifBlank { isoDate }
}
