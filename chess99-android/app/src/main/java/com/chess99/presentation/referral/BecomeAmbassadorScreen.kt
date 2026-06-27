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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

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
                title = { Text("Become an Ambassador", fontWeight = FontWeight.Bold) },
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
                            if (state.ambassadorStatus.equals("approved", ignoreCase = true)) {
                                "You're an approved ambassador!"
                            } else {
                                "Your application is under review"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "We'll notify you once there's an update.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                return@Column
            }

            Text(
                "Help more kids discover chess. Ambassadors earn commission for every " +
                    "player they bring to Chess99. Tell us a bit about yourself.",
                style = MaterialTheme.typography.bodyMedium,
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Full name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = mobile,
                onValueChange = { mobile = it },
                label = { Text("Mobile number") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = upi,
                onValueChange = { upi = it },
                label = { Text("UPI ID (for payouts)") },
                placeholder = { Text("name@bank") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                label = { Text("Why do you want to join? (optional)") },
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
                    Text("Submit Application")
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
