package com.chess99.presentation.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    onNavigateToLogin: () -> Unit,
    onRegisterSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var birthday by remember { mutableStateOf("") } // yyyy-MM-dd
    var guardianEmail by remember { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current

    val age = remember(birthday) { ageFromIso(birthday) }
    val isMinor = age != null && age < 18

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) onRegisterSuccess()
    }

    val datePickerState = rememberDatePickerState(
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                utcTimeMillis <= System.currentTimeMillis()
        },
    )
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        birthday = java.time.Instant.ofEpochMilli(millis)
                            .atZone(java.time.ZoneOffset.UTC)
                            .toLocalDate()
                            .toString()
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Chess99",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Create your account",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Name field
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Name") },
            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Email field
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Password field
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        if (passwordVisible) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility,
                        contentDescription = null,
                    )
                }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None
            else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Next,
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Confirm password field
        OutlinedTextField(
            value = confirmPassword,
            onValueChange = { confirmPassword = it },
            label = { Text("Confirm Password") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
            visualTransformation = if (passwordVisible) VisualTransformation.None
            else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = { focusManager.clearFocus() },
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Date of birth — required for age-gating (kid-safe chat + guardian consent)
        OutlinedTextField(
            value = birthday,
            onValueChange = {},
            readOnly = true,
            label = { Text("Date of birth") },
            leadingIcon = { Icon(Icons.Default.DateRange, contentDescription = null) },
            trailingIcon = {
                IconButton(onClick = { showDatePicker = true }) {
                    Icon(Icons.Default.DateRange, contentDescription = "Pick date")
                }
            },
            placeholder = { Text("YYYY-MM-DD") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "We use birthdays to keep chat safe for kids.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        if (isMinor) {
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = guardianEmail,
                onValueChange = { guardianEmail = it },
                label = { Text("Parent / guardian email") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Done,
                ),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Players under 18 need a parent or guardian to approve the account.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }

        // Error message
        uiState.error?.let { error ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Register button
        Button(
            onClick = {
                viewModel.register(
                    name, email, password, confirmPassword,
                    birthday, if (isMinor) guardianEmail else null,
                )
            },
            enabled = !uiState.isLoading
                    && name.isNotBlank()
                    && email.isNotBlank()
                    && password.length >= 8
                    && password == confirmPassword
                    && birthday.isNotBlank()
                    && (!isMinor || guardianEmail.isNotBlank()),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Create Account")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        HorizontalDivider(modifier = Modifier.fillMaxWidth())

        Spacer(modifier = Modifier.height(16.dp))

        // Google Sign-In shortcut
        OutlinedButton(
            onClick = { viewModel.initiateGoogleSignIn(context) },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = !uiState.isLoading,
        ) {
            Text("Sign up with Google")
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Facebook Sign-In shortcut
        OutlinedButton(
            onClick = { viewModel.initiateFacebookSignIn(context) },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = !uiState.isLoading,
        ) {
            Text("Sign up with Facebook")
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onNavigateToLogin) {
            Text("Already have an account? Sign In")
        }
    }
}

/** Whole-years age from a yyyy-MM-dd string, or null if blank/unparseable. */
private fun ageFromIso(iso: String): Int? {
    return try {
        if (iso.isBlank()) return null
        val dob = java.time.LocalDate.parse(iso)
        java.time.Period.between(dob, java.time.LocalDate.now()).years
    } catch (e: Exception) {
        null
    }
}
