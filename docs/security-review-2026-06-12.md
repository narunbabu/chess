# Security Review — Chess99 (2026-06-12)

Scope: `chess-backend` (Laravel 12), `chess-frontend` (React 18), `chess99-android` (native Kotlin). Read-only audit; key findings spot-verified in source. Severity: Critical > High > Medium > Low.

---

## Remediation status (updated 2026-06-18)

| Finding | Status | Where |
|---------|--------|-------|
| C1 Razorpay mock bypass | ✅ Fixed | commit `eb75740` |
| H3 Public debug routes | ✅ Fixed | commit `eb75740` |
| H4 Storage path traversal | ✅ Fixed | commit `eb75740` |
| H5 Championship XSS | ✅ Fixed | commit `eb75740` |
| H2 Move/rating forgery | ✅ Fixed | commit `d1f9df3` (server-authoritative; new `RatingService`; REST move endpoint removed) |
| M3 Debug files in `public/` | ✅ Fixed | deleted `diagnostic.js`, `test-resume-websocket.html`, `test-unfinished.html` |
| M4 PII/payload logging | ✅ Fixed | SocialAuth/Auth/Subscription/Razorpay — log identifiers only, drop full payloads/profiles/OAuth-callback input |
| M5 Broad User `$fillable` | ✅ Fixed | `role` removed from `$fillable` (no legit setter); privileged fields documented |
| L1 `window.open` noopener | ✅ Fixed | 12 call sites across 7 files now pass `noopener,noreferrer` |
| L2 `SESSION_SECURE_COOKIE` | ✅ Fixed | defaults to secure in production |
| (new) Global error handler | ✅ Fixed | `bootstrap/app.php` catch-all forced **all** exceptions to 500 (broke 422/404 semantics), **leaked file/line** in API responses, and **logged the Authorization bearer token** (full request headers). Now defers framework exceptions and logs identifiers only. |
| M1 OAuth token in URL | ✅ Fixed | token delivered in URL **fragment** (`/auth/callback#token=`) not query; SPA reads `location.hash` then strips it from history; `sanctum.expiration` now defaults to 30d (was non-expiring) |
| M6 WS relay participation | ✅ Fixed | `WebSocketController::broadcastMove` now 403s non-players (mirrors `getRoomState`); `joinGame` already authorizes via `GameRoomService::canUserJoinGame`. Trimmed full-payload debug log to identifiers |
| M7 Android BODY logging | ✅ Fixed | `NetworkModule.kt` → `Level.HEADERS` + `redactHeader("Authorization"/"Cookie")` |
| M8 Android allowBackup | ✅ Fixed | `AndroidManifest.xml` → `allowBackup="false"` |
| L3 Referral admin allowlist | ✅ Fixed | `ReferralController::isAdmin` now role-based (`platform_admin`, owner-email bootstrap fallback); hardcoded `ADMIN_EMAILS` removed |
| L4 Android PII logs | ✅ Fixed | `GoogleSignInHelper` (drop email/name), `DeepLinkHandler` (log scheme/host only — full URI carried reset token) |
| L5 Android release WS_KEY | ✅ Fixed | `build.gradle.kts` release injects `WS_KEY` from `-PWS_KEY_RELEASE`/env (no hardcoded secret; empty fails loudly) |
| L8 Android path matching | ✅ Fixed | `AuthInterceptor` now segment-boundary matching (EXACT vs PREFIX public paths); fixes token drop on `/championships/{id}/register` |
| L6 Trainer Gemini key | ✅ Mitigated | `vite.config.ts` build-guard throws on a production build that would inline the key (opt-out `ALLOW_INSECURE_GEMINI_KEY=true`); full server-side proxy still required before any public deploy |
| L7 react-scripts audit | ✅ Audited + partial fix | **DOMPurify bumped 3.3.0 → 3.4.8** (clears the XSS-bypass advisories that underpin H5); audit 49 → 36 advisories. Remaining axios/react-router highs have no non-breaking fix; CRA→Vite migration deferred. See "L7 audit" below |
| M2 Token in localStorage | ⤴ Deferred | XSS sinks (H5) already closed. Full httpOnly-cookie + CSRF migration rewrites web+mobile+WS auth — tracked as a separate dedicated effort, not done here |
| H1 Rotate leaked secrets | ⏳ Pending | **manual** — rotate creds + scrub `.env.onserver` |

Fixes are committed on local `master`, not yet pushed/deployed (deploys route through ServerMigrationAgent).

