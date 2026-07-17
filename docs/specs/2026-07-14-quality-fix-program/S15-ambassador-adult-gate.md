# S15 — Ambassador adult gate (P1, Backend + both clients)

**Added 2026-07-15** from the gap analysis (§5: adult-gating missing on BOTH
platforms → fix at the backend so both clients inherit it). This is a
kid-safety item on a platform marketed "ages 5–18": today **any logged-in
child can enroll as a commission-earning ambassador and submit bank
account/UPI details in one POST.**

## Facts (verified 2026-07-15)

- No age or consent check anywhere: `AmbassadorController.php` — `selfAssign`
  :305-335 (any user gets the role), `apply` :437-482 (validates only
  name/mobile/upi_id/reason), `payoutRequest` :361-420 (**collects bank
  account/IFSC/UPI from any user**), `dashboard` :27-184 (full commission
  schedule to anyone authenticated).
- Routes: `routes/api_v1.php:380-387` and legacy `routes/api.php:407-412`
  (comment at :406 literally says "any authenticated user").
- The User model is already gate-ready (`app/Models/User.php`): `birthday`
  (fillable :61, date cast :131), **`is_minor`** (:141-144, `age < 18`),
  **`is_under_13`** (:147-150), **`needs_birthday`** (:153-156) — all three
  appended to every serialized user "so clients can gate age-sensitive UI"
  (:98-106). `guardian_email`/`guardian_consent_at` exist (:63-64, :133).
- Web pages: `AmbassadorDashboard.js` (role check only, :69),
  `BecomeAmbassador.js` (no gate; also has the wrong-token-key bug — fixed in
  S16). Android: Ambassador drawer entry, no gate.
- **No schema change needed** (per CLAUDE.md, schema changes would need owner
  approval — this spec requires none).

## Tasks

### T1 — Backend middleware (the real fix)

New `app/Http/Middleware/EnsureAdult.php`:

- Deny when `$user->is_minor || $user->needs_birthday` — **fail closed on
  unknown birthday** for a financial feature.
- Response: 403 JSON
  `{ "error": "adult_only", "message": "The Ambassador program is only available to adults (18+)." }`
  — machine-readable code so clients can branch.
- Register alias `adult` in `bootstrap/app.php` (:100-106, next to
  `role`/`admin.dashboard`); apply to BOTH ambassador route groups
  (`api_v1.php:380`, `api.php:407`). Admin ambassador routes keep their
  existing admin middleware.
- Explicitly out of scope: a guardian-consent enrollment path for minors
  (`guardian_consent_at` exists if the owner ever wants it) — note it in the
  completion report, do not build.

### T2 — PHPUnit feature tests

`tests/Feature/AmbassadorAdultGateTest.php`: minor (birthday < 18y) → 403
with `adult_only` on `self-assign`, `apply`, `payout-request`, `dashboard`;
user with null birthday → 403; adult → passes (200/existing behavior);
existing minor ambassadors (if any) also blocked from `payout-request`.
Run `php artisan test`. **No migrations.**

### T3 — Web client handling

- Hide the "Become an Ambassador" pitch/CTA and any Ambassador nav entry when
  `user.is_minor || user.needs_birthday` (fields already on the user object).
- `AmbassadorDashboard.js` / `BecomeAmbassador.js`: on 403 `adult_only`,
  render a friendly full-page notice ("The Ambassador program is for adults
  (18+).") instead of an error toast.
- Gate `pnpm build` green.

### T4 — Android client handling

- Hide the Ambassador drawer item when `is_minor || needs_birthday` (parse the
  fields into the user model if not already mapped).
- Ambassador screen: on 403 `adult_only`, friendly full-screen notice, no raw
  error. Uses `friendlyError` conventions.

## Acceptance criteria

1. Backend: all four user-facing ambassador endpoints return 403 `adult_only`
   for a minor AND for a null-birthday user; adults unaffected.
   `php artisan test` green (new tests included), no migrations.
2. Web (local build): minor account sees no ambassador entry points; direct
   `/ambassador` navigation shows the friendly notice. `pnpm build` green.
3. Android (RELEASE build): minor account has no Ambassador drawer item;
   deep-navigation shows the friendly notice.
   `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S15-*.png`.
4. **Deployment note:** backend gate must deploy BEFORE or WITH client
   releases (clients degrade gracefully either way since the gate is
   server-side). Never deploy from this pane — standard pipeline applies.
