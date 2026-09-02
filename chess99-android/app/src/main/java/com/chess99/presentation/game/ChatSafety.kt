package com.chess99.presentation.game

/**
 * Server policy mirrored locally so the UI can fail closed while offline.
 * Android deliberately uses preset-only chat for every minor, which is
 * stricter than the backend's under-13 minimum.
 */
data class ChatPolicy(
    val enabled: Boolean = true,
    val presetOnly: Boolean = false,
    val reason: String? = null,
    val presetMessages: List<String> = ChatSafetyRules.PRESET_MESSAGES,
    val emojiMessages: List<String> = ChatSafetyRules.EMOJI_MESSAGES,
    val reportReasons: List<String> = ChatSafetyRules.REPORT_REASONS,
    val maxLength: Int = 500,
)

object ChatSafetyRules {
    val PRESET_MESSAGES = listOf(
        "Good luck!",
        "Good move!",
        "Thanks!",
        "Well played!",
        "Nice tactic!",
        "I need to think.",
        "Good game!",
    )

    val EMOJI_MESSAGES = listOf("👍", "👏", "🙂", "🤝", "♟")

    val REPORT_REASONS = listOf(
        "unsafe_language",
        "bullying",
        "personal_info",
        "spam_or_link",
        "other",
    )

    fun isPresetOnly(isMinor: Boolean, policy: ChatPolicy): Boolean =
        isMinor || policy.presetOnly

    fun canSend(message: String, isMinor: Boolean, policy: ChatPolicy): Boolean {
        val trimmed = message.trim()
        if (!policy.enabled || trimmed.isEmpty() || trimmed.length > policy.maxLength) return false
        if (!isPresetOnly(isMinor, policy)) return true
        return trimmed in policy.presetMessages || trimmed in policy.emojiMessages
    }

    fun disabledReason(reason: String?): String = when (reason) {
        "account_disabled" -> "Chat is disabled for this account."
        "organization_disabled" -> "Chat is disabled by your organization."
        "blocked" -> "Chat is blocked between these players."
        else -> "Chat is unavailable."
    }
}
