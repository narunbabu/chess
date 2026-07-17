# S13 — Friends request management UI (P1, Android)

**Added 2026-07-15** from the gap analysis (§2 "Friends is a tab, not a full
page"). Investigation sharpened it: **the Android data layer is complete; the
UI is what's missing.** Today a friend request sent from Android can only be
accepted on the web. No dependencies.

## Facts (verified 2026-07-15)

- UI: Friends is a tab in Lobby — `LobbyScreen.kt` (tab :85-90, `FriendsTab`
  :229-309); logic in `LobbyViewModel.kt`.
- Present: search (`:426-451` → `GET matchmaking/search-users`), send request
  (`:453-463` → `POST friends/request`), list friends (`:143-163` →
  `GET friends`, 10 s polling), challenge friend (`:359-379`).
- Missing UI (data layer ready in `MatchmakingApi.kt:82-101`):
  - incoming pending list — `GET friends/pending` (:90-91) never called;
  - accept — VM method exists (`acceptFriendRequest`, `LobbyViewModel.kt:465-474`)
    but is **never called from any composable**;
  - decline — `POST friends/{id}/decline` (:96-97), no VM/UI;
  - remove friend — `DELETE friends/{id}` (:99-100), no VM/UI.
- Backend v1 endpoints all confirmed live (`routes/api_v1.php:99-106`,
  `FriendController.php`). `GET /friends/pending` returns incoming requesters
  (:106-118).
- Note: web's own `/friends` page has no outgoing-pending list either (and its
  "Request Pending" badge is actually keyed off *incoming* requests —
  `FriendsPage.js:134` — a web bug logged in S16). Outgoing-pending is
  **out of scope** here; there is no backend endpoint for it.

## Tasks

### T1 — Requests section in FriendsTab

Above the friends list in `FriendsTab`:

- Load `GET friends/pending` alongside `loadFriends` (same polling cycle).
- When non-empty: `SectionHeader("Friend requests")` + card per requester:
  avatar/initial, name, rating, buttons **Accept** (filled) / **Decline**
  (text). Accept → existing `acceptFriendRequest` (finally give it a caller),
  then refresh both lists. Decline → new VM method → `declineFriendRequest`
  endpoint, refresh pending.
- When empty: section absent (no empty-state card — the tab already has one).

### T2 — Badge on the Friends tab

Show a count badge on the Lobby "Friends" tab label when pending requests
exist (Material3 `Badge`), cleared as requests are handled.

### T3 — Remove friend

On each friend row (`PlayerCard` area, `LobbyScreen.kt:303-305` region): add
an overflow menu (⋮) with **Remove friend** → confirm dialog ("Remove {name}
from your chess mates? You can add them again anytime.") → new VM method →
`DELETE friends/{id}`, refresh list. Keep Challenge as the primary action —
removal must not be a one-tap.

### T4 — Error copy

All new failure paths use `friendlyError(...)` (`ErrorCopy.kt`) — no raw
`e.message` (S11 gate applies).

## Acceptance criteria (RELEASE build, prod)

⚠️ Master-plan guardrail 4 (don't pollute prod): use the test account plus a
second throwaway/guest-registered account for the request round-trip; clean up
(remove friendship) afterwards.

1. Account B sends a request to account A (from web or a second device);
   Android account A sees it in "Friend requests" within one polling cycle,
   with a tab badge.
2. Accept → requester appears in the friends list; badge clears.
3. Decline (second request) → disappears; requester NOT in friends list.
4. Remove friend → confirm → gone from list; re-search still finds the user
   with "Add Friend" available again.
5. Airplane mode: tab still renders friends from last successful load or the
   existing empty state; no raw errors.
6. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S13-*.png`.
