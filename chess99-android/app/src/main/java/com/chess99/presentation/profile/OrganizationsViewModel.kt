package com.chess99.presentation.profile

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.OrganizationApi
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

data class OrganizationItem(
    val id: Int,
    val name: String,
    val type: String,
    val memberCount: Int,
)

data class OrgMember(
    val id: Int,
    val name: String,
    val email: String,
    val role: String,
)

data class OrganizationsUiState(
    val isLoading: Boolean = false,
    val query: String = "",
    val organizations: List<OrganizationItem> = emptyList(),
    val error: String? = null,
    // Create
    val isCreating: Boolean = false,
    // Members / manage
    val selectedOrg: OrganizationItem? = null,
    val members: List<OrgMember> = emptyList(),
    val isLoadingMembers: Boolean = false,
    val isInviting: Boolean = false,
    val snackbarMessage: String? = null,
)

@HiltViewModel
class OrganizationsViewModel @Inject constructor(
    private val organizationApi: OrganizationApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrganizationsUiState())
    val uiState: StateFlow<OrganizationsUiState> = _uiState.asStateFlow()

    init {
        search("")
    }

    fun onQueryChange(q: String) {
        _uiState.value = _uiState.value.copy(query = q)
    }

    fun search(query: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = organizationApi.list(search = query.ifBlank { null })
                if (response.isSuccessful) {
                    val arr = response.body()?.getAsJsonArray("data")
                    val items = buildList {
                        arr?.forEach { el ->
                            val o = el.asJsonObject
                            add(
                                OrganizationItem(
                                    id = o.get("id")?.asInt ?: 0,
                                    name = o.get("name")?.asString ?: context.getString(R.string.player_unknown),
                                    type = o.get("type")?.asString ?: "organization",
                                    memberCount = o.get("users_count")?.asInt
                                        ?: o.get("member_count")?.asInt ?: 0,
                                ),
                            )
                        }
                    }
                    _uiState.value = _uiState.value.copy(isLoading = false, organizations = items)
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = context.getString(R.string.org_load_failed))
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to search organizations")
                _uiState.value = _uiState.value.copy(isLoading = false, error = friendlyError(context, e, R.string.error_subject_organizations))
            }
        }
    }

    /** Create an organization. The backend grants the creator organization-admin. */
    fun createOrganization(name: String, type: String, contactEmail: String, description: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCreating = true)
            try {
                val body = JsonObject().apply {
                    addProperty("name", name.trim())
                    addProperty("type", type)
                    addProperty("contact_email", contactEmail.trim())
                    if (description.isNotBlank()) addProperty("description", description.trim())
                }
                val response = organizationApi.create(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isCreating = false,
                        snackbarMessage = context.getString(R.string.org_created),
                    )
                    search(_uiState.value.query)
                } else {
                    val msg = when (response.code()) {
                        422 -> context.getString(R.string.org_create_invalid)
                        403 -> context.getString(R.string.org_create_forbidden)
                        else -> context.getString(R.string.org_create_failed)
                    }
                    _uiState.value = _uiState.value.copy(isCreating = false, snackbarMessage = msg)
                }
            } catch (e: Exception) {
                Timber.e(e, "Create organization error")
                _uiState.value = _uiState.value.copy(isCreating = false, snackbarMessage = friendlyError(context, e, R.string.error_subject_creating_the_organization))
            }
        }
    }

    /** Open an organization and load its members. */
    fun openOrg(org: OrganizationItem) {
        _uiState.value = _uiState.value.copy(selectedOrg = org, members = emptyList(), isLoadingMembers = true)
        viewModelScope.launch { loadMembers(org.id) }
    }

    fun closeOrg() {
        _uiState.value = _uiState.value.copy(selectedOrg = null, members = emptyList())
    }

    private suspend fun loadMembers(orgId: Int) {
        try {
            val response = organizationApi.members(orgId)
            if (response.isSuccessful) {
                val arr = response.body()
                    ?.getAsJsonObject("members")?.getAsJsonArray("data")
                val members = buildList {
                    arr?.forEach { el ->
                        val o = el.asJsonObject
                        val role = o.getAsJsonArray("roles")
                            ?.firstOrNull()?.asJsonObject?.get("name")?.asString ?: "member"
                        add(
                            OrgMember(
                                id = o.get("id")?.asInt ?: 0,
                                name = o.get("name")?.asString ?: context.getString(R.string.org_member_fallback),
                                email = o.get("email")?.asString ?: "",
                                role = role,
                            ),
                        )
                    }
                }
                _uiState.value = _uiState.value.copy(isLoadingMembers = false, members = members)
            } else {
                _uiState.value = _uiState.value.copy(isLoadingMembers = false)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load members")
            _uiState.value = _uiState.value.copy(isLoadingMembers = false)
        }
    }

    /** Invite a member by email to the currently-open organization. */
    fun invite(email: String, role: String) {
        val org = _uiState.value.selectedOrg ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isInviting = true)
            try {
                val body = JsonObject().apply {
                    addProperty("email", email.trim())
                    addProperty("role", role)
                }
                val response = organizationApi.invite(org.id, body)
                val msg = if (response.isSuccessful) {
                    context.getString(R.string.org_invite_sent, email.trim())
                } else {
                    when (response.code()) {
                        403 -> context.getString(R.string.org_invite_forbidden)
                        422 -> context.getString(R.string.org_invite_invalid)
                        else -> context.getString(R.string.org_invite_failed)
                    }
                }
                _uiState.value = _uiState.value.copy(isInviting = false, snackbarMessage = msg)
            } catch (e: Exception) {
                Timber.e(e, "Invite member error")
                _uiState.value = _uiState.value.copy(isInviting = false, snackbarMessage = friendlyError(context, e, R.string.error_subject_sending_the_invite))
            }
        }
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }
}