### L7 audit (`pnpm audit --prod`, 2026-06-18)
49 advisories: **16 high, 29 moderate, 4 low**. Most are transitive under `react-scripts@5.0.1` (CRA, unmaintained), but several are direct deps upgradable without a Vite migration:
- **DOMPurify** `^3.3.0` → **bumped to 3.4.8** ✅ (cleared the XSS-bypass advisories; this underpins the H5 fix). Audit dropped 49 → 36.
- **axios** `^1.12.2` — multiple high (SSRF/NO_PROXY bypass, proxy-auth credential leak, prototype-pollution, ReDoS). Already at the latest 1.x; **no non-breaking patch available** — revisit when a fixed 1.x or a vetted 2.x ships.
- **react-router-dom** `^6.30.0` — high (XSS via open redirect). Already latest 6.x; fix only in 7.x (breaking) — defer to the routing-upgrade project.
- Transitive (`ws`, `socket.io`, `form-data`, `yaml`, `follow-redirects`) — resolve via the above or `pnpm overrides`.

Recommended sequence: (1) bump dompurify, axios, react-router-dom + add `pnpm overrides` for transitive; (2) full E2E; (3) plan CRA→Vite migration as a separate project to clear the remaining react-scripts chain.

---

## Critical

### C1. Razorpay mock mode defaults ON — full payment bypass in production
- `chess-backend/config/services.php:66` — `'mock_mode' => env('RAZORPAY_MOCK_MODE', true)`
- Production env (`.env.onserver`) sets no `RAZORPAY_MOCK_MODE` and no Razorpay keys → mock mode is active in production.
- Impact:
  - `RazorpayService::verifyPaymentSignature()` (RazorpayService.php:111) returns `true` unconditionally → free championship entries (`ChampionshipPaymentController::handleCallback`).
  - `SubscriptionService::verifyAndActivate()` (SubscriptionService.php:184) skips HMAC check → free paid subscriptions.
  - With `webhook_secret` unset, `verifyWebhookSignature()` (RazorpayService.php:272-279) computes HMAC with a null key — forgeable by anyone.
- Fix: default `mock_mode` to `false`; fail closed (throw) if keys/webhook secret are empty in production; set real `RAZORPAY_*` values + `RAZORPAY_MOCK_MODE=false` on the server.

## High

### H1. Live production secrets in plaintext in repo working tree
- `.env.onserver:46-67` — real Gmail app password, Google OAuth client secret, Facebook app secret, Gemini API key, `REVERB_APP_SECRET`, `APP_KEY`.
- Gitignored but on-disk; anyone with repo/disk access has production credentials.
- Fix: **rotate all of these credentials**, scrub `.env.onserver` / `.env.server` to placeholders, keep production secrets only on the server.

### H2. No server-side move validation — rated games and Elo forgeable
- `GameController.php:495-539` (`move`) writes client-supplied `fen`/`from`/`to` directly, no legality check against prior position, no finished-game check. `chesslablab/php-chess` is installed but unused here.
- Relatedly, `/rating/update` is fed fully client-assembled data (`chess-frontend/src/services/ratingService.js:18`, `GameCompletionAnimation.js:181-217`): `result`, `opponent_rating`, `computer_level` — rating farming if not recomputed server-side.
- Fix: validate each move server-side from stored FEN; reject moves on finished games; recompute result/opponent rating server-side, ignore client values.

### H3. Public debug routes leak config and server internals
- `routes/api.php:514` `/debug/oauth-config` (OAuth client id, redirect URLs, env), `:525` `/debug/avatar-storage` (storage paths, permissions, OS user), `:506` `/public-test`, `:642` `/debug-test`.
- No auth, live in production. Fix: delete (or gate behind admin auth + non-production env check).

### H4. Path traversal in `/storage/{path}` route
- `routes/web.php:14-46` — `where('path', '.*')`, no `basename`/`realpath` containment → `/storage/..%2f..%2f.env` style reads of arbitrary files. Also logs every hit (noise + info leak via logs).
- Fix: `realpath()` and verify result stays under `storage/app/public`; or remove the route in production (nginx serves storage).

### H5. Stored XSS via championship instructions
- `chess-frontend/src/components/championship/MatchSchedulingCard.jsx:465,473` — API-sourced HTML rendered via `dangerouslySetInnerHTML` without sanitization. If organizers can author these fields, this is stored XSS in every participant's browser — and with the token in localStorage (M2), full account takeover.
- Fix: wrap with `DOMPurify.sanitize()` (dompurify 3.3.0 already a dependency; `LessonPlayer.jsx:315` does this correctly).

## Medium

### M1. OAuth token in URL + non-expiring Sanctum tokens
- `SocialAuthController.php:179` redirects with `?token=...` (leaks via Referer/history/logs); `config/sanctum.php:49` `'expiration' => null`.
- Fix: one-time code exchange or URL fragment; set finite `SANCTUM_TOKEN_EXPIRATION`.

### M2. Auth token in localStorage
- `AuthContext.js:254` — any XSS = token theft = account takeover. Long-term: httpOnly cookie + CSRF. Short-term: eliminate XSS sinks (H5).

