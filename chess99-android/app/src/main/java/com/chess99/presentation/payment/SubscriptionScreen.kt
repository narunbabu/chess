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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Subscription management screen.
 * Shows current plan details, expiry, cancellation,
 * and a link to upgrade / view pricing.
 *
 * Mirrors chess-frontend Subscription management component.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPricing: () -> Unit,
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
                title = { Text("My Subscription") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
                CurrentPlanCard(
                    subscription = state.currentSubscription,
                    onUpgrade = onNavigateToPricing,
                )
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
                            isProcessing = state.isProcessingPayment,
                            onCancel = { viewModel.showCancelDialog() },
                        )
                    }
                }
            }

            // Restore purchases
            item {
                RestorePurchasesCard(
                    isProcessing = state.isProcessingPayment,
                    onRestore = { viewModel.restorePurchases() },
                )
            }

            // Upgrade prompt for free users
            if (sub == null || sub.tier == "free") {
                item {
                    UpgradePromptCard(onUpgrade = onNavigateToPricing)
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
                title = { Text("Cancel Subscription?") },
                text = {
                    Text(
                        "Are you sure you want to cancel your subscription? " +
                            "You will continue to have access until the end of your " +
                            "current billing period. After that, your account will " +
                            "revert to the Free tier.",
                    )
                },
                confirmButton = {
                    Button(
                        onClick = { viewModel.cancelSubscription() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                        ),
                        enabled = !state.isProcessingPayment,
                    ) {
                        if (state.isProcessingPayment) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onError,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Cancel Subscription")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.dismissCancelDialog() }) {
                        Text("Keep Subscription")
                    }
                },
            )
        }

        // Error dialog
        state.error?.let { error ->
            AlertDialog(
                onDismissRequest = { viewModel.clearError() },
                title = { Text("Error") },
                text = { Text(error) },
                confirmButton = {
                    TextButton(onClick = { viewModel.clearError() }) { Text("OK") }
                },
            )
        }
    }
}

// ── Current Plan Card ────────────────────────────────────────────────────

@Composable
private fun CurrentPlanCard(
    subscription: Subscription?,
    onUpgrade: () -> Unit,
) {
    val tier = subscription?.tier ?: "free"
    val planName = subscription?.planName ?: "Free"

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

            val statusText = when {
                subscription?.isActive == true -> "Active"
                subscription?.isCancelled == true -> "Cancelled"
                subscription?.isExpired == true -> "Expired"
                tier == "free" -> "Free Tier"
                else -> "No Subscription"
            }

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

            // Upgrade button for free / expired users
            if (tier == "free" || subscription?.isExpired == true) {
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onUpgrade,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(
                        Icons.Default.Upgrade,
                        null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Upgrade Now", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ── Subscription Details Card ────────────────────────────────────────────

@Composable
private fun SubscriptionDetailsCard(subscription: Subscription) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Subscription Details",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Started at
            if (subscription.startedAt.isNotBlank()) {
                DetailRow(
                    icon = Icons.Default.CalendarToday,
                    label = "Started",
                    value = formatDate(subscription.startedAt),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // Expires at
            if (subscription.expiresAt.isNotBlank()) {
                DetailRow(
                    icon = Icons.Default.Event,
                    label = if (subscription.isCancelled) "Access Until" else "Renews On",
                    value = formatDate(subscription.expiresAt),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }

            // Auto-renew
            DetailRow(
                icon = Icons.Default.Autorenew,
                label = "Auto-Renew",
                value = if (subscription.autoRenew) "Enabled" else "Disabled",
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
                            "Your subscription has been cancelled. Access continues until the end of the billing period.",
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
                "Cancel Subscription",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "If you cancel, your premium features will remain available until " +
                    "the end of your current billing period.",
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
                Text("Cancel Subscription")
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
                "Restore Purchases",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "If you have previously purchased a subscription on another device, " +
                    "tap below to restore it.",
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
                Text("Restore Purchases")
            }
        }
    }
}

// ── Upgrade Prompt Card ──────────────────────────────────────────────────

@Composable
private fun UpgradePromptCard(onUpgrade: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                Icons.Default.Rocket,
                null,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Unlock Premium Features",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Get access to exclusive board themes, advanced analysis, " +
                    "and priority matchmaking.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onUpgrade) {
                Text("View Plans", fontWeight = FontWeight.SemiBold)
            }
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
