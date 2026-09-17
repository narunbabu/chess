package com.chess99.presentation.common

import android.content.Context
import androidx.annotation.StringRes
import com.chess99.R
import java.io.IOException

/**
 * Kid-safe failure copy. Never expose exception internals (class names,
 * R8-obfuscated identifiers, raw enums) to users — this is a kids app, and
 * production/R8-obfuscated exception messages are unreadable and alarming
 * (e.g. "I5.n cannot be cast to I5.q"). This is the only sanctioned way to
 * turn a [Throwable] into user-facing text; always log the real exception
 * via Timber separately for debugging.
 *
 * [what] names the thing that failed and is a string resource so the whole
 * sentence stays translatable — the subjects live under `error_subject_*` in
 * strings.xml. Callers are ViewModels, so the [Context] is the Hilt
 * `@ApplicationContext`, never an Activity.
 */
fun friendlyError(context: Context, e: Throwable, @StringRes what: Int): String = when (e) {
    is IOException -> context.getString(R.string.error_offline)
    else -> context.getString(R.string.error_generic, context.getString(what))
}
