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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R

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
                title = { Text(stringResource(R.string.ambassador_title), fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        if (state.isAdultOnly) {
            AdultOnlyNotice(modifier = Modifier.fillMaxSize().padding(padding))
            return@Scaffold
        }
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
                            Text(
                                stringResource(R.string.ambassador_become_title),
                                fontWeight = FontWeight.Bold,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                stringResource(R.string.ambassador_become_body),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = onNavigateToApply, modifier = Modifier.fillMaxWidth()) {
                                Text(stringResource(R.string.ambassador_apply_now))
                            }
                        }
                    }
                }
                status.equals("pending", ignoreCase = true) -> {
                    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                stringResource(R.string.ambassador_pending_title),
                                fontWeight = FontWeight.Bold,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                stringResource(R.string.ambassador_pending_body),
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
                        StatCell(stringResource(R.string.ambassador_stat_referred), s.totalReferrals.toString())
                        StatCell(stringResource(R.string.ambassador_stat_active), s.activeReferrals.toString())
                        StatCell(stringResource(R.string.ambassador_stat_earned), s.formattedEarnings)
                    }
                }
            }

            // ── Referral link ───────────────────────────────────────────────
            ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(stringResource(R.string.referral_your_link), fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(link, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val referralClipLabel = stringResource(R.string.referral_link_clip_label)
                        OutlinedButton(onClick = { copyText(context, referralClipLabel, link) }) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.action_copy))
                        }
                        Button(onClick = { shareText(context, link) }) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.action_share))
                        }
                    }
                }
            }

            // ── Share templates ─────────────────────────────────────────────
            Text(
                stringResource(R.string.ambassador_share_templates),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
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
                                Text(stringResource(R.string.action_copy))
                            }
                            Button(onClick = { shareText(context, tpl.message) }) {
                                Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(stringResource(R.string.action_share))
                            }
                        }
                    }
                }
            }

            // ── Payout history (from referral data) ─────────────────────────
            if (state.payouts.isNotEmpty()) {
                Text(
                    stringResource(R.string.ambassador_payout_history),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                state.payouts.forEach { p ->
                    ListItem(
                        headlineContent = { Text(p.formattedAmount) },
                        supportingContent = {
                            Text(stringResource(R.string.ambassador_payout_detail, p.method, p.date))
                        },
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

/**
 * Friendly full-screen notice shown in place of the Ambassador dashboard/apply
 * form when the backend's EnsureAdult gate (S15) rejects an ambassador-only
 * call with 403 `adult_only`. Shared by [AmbassadorDashboardScreen] and
 * [BecomeAmbassadorScreen] since both sit on the same 403 path.
 */
@Composable
internal fun AdultOnlyNotice(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(R.string.ambassador_adults_only_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.ambassador_adults_only_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

private data class ShareTemplate(val audience: String, val message: String)

@Composable
private fun shareTemplates(link: String): List<ShareTemplate> = listOf(
    ShareTemplate(
        stringResource(R.string.ambassador_tpl_parents),
        stringResource(R.string.ambassador_tpl_parents_body, link),
    ),
    ShareTemplate(
        stringResource(R.string.ambassador_tpl_students),
        stringResource(R.string.ambassador_tpl_students_body, link),
    ),
    ShareTemplate(
        stringResource(R.string.ambassador_tpl_friends),
        stringResource(R.string.ambassador_tpl_friends_body, link),
    ),
    ShareTemplate(
        stringResource(R.string.ambassador_tpl_coaches),
        stringResource(R.string.ambassador_tpl_coaches_body, link),
    ),
    ShareTemplate(
        stringResource(R.string.ambassador_tpl_telugu),
        stringResource(R.string.ambassador_tpl_telugu_body, link),
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
    context.startActivity(
        Intent.createChooser(intent, context.getString(R.string.share_via))
    )
}
