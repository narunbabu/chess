package com.chess99.data.api

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject

/**
 * Null-safe Gson navigation helpers used by all hand-rolled JSON parsers in
 * the data layer.
 *
 * Production API responses occasionally contain `null` or unexpected-type
 * fields where a value is normally expected (e.g. a game history entry with
 * a `null` element, or a numeric field returned as a string). Direct Gson
 * calls like `el.asJsonObject` or `get("x").asInt` throw
 * [IllegalStateException]/[ClassCastException] in those cases, which (after
 * R8 obfuscation) surface to users as unreadable text like
 * "I5.n cannot be cast to I5.q". These helpers return `null` instead so
 * callers can fall back to a sane default.
 */
fun JsonElement?.objOrNull(): JsonObject? = if (this != null && isJsonObject) asJsonObject else null
fun JsonElement?.arrOrNull(): JsonArray? = if (this != null && isJsonArray) asJsonArray else null

/** A list body that is either a bare array or an object wrapping it under the first matching key. */
fun JsonElement?.arrOrField(vararg keys: String): JsonArray? =
    arrOrNull() ?: objOrNull()?.let { obj -> keys.firstNotNullOfOrNull { obj.get(it).arrOrNull() } }
fun JsonObject?.str(key: String): String? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.asString
fun JsonObject?.int(key: String): Int? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asInt }?.getOrNull()
fun JsonObject?.dbl(key: String): Double? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asDouble }?.getOrNull()
fun JsonObject?.bool(key: String): Boolean? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asBoolean }?.getOrNull()
