package com.chess99.presentation.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

private val ORG_TYPES = listOf("club", "school", "federation", "company", "community", "other")

/**
 * Organizations hub — mirrors the web Organizations area. Members can search/browse,
 * and organization admins can create organizations, open one to view its members,
 * and invite new members (the backend enforces admin permission).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrganizationsScreen(
    onNavigateBack: () -> Unit,
    viewModel: OrganizationsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showCreate by remember { mutableStateOf(false) }

    LaunchedEffect(state.snackbarMessage) {
        state.snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSnackbar()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Organizations", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Create") },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onQueryChange(it) },
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                label = { Text("Search clubs, schools, federations") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    TextButton(onClick = { viewModel.search(state.query) }) { Text("Search") }
                },
            )

            when {
                state.isLoading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text(state.error ?: "Error", color = MaterialTheme.colorScheme.error)
                }
                state.organizations.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text("No organizations found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.organizations) { org ->
                        ElevatedCard(
                            onClick = { viewModel.openOrg(org) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            ListItem(
                                leadingContent = { Icon(Icons.Default.Groups, contentDescription = null) },
                                headlineContent = { Text(org.name, fontWeight = FontWeight.SemiBold) },
                                supportingContent = {
                                    Text(org.type.replaceFirstChar { it.uppercase() })
                                },
                                trailingContent = { Text("${org.memberCount} members") },
                            )
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        CreateOrganizationDialog(
            isCreating = state.isCreating,
            onDismiss = { showCreate = false },
            onCreate = { name, type, email, desc ->
                viewModel.createOrganization(name, type, email, desc)
                showCreate = false
            },
        )
    }

    state.selectedOrg?.let { org ->
        OrganizationMembersSheet(
            org = org,
            members = state.members,
            isLoading = state.isLoadingMembers,
            isInviting = state.isInviting,
            onInvite = { email, role -> viewModel.invite(email, role) },
            onDismiss = { viewModel.closeOrg() },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateOrganizationDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, type: String, email: String, desc: String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(ORG_TYPES.first()) }
    var email by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var typeExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create organization") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                ExposedDropdownMenuBox(
                    expanded = typeExpanded,
                    onExpandedChange = { typeExpanded = it },
                ) {
                    OutlinedTextField(
                        value = type.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = typeExpanded,
                        onDismissRequest = { typeExpanded = false },
                    ) {
                        ORG_TYPES.forEach { t ->
                            DropdownMenuItem(
                                text = { Text(t.replaceFirstChar { it.uppercase() }) },
                                onClick = {
                                    type = t
                                    typeExpanded = false
                                },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Contact email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = desc,
                    onValueChange = { desc = it },
                    label = { Text("Description (optional)") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onCreate(name, type, email, desc) },
                enabled = name.isNotBlank() && email.isNotBlank() && !isCreating,
            ) {
                Text(if (isCreating) "Creating…" else "Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrganizationMembersSheet(
    org: OrganizationItem,
    members: List<OrgMember>,
    isLoading: Boolean,
    isInviting: Boolean,
    onInvite: (email: String, role: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showInvite by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(org.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                "${org.type.replaceFirstChar { it.uppercase() }} • ${org.memberCount} members",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Button(
                onClick = { showInvite = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Invite member")
            }

            HorizontalDivider()

            Text("Members", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

            when {
                isLoading -> Box(Modifier.fillMaxWidth().padding(24.dp), Alignment.Center) {
                    CircularProgressIndicator()
                }
                members.isEmpty() -> Text(
                    "No members yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> members.forEach { m ->
                    ListItem(
                        headlineContent = { Text(m.name) },
                        supportingContent = { Text(m.email) },
                        trailingContent = {
                            AssistChip(
                                onClick = {},
                                label = { Text(m.role.replace("_", " ").replaceFirstChar { it.uppercase() }) },
                            )
                        },
                    )
                }
            }
        }
    }

    if (showInvite) {
        InviteMemberDialog(
            isInviting = isInviting,
            onDismiss = { showInvite = false },
            onInvite = { email, role ->
                onInvite(email, role)
                showInvite = false
            },
        )
    }
}

@Composable
private fun InviteMemberDialog(
    isInviting: Boolean,
    onDismiss: () -> Unit,
    onInvite: (email: String, role: String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var asAdmin by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Invite member") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = asAdmin, onCheckedChange = { asAdmin = it })
                    Text("Invite as organization admin")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onInvite(email, if (asAdmin) "organization_admin" else "member") },
                enabled = email.isNotBlank() && !isInviting,
            ) {
                Text(if (isInviting) "Sending…" else "Send invite")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
