# S16 — Web session stability + small web fixes (P1, Web)

**Added 2026-07-15** from the gap analysis (§5: "repeated full-page navigation
to authenticated routes intermittently bounces to a logged-out guard despite a
valid stored token"). Root-caused 2026-07-15 to **three compounding
mechanisms** — this spec fixes all three plus three small adjacent web bugs
found during the same investigation.

## Root causes (verified, with code)

1. **AuthContext destroys a valid token on ANY fetch error**
   (`src/contexts/AuthContext.js:234-241`): the `fetchUser()` catch block does
   `localStorage.removeItem("auth_token")` on network flakes, timeouts, and
   5xx — not just 401. One slow page load = logged out for real.
2. **Global axios 401 interceptor hard-redirects with a full page load**
   (`src/services/api.js:19-32`): any single 401 from the many parallel
   boot-time calls (SubscriptionContext, EntitlementContext, AppDataContext,
   presence, `/games/active`…) removes the token and sets
   `window.location.href = "/login"` — even on public pages like `/privacy`
   where those providers still fire.
3. **Per-page redirects don't wait for auth hydration**: e.g.
   `BecomeAmbassador.js:56-60` redirects when `user` is null without checking
   `loading` — on a hard navigation `user` is always null until `GET /user`
   returns. (AuthContext DOES expose `loading`, initial `true`, cleared in
   `finally` at :243; `RouteGuard.js:37-46` even handles it correctly — but
   RouteGuard is inert: `requireAuth` defaults false and the `AUTH_GATES`
   feature flag defaults off, `FeatureFlagsContext.js:8-14`.)

## Tasks

### T1 — AuthContext: only 401 clears the token

In the `fetchUser()` catch: clear token + auth state **only when
`error.response?.status === 401`**. On network error/timeout/5xx: keep the
token, keep any existing user state, schedule ONE retry (~3 s), and leave
`isAuthenticated` untouched if it was already true. Log via console.warn.

### T2 — Interceptor: stop nuking sessions from background calls

`api.js`: (a) keep the 401 handling but use SPA navigation
(`window.location.href` → history-based redirect or event the app handles) and
only when a token actually existed; (b) mark boot-time/background context
calls (Subscription, Entitlement, AppData, presence/heartbeat, Dashboard
widgets) with the existing `skipAuthRedirect` config flag so a 401 there
degrades the widget, not the session; (c) never fire the redirect while
AuthContext is still hydrating (export a hydration flag or timestamp guard).

### T3 — Hydration-aware page guards

Audit every component-level redirect keyed on `user`/`isAuthenticated`
(`grep -rn "navigate('/login" src/` + `!user` patterns): each must early-return
while `loading` is true, using the RouteGuard `:37-46` pattern as the
template. Confirmed offender: `BecomeAmbassador.js:56-60`.

### T4 — Small adjacent fixes (same files, found during root-causing)

1. **Wrong token keys**: `BecomeAmbassador.js:32,80` read
   `localStorage.getItem('chess99_token') || localStorage.getItem('token')` —
   the app uses `auth_token`; its API calls send `Bearer null`. Fix to the
   shared `api` instance (which injects the header) rather than raw fetch.
2. **PGN double-prefix**: `GameReview.js:1022-1052` calls
   `api.get('/api/v1/games/${id}/pgn')` but the `api` baseURL already ends in
   `/api` (`config.js:4-7`) → requests `/api/api/v1/...` and 404s, silently
   falling back to client-side generation. Fix path to `/v1/games/${id}/pgn`
   so the server PGN (richer headers, opening detection) is actually used.
3. **FriendsPage pending badge lies**: `FriendsPage.js:134` builds
   `pendingSentIds` from the *incoming* pending list, so search results badge
   "Request Pending" on people who sent YOU a request. Either rename/rewire
   the badge to "Sent you a request" semantics or drop it (no outgoing-pending
   endpoint exists).

## Verification (MANDATORY gates per CLAUDE.md)

```powershell
powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess-frontend'; pnpm build; pnpm lint; pnpm typecheck"
powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess-frontend'; pnpm test:e2e"
```

Plus a targeted Playwright check (extend
`tests/e2e/research-web-tour.spec.js` or add
`tests/e2e/session-stability.spec.js`): log in, then hard-navigate
(`page.goto`, not client-side) to `/dashboard`, `/profile`, `/friends`,
`/privacy`, `/terms`, `/dashboard` — **10 iterations**; assert never bounced
to `/login` and `auth_token` still present. Also simulate one failed `GET
/user` (route abort) and assert the token survives.

## Acceptance criteria

1. The 10× hard-navigation loop passes locally (and against prod after the
   standard deployment pipeline — not from this pane).
2. A single aborted/failed `GET /user` no longer clears `auth_token`;
   a genuine 401 still logs out cleanly.
3. Public pages (`/privacy`, `/terms`) never redirect to `/login` for a
   logged-out visitor, and never destroy a logged-in visitor's session.
4. GameReview "Download PGN" hits `/api/v1/games/{id}/pgn` (200, network tab)
   — server PGN, not the fallback.
5. BecomeAmbassador API calls carry a real bearer token.
6. All quality gates green (build, lint, typecheck, e2e suites).
