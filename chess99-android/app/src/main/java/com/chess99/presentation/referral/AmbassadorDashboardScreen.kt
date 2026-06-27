package com.chess99.presentation.referral

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Ambassador toolkit — mirrors the web /ambassador page. Reuses ReferralViewModel
 * for the referral link + earnings, and adds the audience-specific share templates
 * (parents, students, friends, coaches, Telugu) that ambassadors use to recruit.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AmbassadorDashboardScreen(
    onNavigateBack: () -> Unit,
    onNavigateToApply: () -> Unit = {},
    viewModel: ReferralViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val link = state.referralLink ?: "https://chess99.com"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ambassador", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Enrollment banner ───────────────────────────────────────────
            val status = state.ambassadorStatus
            when {
                status == null || status.equals("rejected", ignoreCase = true) -> {
                    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Become an Ambassador", fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Earn commission for every player you bring to Chess99. " +
                                    "Apply to join the ambassador program.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = onNavigateToApply, modifier = Modifier.fillMaxWidth()) {
                                Text("Apply Now")
                            }
                        }
                    }
                }
                status.equals("pending", ignoreCase = true) -> {
                    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Application under review", fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Your ambassador application is being reviewed. " +
                                    "You can already share your referral link below.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }

            // ── Stats ───────────────────────────────────────────────────────
            state.stats?.let { s ->
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        StatCell("Referred", s.totalReferrals.toString())
                        StatCell("Active", s.activeReferrals.toString())
                        StatCell("Earned", s.formattedEarnings)
                    }
                }
            }

            // ── Referral link ───────────────────────────────────────────────
            ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Your referral link", fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(link, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { copyText(context, "Referral link", link) }) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Copy")
                        }
                        Button(onClick = { shareText(context, link) }) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Share")
                        }
                    }
                }
            }

            // ── Share templates ─────────────────────────────────────────────
            Text("Share templates", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            shareTemplates(link).forEach { tpl ->
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(tpl.audience, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(6.dp))
                        Text(tpl.message, style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { copyText(context, tpl.audience, tpl.message) }) {
                                Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Copy")
                            }
                            Button(onClick = { shareText(context, tpl.message) }) {
                                Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Share")
                            }
                        }
                    }
                }
            }

            // ── Payout history (from referral data) ─────────────────────────
            if (state.payouts.isNotEmpty()) {
                Text("Payout history", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                state.payouts.forEach { p ->
                    ListItem(
                        headlineContent = { Text(p.formattedAmount) },
                        supportingContent = { Text("${p.method} • ${p.date}") },
                        trailingContent = { Text(p.status) },
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatCell(label: String, value: String) {
    Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private data class ShareTemplate(val audience: String, val message: String)

private fun shareTemplates(link: String): List<ShareTemplate> = listOf(
    ShareTemplate(
        "For Parents",
        "I found a great way for kids to learn chess online — Chess99 has guided lessons, " +
            "tactics training and safe online play. Join here: $link",
    ),
    ShareTemplate(
        "For Students",
        "Level up your chess! Chess99 has puzzles, lessons and rated games against real players. " +
            "Sign up with my link: $link",
    ),
    ShareTemplate(
        "For Friends",
        "Let's play chess on Chess99 — quick games, ratings and tournaments. Join me: $link",
    ),
    ShareTemplate(
        "For Coaches",
        "Chess99 is a solid platform for coaching — lessons, tactical trainer, tournaments and student " +
            "progress tracking. Take a look: $link",
    ),
    ShareTemplate(
        "Telugu",
        "చెస్ నేర్చుకోవాలనుకుంటున్నారా? Chess99 లో పాఠాలు, పజిల్స్, ఆన్‌లైన్ ఆటలు ఉన్నాయి. " +
            "ఇక్కడ చేరండి: $link",
    ),
)

private fun copyText(context: Context, label: String, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText(label, text))
}

private fun shareText(context: Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, "Share via"))
}
