# S5 — Learn/Tutorials contract fix + Learn IA (P0, Android)

## Problem

The Learn tab of a "chess academy" app shows **zero lessons**: every module
opens to "No lessons in this module yet", the stats header reads "0/0 Lessons,
0 XP" (review §3.15, §4.5). The web Learn works against the **same prod API**,
so the content exists — Android's parsing misses it.

Root cause: the backend wraps every tutorial response in an envelope
`{ "success": bool, "data": … }` (see `chess-backend/app/Http/Controllers/
TutorialController.php`, routes in `routes/api_v1.php:203-225`), and nests
stats under `data.stats`. `LearnViewModel` (lines ~60–160) reads keys from the
**top-level body** (`modules`, `lessons`, `completed_lessons`, `xp`, …) with
silent `?: 0` / `?: emptyList()` fallbacks — every miss degrades to a
fake-working empty UI. (The module LIST renders because one code path happens
to try `data` as an array fallback; module detail and stats do not.)

## Backend contract (authoritative — from TutorialController)

| Endpoint | Android must read |
|----------|-------------------|
| `GET tutorial/modules` | `body.data` = **array** of modules: `id, slug, title, description, tier, icon, lessons_count (or lessons array), user_progress, is_unlocked, total_xp` |
| `GET tutorial/modules/{slug}` | `body.data` = **object**: `id, slug, title, …, lessons: [ { id, title, description, order, is_completed, xp_reward, type } ], user_progress` |
| `GET tutorial/lessons/{id}` | `body.data` = object: `id, title, user_progress, formatted_duration, is_unlocked` |
| `GET tutorial/progress` | `body.data.stats` = `{ completed_lessons, total_lessons, xp_progress, level, streak }` + `body.data.recent_achievements`, `body.data.next_lesson` |
| `GET tutorial/progress/stats` | `body.data.stats` = `{ completed_lessons, total_lessons, xp, level, streak }` |
| `GET tutorial/achievements` | `body.data` = array: `id, name, tier, progress, is_earned` |
| `GET tutorial/daily-challenge` | `body.data` = challenge object + `user_completion`, `track`, `available_tracks` |

**First step of implementation: verify this table live.** Log in on the
emulator, then from the ViewModel temporarily `Timber.d(body.toString())` for
each endpoint on a DEBUG build (or curl with a Sanctum token) and confirm the
exact keys — the table above comes from controller code reading, and key-level
drift (e.g. `xp` vs `xp_progress`) is precisely the class of bug being fixed.
Adjust the mapping to observed reality, then remove the debug logging.

## Files

- `presentation/learn/LearnViewModel.kt` (primary)
- `presentation/learn/LearnScreen.kt` (module-card UI, states)
- `data/api/TutorialApi.kt` (read-only reference)
- Web reference: `chess-frontend/src/components/tutorial/TutorialHub.jsx`
  (lines 57, 92, 116 — same endpoints, working parse)

## Tasks

### T1 — Envelope unwrapping

Add one helper in `LearnViewModel` (or reuse S3's `JsonSafe.kt` if merged):

```kotlin
private fun JsonObject.dataObj(): JsonObject? = get("data")?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.dataArr(): JsonArray? = get("data")?.takeIf { it.isJsonArray }?.asJsonArray
```

Rewrite each loader to unwrap first, then read the keys from the contract
table: modules from `dataArr()`; module detail lessons from
`dataObj()?.getAsJsonArray("lessons")`; progress stats from
`dataObj()?.getAsJsonObject("stats")` (map `xp_progress` OR `xp` → xp);
achievements from `dataArr()`; daily challenge from `dataObj()`.
Keep the existing defensive alternate keys as fallbacks — but see T2.

### T2 — Make contract mismatches loud instead of fake-empty

If the HTTP call succeeds but `success == false`, or the expected `data` node
is missing entirely: set an error state ("Couldn't load lessons. Pull to
retry." — use S3's `friendlyError` if available) instead of rendering 0/0.
Genuine empptiness (HTTP ok, `data.lessons` present but `[]`) keeps the current
empty-state copy. Add `Timber.w("tutorial contract miss: keys=${body.keySet()}")`
on every fallback branch so future drift is visible in logcat.

### T3 — Learn IA fixes (review §3.15/§3.16)

1. **Module cards must show the module `title`** (bold, `titleMedium`) above
   the description — today cards render only the description sentence
   (screenshot `24`). The title is in the payload.
2. **Merge the duplicate trainers** in the Training tab: remove the API-backed
   "Tactics Trainer" entry (shows "No puzzles available" on prod) and keep
   "Tactical Progression" (bundled, works) — rename its display label to
   **"Tactics Trainer"**. One entry, one name.
3. **Achievements card copy**: "Complete lessons to earn achievements" is a
   dead end while lessons roll out — change to "Complete lessons and solve
   puzzles to earn achievements" and verify tapping it doesn't dead-end.

## Acceptance criteria (RELEASE build, prod, test account)

1. Learn → Tutorials: stats header shows real numbers (not 0/0 — the web
   account shows nonzero lessons; compare side-by-side with chess99.com Learn
   for the same account).
2. Opening a Beginner module lists its lessons with titles; opening a lesson
   loads it.
3. Module cards show Title + description.
4. Training tab has exactly one tactics entry and it works.
5. Kill the network (airplane mode) → Learn shows a friendly error with retry,
   NOT "0/0 / No lessons".
6. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S5-*.png`.

**If, after the contract fix, prod truly returns zero lessons** (i.e., the
content itself is missing server-side): STOP and report — that becomes a
backend/content task for the owner, not a client hack. Evidence: the raw JSON
from T1's verification step.
