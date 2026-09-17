package com.chess99.presentation.referral

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R

/**
 * Become-Ambassador application form — mirrors the web /become-ambassador page.
 * Collects name, mobile, UPI id and an optional reason, then POSTs to
 * /ambassador/apply. Shares ReferralViewModel with the ambassador dashboard so a
 * freshly-submitted/approved status is reflected immediately on return.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BecomeAmbassadorScreen(
    onNavigateBack: () -> Unit,
    viewModel: ReferralViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    var name by remember { mutableStateOf("") }
    var mobile by remember { mutableStateOf("") }
    var upi by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    // Pop back once the application has been accepted by the server.
    LaunchedEffect(state.applicationSubmitted) {
        if (state.applicationSubmitted) {
            viewModel.clearApplicationSubmitted()
            onNavigateBack()
        }
    }

    val alreadyApplied = state.ambassadorStatus != null &&
        !state.ambassadorStatus.equals("rejected", ignoreCase = true)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.ambassador_become_title), fontWeight = FontWeight.Bold) },
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
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (alreadyApplied) {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(40.dp),
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            stringResource(
                                if (state.ambassadorStatus.equals("approved", ignoreCase = true)) {
                                    R.string.become_ambassador_approved
                                } else {
                                    R.string.become_ambassador_under_review
                                }
                            ),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            stringResource(R.string.become_ambassador_notify),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                return@Column
            }

            Text(
                stringResource(R.string.become_ambassador_intro),
                style = MaterialTheme.typography.bodyMedium,
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.become_ambassador_full_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = mobile,
                onValueChange = { mobile = it },
                label = { Text(stringResource(R.string.become_ambassador_mobile)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = upi,
                onValueChange = { upi = it },
                label = { Text(stringResource(R.string.become_ambassador_upi)) },
                placeholder = { Text(stringResource(R.string.become_ambassador_upi_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                label = { Text(stringResource(R.string.become_ambassador_reason)) },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )

            state.applicationError?.let { err ->
                Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            val canSubmit = name.isNotBlank() && mobile.isNotBlank() && upi.isNotBlank() &&
                !state.isSubmittingApplication

            Button(
                onClick = { viewModel.applyAmbassador(name, mobile, upi, reason) },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.isSubmittingApplication) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text(stringResource(R.string.become_ambassador_submit))
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
