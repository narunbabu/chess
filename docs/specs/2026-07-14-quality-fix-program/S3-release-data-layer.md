# S3 — Release data-layer fixes: spinners, crashes, error copy (P0, Android)

## Problem

Five screens collapse on production data in the release build (review §3.3,
§3.8, §3.10, §3.13, §3.19, root causes §4.2–4.3). Two shared anti-patterns:

**A. Parallel child loaders never clear `isLoading` on failure → spinner forever.**
`DashboardViewModel.loadDashboard()` (lines 49–67) sets `isLoading = true`, then
fire-and-forgets 5 `launch { … }` child loaders. Each child's `catch` only
`Timber.e(...)`s — `isLoading` is cleared *only* inside success branches
(`loadUserInfo` line ~74). Any prod parse/network failure = infinite spinner.
Identical pattern in `ReferralViewModel.loadAll()` (lines 27–41, children at
43–143). `ProfileViewModel.loadStats()` (lines 134–159) has no loading/error
state at all → Stats tab renders an eternal spinner/blank.

**B. Raw exception text and brittle JsonObject casts reach the user.**
`GameHistoryViewModel.loadGames()` (lines ~58–120): `gamesArray?.map {
parseGameSummary(el.asJsonObject) }` throws `ClassCastException` when a prod
entry is `JsonNull`; the catch (lines 111–118) renders
`"Network error: ${e.message}"` → user sees **"Network error: I5.n cannot be
cast to I5.q"** (R8-obfuscated Gson classes). `PaymentViewModel.loadSubscription()`
(line ~82) renders `"Failed to load subscription: ${e.message}"` → **"…: p"**.

## Files

- `presentation/dashboard/DashboardViewModel.kt` (+ `DashboardScreen.kt` for error UI)
- `presentation/referral/ReferralViewModel.kt` (+ its screen)
- `presentation/profile/ProfileViewModel.kt` (+ `ProfileScreen.kt` Stats tab)
- `presentation/history/GameHistoryViewModel.kt` (+ its screen)
- `presentation/payment/PaymentViewModel.kt` (+ `SubscriptionScreen.kt`)
- NEW: `presentation/common/ErrorCopy.kt`, `data/api/JsonSafe.kt`

All under `chess99-android/app/src/main/java/com/chess99/`.

## Tasks

### T1 — Shared helpers (create first, use everywhere)

`data/api/JsonSafe.kt` — null-safe Gson navigation used by all hand-parsers:

```kotlin
package com.chess99.data.api

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject

fun JsonElement?.objOrNull(): JsonObject? = if (this != null && isJsonObject) asJsonObject else null
fun JsonElement?.arrOrNull(): JsonArray? = if (this != null && isJsonArray) asJsonArray else null
fun JsonObject?.str(key: String): String? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.asString
fun JsonObject?.int(key: String): Int? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asInt }?.getOrNull()
fun JsonObject?.dbl(key: String): Double? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asDouble }?.getOrNull()
fun JsonObject?.bool(key: String): Boolean? = this?.get(key)?.takeIf { it.isJsonPrimitive }?.runCatching { asBoolean }?.getOrNull()
```

`presentation/common/ErrorCopy.kt` — the ONLY way user-facing failure text is
produced from now on (grep the module for `${e.message}` and `e.message` in any
string assigned to a UiState `error` field — replace every occurrence):

```kotlin
package com.chess99.presentation.common

import java.io.IOException

/** Kid-safe failure copy. Never expose exception internals to users. */
fun friendlyError(e: Throwable, what: String): String = when (e) {
    is IOException -> "Couldn't reach Chess99. Check your connection and try again."
    else -> "Couldn't load $what. Please try again."
}
```

### T2 — Dashboard: await children, clear loading once, per-section errors

Restructure `loadDashboard()`:

```kotlin
private fun loadDashboard() {
    viewModelScope.launch {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        val jobs = listOf(
            launch { loadUserInfo() },
            launch { loadStats() },
            launch { loadRecentGames() },
            launch { loadActiveTournaments() },
            launch { loadUnfinishedGames() },
        )
        jobs.joinAll()
        _uiState.value = _uiState.value.copy(isLoading = false)
    }
}
```

- Remove every `isLoading = false` from child success branches (single owner now).
- Each child catch: keep `Timber.e`, and set a section-level error the UI can
  render (e.g., `statsError = friendlyError(e, "your stats")`) — at minimum,
  ensure a top-level `error` is set when **user info** fails (the screen is
  useless without it) so the screen shows an error card with a Retry button
  calling `loadDashboard()`.
- `DashboardScreen.kt` (~line 79): render three states — loading / error card
  with Retry / content. No bare spinner-in-void: give the loading state the top
  app bar + (nice-to-have) skeleton rows.
- Convert child parsers to the `JsonSafe` helpers (they already use `?.`
  patterns; the crash risk is `el.asJsonObject` inside `map` — use
  `mapNotNull { it.objOrNull() }`).

### T3 — Referrals: same restructure

Apply the exact T2 pattern to `ReferralViewModel.loadAll()` and its 5 children
(`loadStats/loadReferredUsers/loadEarnings/loadPayouts/loadApplication`).
Screen gets error card + Retry. Also: `referralLink` — see S9 item 9 (path fix);
do not duplicate that work here.

### T4 — Profile Stats tab: real states

`ProfileViewModel`: add `isStatsLoading: Boolean` and `statsError: String?` to
the UiState. `loadStats()`: set loading true → `try { … } catch { statsError =
friendlyError(e, "your stats") } finally { isStatsLoading = false }`. Screen:
loading / error+Retry / stats content / genuine-empty ("Play your first game to
see stats!") when the API succeeds with zeros.

### T5 — Game History: null-safe parse + honest copy

In `loadGames()`:
```kotlin
val parsedGames = gamesArray
    ?.mapNotNull { el -> el.objOrNull()?.let { runCatching { parseGameSummary(it) }.getOrNull() } }
    ?: emptyList()
```
- Inside `parseGameSummary` (lines ~527–606), replace direct `.asInt/.asString/
  .getAsJsonObject` chains with the `JsonSafe` helpers so a single junk field
  can't kill the row.
- Catch block copy: `error = friendlyError(e, "your games")` — delete the
  `"Network error: ${e.message}"` string.
- If everything parses to empty but the HTTP call succeeded, show the normal
  empty state, not an error.

### T6 — My Plan: graceful degradation

`PaymentViewModel.loadSubscription()` catch: replace the error string with a
**non-blocking** outcome — set `currentSubscription = null` and a soft notice
string the screen renders inline (NOT an alert dialog):
"Couldn't check your plan — you're on the Free plan for now." Remove the error
dialog trigger from `SubscriptionScreen` for this failure path (keep dialogs
for explicit user actions like cancel-subscription failing).

## Acceptance criteria (RELEASE build, prod, test account)

1. Dashboard reaches content or a friendly error card with working Retry in
   <10 s. No infinite spinner (verify by watching ≥30 s).
2. Referrals: same.
3. Profile → Stats: same (content, friendly error, or friendly empty).
4. Game History: the games list **renders actual games** for the test account;
   no "Network error: …" with class names anywhere. Open one game's review.
5. My Plan: opens with either the real plan or the inline Free-plan notice;
   no dialog with obfuscated text.
6. `grep -rn '\${e.message}\|e.message' app/src/main/java/com/chess99/presentation/`
   shows no user-facing usages (Timber logging is fine).
7. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S3-*.png` for each of the five screens.
