package com.chess99.data.repository

import com.chess99.data.api.EntitlementApi
import com.google.gson.JsonObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EntitlementRepository @Inject constructor(
    private val entitlementApi: EntitlementApi,
) {
    private val _summary = MutableStateFlow<JsonObject?>(null)
    val summary: StateFlow<JsonObject?> = _summary.asStateFlow()

    private val _capabilities = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val capabilities: StateFlow<Map<String, Boolean>> = _capabilities.asStateFlow()

    private val _effectiveTier = MutableStateFlow("free")
    val effectiveTier: StateFlow<String> = _effectiveTier.asStateFlow()

    suspend fun refreshEntitlements() {
        try {
            val response = entitlementApi.getMyEntitlements()
            if (!response.isSuccessful) {
                Timber.w("Failed to load entitlements: HTTP ${response.code()}")
                return
            }

            val data = response.body()
                ?.getAsJsonObject("data")
                ?: return

            _summary.value = data
            _effectiveTier.value = data.get("effective_tier")?.asString ?: "free"
            _capabilities.value = data.getAsJsonObject("capabilities")
                ?.entrySet()
                ?.associate { (key, value) -> key to value.asBoolean }
                ?: emptyMap()
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh entitlements")
        }
    }

    fun can(capability: String): Boolean = _capabilities.value[capability] == true

    fun reset() {
        _summary.value = null
        _capabilities.value = emptyMap()
        _effectiveTier.value = "free"
    }
}

