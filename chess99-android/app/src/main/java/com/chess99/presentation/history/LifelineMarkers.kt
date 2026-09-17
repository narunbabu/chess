package com.chess99.presentation.history

import com.chess99.R
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.google.gson.JsonElement
import com.google.gson.JsonObject

/** The marker names shared by live play, compact history, and Game Review. */
internal object LifelineMarkers {
    private val markerKeys = listOf("learning_help", "learningHelp", "lifelines", "helpUsed")

    fun fromMoveJson(move: JsonObject): List<String> = markerKeys
        .asSequence()
        .mapNotNull { key -> move.get(key) }
        .map { fromElement(it) }
        .firstOrNull { it.isNotEmpty() }
        ?: emptyList()

    fun fromCompactToken(token: String?): List<String> = token
        ?.split('+')
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        ?.map { runCatching { java.net.URLDecoder.decode(it, "UTF-8") }.getOrDefault(it) }
        ?: emptyList()

    @androidx.annotation.StringRes
    fun labelRes(marker: String): Int = when (marker.lowercase()) {
        "best-move", "best_move", "best" -> R.string.lifeline_best
        "undo" -> R.string.lifeline_undo
        "review" -> R.string.lifeline_review
        else -> R.string.lifeline_help
    }

    private fun fromElement(element: JsonElement): List<String> = when {
        element.isJsonArray -> element.asJsonArray.mapNotNull { item ->
            when {
                item.isJsonPrimitive -> item.asString
                item.isJsonObject -> item.objOrNull()?.let { obj ->
                    obj.str("type") ?: obj.str("kind") ?: obj.str("name")
                }
                else -> null
            }
        }
        element.isJsonPrimitive -> fromCompactToken(element.asString)
        element.isJsonObject -> markerKeys.asSequence()
            .mapNotNull { key -> element.asJsonObject.get(key) }
            .map { fromElement(it) }
            .firstOrNull { it.isNotEmpty() }
            ?: emptyList()
        else -> emptyList()
    }
}
