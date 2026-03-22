package com.chess99.presentation.payment

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Pricing / Plans screen showing subscription tiers.
 * Mirrors chess-frontend Pricing component.
 *
 * Shows Free, Pro (Standard), and Premium (Gold) tiers
 * loaded from the backend. Includes FAQ section.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PricingScreen(
    onNavigateBack: () -> Unit,
    onNavigateToSubscription: () -> Unit,
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
                title = { Text("Choose Your Plan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    // Link to subscription management if user has one
                    if (state.currentSubscription != null) {
                        TextButton(onClick = onNavigateToSubscription) {
                            Text("My Plan")
                        }
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoadingPlans) {
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
            // Header
            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "Upgrade Your Chess Experience",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Unlock premium features, themes, and more",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            // Mock mode banner
            if (state.isMockMode) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
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
                                tint = MaterialTheme.colorScheme.onTertiaryContainer,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Test mode: payments are simulated",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onTertiaryContainer,
                            )
                        }
                    }
                }
            }

            // Plan cards
            items(state.plans, key = { it.id }) { plan ->
                PlanCard(
                    plan = plan,
                    isCurrentPlan = state.currentSubscription?.tier == plan.tier,
                    isSelected = state.selectedPlan?.id == plan.id,
                    isProcessing = state.isProcessingPayment,
                    onSelect = { viewModel.selectPlan(plan) },
                    onSubscribe = {
                        if (plan.isFree) {
                            // Already on free or downgrade — navigate to manage
                            onNavigateToSubscription()
                        } else {
                            viewModel.selectPlan(plan)
                            viewModel.createOrder(plan.id)
                        }
                    },
                )
            }

            // FAQ Section
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Frequently Asked Questions",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }

            item {
                FaqSection()
            }

            // Bottom spacing
            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
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

// ── Plan Card ────────────────────────────────────────────────────────────

@Composable
private fun PlanCard(
    plan: SubscriptionPlan,
    isCurrentPlan: Boolean,
    isSelected: Boolean,
    isProcessing: Boolean,
    onSelect: () -> Unit,
    onSubscribe: () -> Unit,
) {
    val borderColor = when {
        isCurrentPlan -> MaterialTheme.colorScheme.primary
        plan.isPopular -> MaterialTheme.colorScheme.secondary
        isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        else -> MaterialTheme.colorScheme.outlineVariant
    }

    val borderWidth = if (isCurrentPlan || plan.isPopular) 2.dp else 1.dp

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !isProcessing) { onSelect() },
        border = BorderStroke(borderWidth, borderColor),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (plan.isPopular) 4.dp else 1.dp,
        ),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Header row: name + badges
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = plan.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = plan.tier.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (plan.isPopular) {
                        SuggestionChip(
                            onClick = { },
                            label = {
                                Text(
                                    "Popular",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                )
                            },
                            icon = {
                                Icon(
                                    Icons.Default.Star,
                                    null,
                                    modifier = Modifier.size(14.dp),
                                )
                            },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                labelColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            ),
                        )
                    }
                    if (isCurrentPlan) {
                        SuggestionChip(
                            onClick = { },
                            label = {
                                Text(
                                    "Current",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                )
                            },
                            icon = {
                                Icon(
                                    Icons.Default.Check,
                                    null,
                                    modifier = Modifier.size(14.dp),
                                )
                            },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                labelColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            ),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Price
            Row(
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    text = plan.formattedPrice,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!plan.isFree) {
                    Text(
                        text = " / ${plan.duration}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Features list
            plan.features.forEach { feature ->
                Row(
                    modifier = Modifier.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        null,
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = feature,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Subscribe / current plan button
            if (isCurrentPlan) {
                OutlinedButton(
                    onClick = { },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = false,
                ) {
                    Icon(
                        Icons.Default.Check,
                        null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Current Plan")
                }
            } else {
                Button(
                    onClick = onSubscribe,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                    colors = if (plan.isPopular) {
                        ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary,
                        )
                    } else {
                        ButtonDefaults.buttonColors()
                    },
                ) {
                    if (isProcessing && isSelected) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        text = if (plan.isFree) "Downgrade" else "Subscribe",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

// ── FAQ Section ──────────────────────────────────────────────────────────

@Composable
private fun FaqSection() {
    val faqItems = remember {
        listOf(
            FaqItem(
                question = "What payment methods are accepted?",
                answer = "We accept all major credit/debit cards, UPI, net banking, and popular wallets through Razorpay.",
            ),
            FaqItem(
                question = "Can I cancel my subscription?",
                answer = "Yes, you can cancel anytime from the subscription management screen. Your benefits continue until the end of the billing period.",
            ),
            FaqItem(
                question = "What happens when my subscription expires?",
                answer = "Your account reverts to the Free tier. You keep your games, ratings, and history, but premium features like exclusive themes and advanced analysis become unavailable.",
            ),
            FaqItem(
                question = "Can I upgrade or downgrade my plan?",
                answer = "Yes! You can change plans at any time. When upgrading, you get immediate access. When downgrading, the change takes effect at the end of your current billing cycle.",
            ),
            FaqItem(
                question = "Is there a refund policy?",
                answer = "We offer refunds within 7 days of purchase if you are not satisfied. Contact support@chess99.com for assistance.",
            ),
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        faqItems.forEach { item ->
            ExpandableFaqCard(item = item)
        }
    }
}

@Composable
private fun ExpandableFaqCard(item: FaqItem) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.question,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess
                    else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                    modifier = Modifier.size(24.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Text(
                    text = item.answer,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }
}

private data class FaqItem(
    val question: String,
    val answer: String,
)