### M3. Debug/test files shipped in frontend `public/`
- `public/test-resume-websocket.html`, `public/diagnostic.js` (reads `auth_token`, eval-from-network pattern in header comment), `public/test-unfinished.html` — deployed to site root. Fix: delete or exclude from production build.

### M4. PII / payload logging (backend)
- `SocialAuthController.php:114-119,192` (full Google profile + request input), `SubscriptionController.php:252`, `RazorpayService.php:343,400` (full webhook payloads), `UserController.php:56-62` (IP/UA). Violates the project's own "never log PII" rule. Fix: log identifiers only.

### M5. Overly broad `$fillable` on User model
- `User.php:24-81` — `role`, `rating`, `peak_rating`, `subscription_tier`, `subscription_expires_at` mass-assignable. Currently shielded by explicit validation, but one careless `update($request->all())` away from privilege escalation. Fix: guard privileged fields.

### M6. WebSocket relay endpoints don't re-verify game participation
- `WebSocketController.php:111+` — `joinGame`/`broadcastMove` validate game exists but not that `Auth::id()` is a player. Channel subscription auth is correct; HTTP relays should match. Fix: assert participation per endpoint.

### M7. Android: BODY-level HTTP logging in debug builds
- `chess99-android .../di/NetworkModule.kt:29-34` — logs Bearer tokens and passwords to logcat (debug builds only). Fix: `Level.HEADERS` + `redactHeader("Authorization")`.

### M8. Android: `allowBackup="true"` with no extraction rules
- `AndroidManifest.xml:12` — app data eligible for backup extraction. Fix: `allowBackup="false"` or `dataExtractionRules` excluding secure prefs + Room DB.

## Low

- L1. `window.open(..., '_blank')` without `noopener` in ~8 frontend files (AmbassadorDashboard, LeaderboardPage, GameCompletionAnimation, GameEndCard, GameReview, shareUtils) — reverse tabnabbing. Add `'noopener,noreferrer'`.
- L2. `SESSION_SECURE_COOKIE` unset in production (`config/session.php:172`). Set `true`.
- L3. Referral admin gated by hardcoded email allowlist (`ReferralController.php:16-19`) instead of role middleware.
- L4. Android: Google email/name logged on sign-in (`GoogleSignInHelper.kt:79`); full deep-link URI incl. password-reset token logged (`DeepLinkHandler.kt:46`). Debug-only, but remove.
- L5. Android: release build has empty `WS_KEY` (`app/build.gradle.kts:27`) — prod WebSockets broken in release APK; inject per-env keys at build time.
- L6. Tactical trainer inlines `GEMINI_API_KEY` into client bundle (`chess-tactical-progression-trainer/vite.config.ts:11`) — proxy server-side before any public deploy.
- L7. `react-scripts@5.0.1` unmaintained; run `pnpm audit` and plan a Vite migration.
- L8. Android `AuthInterceptor.kt:23,47-55` substring-matches public paths — drops token on e.g. `/championships/{id}/register` (fails safe, but causes 401 bugs).

## Verified clean

CORS allowlist (no wildcard with credentials), password reset flow (hashed tokens, expiry, `hash_equals`), no SQL injection found, Razorpay client flow is server-authoritative on amount, payment race conditions guarded with `lockForUpdate`, chat rendering auto-escaped, no eval/dynamic code in frontend, Android token storage uses EncryptedSharedPreferences + Keystore, App Links verified for password-reset deep link, R8 enabled, no real secrets committed to git.

## Top priorities (ranked)

1. ~~**C1** — disable Razorpay mock mode in production; fail closed~~ ✅ done (`eb75740`)
2. **H1** — rotate all leaked credentials in `.env.onserver` (manual; still outstanding)
3. ~~**H3 + H4** — remove debug routes and fix `/storage/{path}` traversal~~ ✅ done (`eb75740`)
4. ~~**H5** — sanitize championship instructions HTML~~ ✅ done (`eb75740`)
5. ~~**H2** — server-side move + rating validation~~ ✅ done (`d1f9df3`)

### Remaining after the 2026-06-18 pass
All code findings (M1, M6, M7, M8, L3, L4, L5, L6, L8) are now fixed. Still open:
- **H1** rotate leaked secrets in `.env.onserver` (manual — highest remaining).
- **M2** httpOnly-cookie + CSRF auth migration (deferred; tracked separately).
- **L7** dependency upgrades: bump **DOMPurify ≥3.4.8** first (underpins H5), then axios / react-router-dom; CRA→Vite migration as its own project.
- **L6** stand up a server-side Gemini proxy before the standalone trainer is ever publicly deployed (build-guard now blocks an inlined-key prod build in the meantime).
