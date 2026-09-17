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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.chess99.R

private val ORG_TYPES = listOf("club", "school", "federation", "company", "community", "other")

/** Display label for an organization type key; unknown keys keep the server value. */
@Composable
private fun orgTypeLabel(type: String): String = when (type) {
    "club" -> stringResource(R.string.org_type_club)
    "school" -> stringResource(R.string.org_type_school)
    "federation" -> stringResource(R.string.org_type_federation)
    "company" -> stringResource(R.string.org_type_company)
    "community" -> stringResource(R.string.org_type_community)
    "other" -> stringResource(R.string.org_type_other)
    else -> type.replaceFirstChar { it.uppercase() }
}

/** Display label for a member role key; unknown keys keep the server value. */
@Composable
private fun orgRoleLabel(role: String): String = when (role) {
    "organization_admin" -> stringResource(R.string.org_role_admin)
    "member" -> stringResource(R.string.org_role_member)
    else -> role.replace("_", " ").replaceFirstChar { it.uppercase() }
}

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
                title = { Text(stringResource(R.string.org_title), fontWeight = FontWeight.Bold) },
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
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text(stringResource(R.string.org_create)) },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onQueryChange(it) },
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                label = { Text(stringResource(R.string.org_search_label)) },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    TextButton(onClick = { viewModel.search(state.query) }) {
                        Text(stringResource(R.string.org_search))
                    }
                },
            )

            when {
                state.isLoading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text(
                        state.error ?: stringResource(R.string.error_title),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                state.organizations.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text(
                        stringResource(R.string.org_none_found),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
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
                                    Text(orgTypeLabel(org.type))
                                },
                                trailingContent = {
                                    Text(stringResource(R.string.org_member_count, org.memberCount))
                                },
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
        title = { Text(stringResource(R.string.org_create_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.org_name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                ExposedDropdownMenuBox(
                    expanded = typeExpanded,
                    onExpandedChange = { typeExpanded = it },
                ) {
                    OutlinedTextField(
                        value = orgTypeLabel(type),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.org_type)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    )
                    ExposedDropdownMenu(
                        expanded = typeExpanded,
                        onDismissRequest = { typeExpanded = false },
                    ) {
                        ORG_TYPES.forEach { t ->
                            DropdownMenuItem(
                                text = { Text(orgTypeLabel(t)) },
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
                    label = { Text(stringResource(R.string.org_contact_email)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = desc,
                    onValueChange = { desc = it },
                    label = { Text(stringResource(R.string.org_description)) },
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
                Text(
                    stringResource(if (isCreating) R.string.org_creating else R.string.org_create)
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }
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
                stringResource(R.string.org_summary, orgTypeLabel(org.type), org.memberCount),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Button(
                onClick = { showInvite = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.org_invite_member))
            }

            HorizontalDivider()

            Text(
                stringResource(R.string.org_members),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            when {
                isLoading -> Box(Modifier.fillMaxWidth().padding(24.dp), Alignment.Center) {
                    CircularProgressIndicator()
                }
                members.isEmpty() -> Text(
                    stringResource(R.string.org_no_members),
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
                                label = { Text(orgRoleLabel(m.role)) },
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
        title = { Text(stringResource(R.string.org_invite_member)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(stringResource(R.string.org_email)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = asAdmin, onCheckedChange = { asAdmin = it })
                    Text(stringResource(R.string.org_invite_as_admin))
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onInvite(email, if (asAdmin) "organization_admin" else "member") },
                enabled = email.isNotBlank() && !isInviting,
            ) {
                Text(
                    stringResource(if (isInviting) R.string.org_sending else R.string.org_send_invite)
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }
        },
    )
}
