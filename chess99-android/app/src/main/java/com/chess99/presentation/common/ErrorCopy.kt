package com.chess99.presentation.common

import java.io.IOException

/**
 * Kid-safe failure copy. Never expose exception internals (class names,
 * R8-obfuscated identifiers, raw enums) to users — this is a kids app, and
 * production/R8-obfuscated exception messages are unreadable and alarming
 * (e.g. "I5.n cannot be cast to I5.q"). This is the only sanctioned way to
 * turn a [Throwable] into user-facing text; always log the real exception
 * via Timber separately for debugging.
 */
fun friendlyError(e: Throwable, what: String): String = when (e) {
    is IOException -> "Couldn't reach Chess99. Check your connection and try again."
    else -> "Couldn't load $what. Please try again."
}
