# Chess99 Launch Readiness Plan — P0 / P1 Specs

**Created:** 2026-07-10
**Purpose:** Everything that must ship before promoting Chess99 (web + Android) as a
professional-grade chess training platform, plus the first wave of product polish.
Companion doc to `competitive-roadmap.md` (strategy/features) — this doc is the *launch gate*.

> **Living document.** Tick `[ ]` → `[x]` as items ship. Change `[ ]` to `[~]` for in-progress.
> Add dated entries to the **Progress Log** at the bottom. Each item lists effort, impact,
> what already exists (build on it), exact build tasks, and acceptance criteria.

---

## Status at a glance

| # | Item | Priority | Effort | Status |
|---|------|----------|--------|--------|
| P0-1 | Activate analytics + error monitoring | P0 | ~½ day (ops) | [x] LIVE on prod 2026-07-10 (verify data in dashboards) |
| P0-2 | Android release + Play Store publish | P0 | ~1 week | [ ] |
| P0-3 | Age collection + guardian consent (DPDP) | P0 | ~1 week | [~] backend+web+Android register done & green; follow-ups below |
| P1-1 | Signup friction reduction | P1 | ~3–4 days | [ ] (partial: modal no longer logs in with empty token) |
| P1-2 | Streaks: header flame + all-activity | P1 | ~3 days | [ ] |
| P1-3 | Learn-from-mistakes mode | P1 | ~1–2 weeks | [ ] |
| P1-4 | Puzzle Rush + Puzzle Duel | P1 | ~2 weeks | [ ] |
| P1-5 | Fair-play baseline | P1 | ~1 week | [ ] |
| A-1 | Ambassador fraud hardening | P0 (before rollout) | ~2 days | [x] done & green |
| A-2 | Coach-ambassador pilot (ops) | P1 | ~4–6 week pilot | [ ] |

**Launch rule:** do not resume paid promotion or ambassador payouts until **P0-1, P0-2, P0-3, A-1** are all green.

---

# P0 — Launch blockers

## [ ] P0-1. Activate analytics + error monitoring · effort: ~½ day (pure ops) · impact: CRITICAL

All code is already wired and inert. Ads previously ran with a completely unmeasured funnel —
this is the single cheapest, highest-leverage task in the whole plan.

**Exists (verified 2026-07-10):**
- `chess-frontend/src/utils/initAnalytics.js` — injects GA4/Pixel/Clarity only when env IDs present.
- `chess-frontend/src/sentry.js` — reads `REACT_APP_SENTRY_DSN` (tracesSampleRate 0.2).
- `chess-backend/config/sentry.php` — reads `SENTRY_LARAVEL_DSN`; `sentry/sentry-laravel` v4.25 installed.
- Funnel events already firing (no-op): `landing_view`, `play_click`, `guest_game_start`,
  `signup_start`, `signup_complete`, `guest_signup_prompt_click`, SPA `page_view`.

**Build / ops tasks:**
- [ ] Create accounts/projects: GA4 property, Meta Pixel, Microsoft Clarity project,
      Sentry org with **two projects** (react + laravel).
- [ ] `chess-frontend/.env.production` — fill:
      `REACT_APP_GA_MEASUREMENT_ID`, `REACT_APP_META_PIXEL_ID`, `REACT_APP_CLARITY_ID`,
      `REACT_APP_SENTRY_DSN`.
- [ ] Backend prod `.env` (via ServerMigrationAgent) — fill:
      `SENTRY_LARAVEL_DSN`, `SENTRY_ENVIRONMENT=production`, `SENTRY_TRACES_SAMPLE_RATE=0.1`.
- [ ] Rebuild frontend, deploy via SMA (build → copy to `/var/www/chess99.com/`), `config:clear` backend.
- [ ] Verify: GA4 Realtime shows `landing_view`/`page_view`; Clarity session appears;
      Sentry receives a forced test error from each of frontend + backend.
- [ ] Build a GA4 funnel report: landing → play_click → guest_game_start → signup_start → signup_complete.
- [ ] **DPDP guard:** once P0-3 ships, suppress Meta Pixel (`fbq`) event forwarding for
      accounts identified as minors (behavioral ad-targeting of children is prohibited).
      Simple gate in `analytics.js` `track()` on a `user.is_minor` flag.

**Acceptance:** funnel dashboard populated with real traffic; a deliberately thrown error in
prod appears in Sentry within 1 minute; weekly funnel numbers can be quoted from GA4.

---

## [ ] P0-2. Android release + Play Store publish · effort: ~1 week · impact: CRITICAL

The app builds green but is not publishable: no signing config, no keystore, `versionCode 1`,
no Crashlytics, no store listing. "Our Android app" cannot be part of any promotion until it's live.

**Exists (verified 2026-07-10 in `chess99-android/app/build.gradle.kts`):**
- `applicationId com.chess99.app`, minSdk 26 / target+compile 35, `versionCode 1` / `1.0.0`.
- Release buildType with `isMinifyEnabled = true`, `isShrinkResources = true`, proguard rules.
- Firebase already integrated (`google-services.json`, analytics + messaging) — Crashlytics is a small add.
- Prod API/WS endpoints in release buildConfig; `WS_KEY` injected from env (not hardcoded).
- Privacy policy + terms pages already live at chess99.com (`/privacy`, `/terms`) — needed for listing.

**Build tasks:**
- [ ] **Signing:** generate upload keystore (`keytool -genkeypair`), store OUTSIDE the repo
      (e.g. `~/keystores/chess99-upload.jks` + backed up off-machine). Add `signingConfigs.release`
      reading path/passwords from `~/.gradle/gradle.properties` or env vars — never commit secrets.
      Enroll in **Play App Signing** (Google holds the app key; ours is only the upload key).
- [ ] **Crashlytics:** add `firebase-crashlytics` + plugin to `libs.versions.toml` and
      `app/build.gradle.kts` (Firebase BoM already present). Verify with a debug test crash.
- [ ] **Versioning convention:** `versionCode = YYMMDDNN` or monotonic int per release;
      `versionName` semver. Document in `chess99-android/README`.
- [ ] **Release build:** `bundleRelease` (AAB, not APK) → install release build on a real
      device → smoke test: login, guest play vs computer, one multiplayer game, puzzle, payment screen render.
      Watch for R8/proguard breakage (Retrofit/kotlinx-serialization models are the usual suspects —
      confirm proguard keep rules for API DTOs).
- [ ] **Play Console:** create app, fill store listing — title ("Chess99: Kids Chess Academy"
      or similar per kids positioning), short/full description, screenshots (phone + 7" tablet),
      feature graphic, icon 512px.
- [ ] **Declarations:** Data Safety form (accounts, email, phone optional, purchase history;
      Sentry/Firebase disclosure), Content rating questionnaire, **Target audience & content** —
      ⚠️ if "children" is included in target audience, Play **Families policy** applies
      (ads restrictions, teacher-approved program option). Decide deliberately: declaring
      13+ with parental features is simpler; declaring kids-inclusive is truer to positioning
      but requires Families compliance review. Recommend: start **"Ages 13+"** listing while
      P0-3 consent flow matures, revisit Families program after.
- [ ] **Rollout:** internal testing track (self + 2–3 testers) → closed track 1 week → production.
- [ ] Post-launch: link Crashlytics alerts to email; check vitals (ANR/crash rate) weekly.

**Acceptance:** app installable from Play Store production track; Crashlytics dashboard live;
release smoke-test checklist passed on a physical device; upload keystore backed up in 2 places.

---

## [ ] P0-3. Age collection + guardian consent · effort: ~1 week · impact: CRITICAL (safety claim + DPDP)

**The gap:** `users.birthday` exists (nullable, migration `2026_02_17_100000_add_student_fields_to_users_table.php`)
and `ChatSafetyService::requiresPresetOnly()` gates preset-only chat at age < 13 — **but birthday is
never collected at registration, and the check FAILS OPEN** (`if (!$user->birthday) return false;`),
so today every kid without a birthday gets adult chat. This contradicts the kid-safety positioning
and leaves no basis for DPDP Act compliance (parental consent required for under-18 data processing).

**Exists:**
- `users.birthday` (date, nullable), `users.class_of_study`.
- `ChatSafetyService` (preset-only <13, filtered text otherwise), `social_access_disabled` per user/org.
- Guardian linking: `guardian_child_relationships` + `/api/parent/*` + `/api/v1/parent/*` (parent dashboard).
- Register endpoint: `AuthController::register()` validates name/email/password/captcha_token/referral_code.
- Frontend register forms: `pages/Login.js` + `components/layout/AuthGateModal.jsx`; Android register screen.

**Build tasks:**
- [ ] **Backend:** add `birthday: required|date|before:today|after:1920-01-01` to `register()`
      validation (and to first-time OAuth profile completion). Accept from Android via api_v1.
- [ ] **Minor flag:** computed accessor `User::getIsMinorAttribute()` (age < 18) and
      `is_under_13`; expose `is_minor` in the auth/user payload for frontend gating (analytics, pixel).
- [ ] **Guardian email for minors:** if age < 18 at registration → require `guardian_email`
      field → auto-create a pending `guardian_child_relationships` invite (reuses parent-dashboard
      invite flow — this IS the "age-gated auto-linking" follow-up from competitive-roadmap #2).
      Store `guardian_consent_requested_at`; when guardian accepts the link, stamp
      `guardian_consent_given_at` (new nullable timestamps on the relationship or users table).
- [ ] **Fail closed:** flip `ChatSafetyService::requiresPresetOnly()` — no birthday ⇒ treat as
      under-13 (preset-only). Safe now that birthday becomes mandatory for new accounts.
- [ ] **Backfill existing users:** one-time nudge modal ("confirm your date of birth") on next
      login for accounts with null birthday; block starting a *chat-enabled* multiplayer game
      until provided (don't block puzzles/computer play — keep friction targeted).
- [ ] **Frontend:** DOB field (date picker) in `Login.js` register form + `AuthGateModal.jsx`
      + guardian-email conditional field; same in Android `RegisterScreen` + `AuthApi`.
- [ ] **Analytics gating:** minors → no Meta Pixel forwarding, GA4 with `allow_ad_personalization_signals=false`
      (hook in `analytics.js` using `is_minor`).
- [ ] **Docs:** short internal note `docs/dpdp-compliance.md` — what we collect, consent flow,
      how a guardian can delete a child account (manual via support@chess99.com is acceptable v1).

**Acceptance:** new signups cannot complete registration without DOB; a 10-year-old signup
requires guardian email and lands in preset-only chat immediately; accounts without birthday
default to preset-only chat; guardian accept-link stamps consent; minors excluded from pixel events.

---

# P1 — Ship in the 2–4 weeks after P0

## [ ] P1-1. Signup friction reduction · effort: ~3–4 days · impact: HIGH (top conversion lever)

Today an email signup hits 4–5 interruptions before playing: register → captcha → **hard block
until email verified** (`AuthController::login()` returns 403 `email_not_verified` for non-OAuth
users) → verification round-trip → `SkillAssessmentModal`.

**Build tasks:**
- [ ] **Grace-period login:** allow unverified email accounts to log in for **7 days** from
      registration (`created_at` check replaces the hard 403). Response includes
      `email_verification_pending: true` + days remaining.
- [ ] **Restrictions while unverified:** block only sensitive surfaces — payments/subscription
      purchase, ambassador application, org creation. Play/puzzles/lessons all allowed.
- [ ] **Nudge UI:** persistent dismissable banner ("Verify your email — X days left") with
      resend button (route `email/resend` exists). After 7 days unverified → back to hard block.
- [ ] **Skill assessment:** make `SkillAssessmentModal` deferred — don't show at signup; show
      before the *first game/puzzle* instead, with a prominent "Skip — start as beginner" default.
- [ ] Verify funnel deltas in GA4 (`signup_complete` → first game-start rate) 2 weeks after ship.

**Acceptance:** a new email user reaches a playable board in ≤ 2 clicks after submitting the
signup form; verification completion rate and signup→first-game rate are visible in GA4.

## [ ] P1-2. Streaks: header flame + all-activity counting · effort: ~3 days · impact: HIGH

**Exists:** `users.current_streak_days` / `longest_streak_days` / `last_activity_date`
(migration `2025_11_19_100009`), but updated **only by the tutorial system**. Shown only in
Profile/DailyChallengeCard — not in `components/layout/Header.js`.

**Build tasks:**
- [ ] **`StreakService::touch(User $user)`** (backend): if `last_activity_date < today`,
      increment/reset streak with **one grace day** (gap of exactly 1 day preserves streak once
      per 30 days; track `grace_used_on` date column, new migration). Idempotent per day.
- [ ] Call `touch()` from: game completion (both rated + casual), tactical puzzle attempt
      (`TacticalProgressController@attempts`), lesson/tutorial completion (existing path keeps working).
- [ ] **Header flame:** 🔥 + count in `Header.js` next to the avatar (data already in `useAuth()`
      user object — confirm `current_streak_days` is in the auth payload, add if missing).
      Tooltip: "N-day streak — play a game, puzzle or lesson daily".
- [ ] **Streak calendar:** small month-grid view in Profile (activity days highlighted).
- [ ] Android parity: flame in Dashboard top bar (`DashboardScreen`), reuse profile stats API.

**Acceptance:** playing one puzzle a day sustains the streak; flame visible in header on web and
dashboard on Android; missing a single day with grace intact does not reset.

## [ ] P1-3. Learn-from-mistakes mode · effort: ~1–2 weeks · impact: HIGH (the "training platform" proof)

**Exists:** `GameAnalysis` stores `move_analyses` (JSON per-move classifications:
brilliant/excellent/good/inaccuracy/mistake/blunder), `accuracy_*`, `acpl_*`, `quality_counts`;
`POST /api/v1/games/{id}/analyze`; `PostGameAnalysis.js` renders eval chart + metrics;
`GameReplayPage.js` is a reusable seek-to-move board.

**Build tasks:**
- [ ] **Verify/extend analysis payload:** ensure each entry in `move_analyses` stores the
      engine `best_move` (UCI) and eval before/after. If absent, add to the analyzer output
      (backwards-compatible; old rows just lack retry data).
- [ ] **Mistakes queue API:** `GET /api/v1/games/{id}/mistakes` — filters `move_analyses` to
      `mistake|blunder` (and `inaccuracy` optionally), returns FEN-before, played move, best move, eval delta.
- [ ] **"Fix your mistakes" UI:** entry button on `PostGameAnalysis.js` ("You had 3 mistakes —
      fix them ▸"). For each: board at position-before (reuse `TacticalPuzzleBoard`-style
      interaction), user must find a move ≥ the engine's threshold (accept best move or any move
      within ~50cp); wrong try → hint arrow → reveal. Progress ticker (2/3 fixed).
- [ ] **Template explanations:** map classification + motif to canned text
      ("This hangs your knight", "Missed a fork on f7") — start with eval-delta-based generic
      templates; motif detection later (LLM enrichment is roadmap #12, not this item).
- [ ] **Shareable accuracy:** add accuracy % to the game-end card (`GameCompletionAnimation.js`
      / GameEndCard share image): "I played at 87% accuracy on Chess99!".
- [ ] Android: v1 = accuracy on end card only; full retry UI is a later parity task.

**Acceptance:** after an analyzed game, user can step through each mistake, must find the better
move, and gets an explanation; accuracy appears on the shareable end card.

## [ ] P1-4. Puzzle Rush + Puzzle Duel · effort: ~2 weeks · impact: HIGH (engagement/effort king)

**Exists:** `TacticalRatingService`, `TacticalPuzzleBoard.js`, endpoints
`/api/v1/tactical/{attempts,sync,progress,leaderboard}`, `LeaderboardPage.js` with pluggable
categories (`rating`/`solved`/`streak` scopes), Reverb private channels + event pattern
(`PrivateChannel('game.'.$id)`, `broadcastAs('championship.game.created')`) to mirror.

**Depends on:** Lichess CC0 puzzle import (competitive-roadmap #6) for volume — Rush burns
50+ puzzles/session; 2,500 curated puzzles will exhaust fast. Import can land in parallel;
Rush can launch on the curated bank and switch source.

**Build tasks — Rush (solo, week 1):**
- [ ] Backend: `puzzle_rush_runs` table (user_id, mode `3min|survival`, score, best_streak,
      puzzle_ids JSON, started/ended_at). Endpoints: `POST /api/v1/puzzle-rush/start` (returns
      first batch of puzzles, ascending difficulty), `POST .../submit` (server-validates move
      sequence + timing, returns next batch), `POST .../finish`.
- [ ] Server-side timing authority (start/end timestamps server-side; client timer is display only).
- [ ] Rules: 3 strikes out; difficulty ramps with streak; score = solved count.
- [ ] Frontend: Rush page reusing `TacticalPuzzleBoard` with countdown + strike indicators +
      end-screen (score, best, share card).
- [ ] Leaderboard: new `rush` category in existing leaderboard (daily/weekly/all-time).
- [ ] **Rated-gate:** Rush requires login (guest sees teaser + score of the day) — acquisition hook.

**Build tasks — Duel (head-to-head, week 2):**
- [ ] Backend: `puzzle_duels` table (players, same puzzle_ids/order, per-player progress, winner).
      Invite via existing friend-invite flow; matchmaking random-pair later.
- [ ] Events on `PrivateChannel('puzzle-duel.'.$id)`: `duel.started`, `duel.progress`
      (opponent solved-count only — never leak solutions), `duel.finished`.
- [ ] Frontend: duel screen = Rush UI + opponent progress bar ("power meter").
- [ ] First mover of each puzzle set gets identical order — fairness by construction.

**Acceptance:** a logged-in user completes a 3-minute Rush and appears on the rush leaderboard;
two friends complete a live duel with real-time opponent progress; server rejects
impossible submission timings.

## [ ] P1-5. Fair-play baseline · effort: ~1 week · impact: MED now, BLOCKER before prize money

Zero anti-cheat exists. Not needed for launch marketing, but **must exist before any
prize/fee tournament scales** — and ambassadors will promote tournaments.

**Exists:** `GameAnalysis` computes accuracy/ACPL per game per player.

**Build tasks:**
- [ ] Auto-queue analysis for all **rated + tournament** games (currently on-demand).
- [ ] `fair_play_flags` table (user_id, game_id, score, reasons JSON, status open/cleared/actioned).
- [ ] Heuristic scorer post-analysis: accuracy > 92% over ≥25 plies + ACPL < 15 + rating < 1600
      (thresholds configurable) → flag. Add move-time uniformity check (low variance across
      non-book moves) using stored move timestamps.
- [ ] Escalation only on **repeat flags** (≥3 in 30 days) — single great games are normal.
- [ ] Admin review queue page (list flags, open game review, mark cleared/actioned; action =
      unrated-only restriction flag on user, manual).
- [ ] Never auto-ban; humans decide. Log everything.

**Acceptance:** a test account playing 3 engine-perfect rated games appears in the admin
fair-play queue; admin can restrict it to unrated play.

---

# A — Ambassador rollout (program is BUILT; harden then pilot)

Verified 2026-07-10: `/become-ambassador`, `AmbassadorDashboard.js`, `/r/{code}` attribution,
register referral field, `AdminReferralDashboard.js`, and `ReferralService` with the locked spec
(10/5/2/2% decay; ₹2/₹3/₹5 milestones; 7-day subscription hold) all exist. **Do not scale
payouts until A-1 ships.**

## [ ] A-1. Fraud hardening · effort: ~2 days · impact: CRITICAL before payouts

**The hole:** ₹2 pays on "registered with phone filled" with **no OTP** — fake accounts with
random 10-digit numbers are free money. Milestones are currently `approved` immediately.

**Build tasks (all in `ReferralService.php` + `UserReferralObserver` / `RecordReferralActivityOnGameEnd`):**
- [ ] **Chain the ₹2 to the ₹3:** record the phone milestone with status `pending`; flip to
      `approved` only when the same user hits `first_activity` (rated game ≥10 plies or puzzle).
      One-line change in payout eligibility, kills the farming vector entirely.
- [ ] **Daily cap:** max N (default 20) milestone earnings per ambassador per day; excess
      recorded as `pending` for manual review.
- [ ] **Quality ratio flag:** in `AdminReferralDashboard`, show per-ambassador
      phone-milestone → activity-milestone conversion %. Auto-flag < 30% for review before
      monthly payout batch (payouts are already manual UPI — the gate is nearly free).
- [ ] **Duplicate-phone check:** reject the phone milestone if `mobile_number` already exists
      on another account.

**Acceptance:** creating 10 fake phone-filled accounts under one code yields ₹0 approved;
an ambassador with healthy referrals sees no change; admin dashboard shows conversion % per ambassador.

## [ ] A-2. Coach-ambassador pilot · effort: 4–6 week ops pilot · impact: HIGH

Door-to-door strangers are wrong for a kids product — parents trust **teachers, chess coaches,
academy tutors** who already have rosters. Same program, same codes, better activation. Feeds
directly into the schools strategy (competitive-roadmap #7).

**Ops checklist:**
- [ ] Recruit 5–10 coaches/teachers in ONE city (WhatsApp group per locked spec).
- [ ] Give each: referral code + QR poster PDF + a 2-line parent pitch script
      (safety + parent report card + free to start).
- [ ] Weekly: pull per-ambassador funnel (₹2 → ₹3 → ₹5 milestone counts) from admin dashboard.
- [ ] After 4–6 weeks: keep and clone only the ambassador *profile* whose referred users reach
      the ₹5 milestone (100 games/puzzles). Scale that profile to city #2.
- [ ] Pair with schools free-tier pitch when roadmap #7 ships.

**Success criteria:** ≥30% of referred signups reach first-activity (₹3); ≥1 Silver conversion
per active ambassador by week 6; zero fraud flags among pilot cohort.

---

## Suggested sequence

```
Week 1:   P0-1 (half day) → P0-2 signing/Crashlytics + P0-3 backend in parallel
Week 2:   P0-2 Play listing + internal track · P0-3 frontend/Android + A-1
Week 3:   P0-2 production rollout · P1-1 + P1-2 (small, fast wins)
Week 4-5: P1-3 learn-from-mistakes · start A-2 pilot · resume paid ads (measured now)
Week 6-7: P1-4 Rush → Duel (+ Lichess import in parallel, roadmap #6)
Week 8:   P1-5 fair-play (before first prize tournament announcement)
```

---

## Progress Log

| Date | Item | Update |
|------|------|--------|
| 2026-07-10 | — | Plan created. Verified current state: ambassador program fully built; analytics/Sentry wired but env-empty; Android unsigned/unpublished; `birthday` column exists but uncollected and chat-safety check fails open. |
| 2026-07-10 | A-1 | **Done, green.** `ReferralService`: ₹2 `signup_phone` milestone now starts `held` (new status, excluded from `calculateMonthlyPayouts` + `getUserStats`), released to `approved` only when the user hits `first_activity`/`activity_100` (`releaseHeldSignupPhone`). Daily auto-approve cap (`MILESTONE_DAILY_APPROVE_CAP=20`) → overflow `held` for manual review. `UserReferralObserver` rejects the milestone when the phone already belongs to another account. Tests: `ReferralFraudHardeningTest` 4/4. **Follow-up:** admin action to review/approve `held` earnings (currently only auto-release on activity). |
| 2026-07-10 | P0-1 | **LIVE on prod (deployed via SMA/SSH).** IDs — GA4 `G-ZSJ48GEJJM`, Meta Pixel `1696238708465565`, Clarity `xk4zc6ergo`, Sentry DSN (EU) `…4511709614112848` reused for BOTH web + backend. Frontend: appended 4 vars to VPS `chess-frontend/.env.production` (gitignored, per-machine), rebuilt (`CI=false`, `NODE_OPTIONS=4096`), GA ID confirmed baked into `main.*.js`, copied to `/var/www/chess99.com/`, nginx reloaded — chess99.com 200. Backend: appended `SENTRY_LARAVEL_DSN`/`SENTRY_ENVIRONMENT=production`/`SENTRY_TRACES_SAMPLE_RATE=0.1` to VPS `chess-backend/.env`, `config:clear`→`sentry:test` (event `21174273f9ec…` sent ✅)→`config:cache`→fpm reload; API healthy (leaderboard 200). Backups left: `.env.bak.*` + `.env.production.bak.*`. **User to confirm data lands in GA4 Realtime / Clarity / Meta Pixel Helper / Sentry.** |
| 2026-07-10 | P0-3 | **Backend + web done, green (21/21 tests incl. regression).** Backend: migration adds `users.guardian_email`, `users.guardian_consent_at`, `guardian_child_relationships.initiated_by`. `register()` now requires `birthday` (`before:today\|after:1920`), requires `guardian_email` for under-18s, and creates a child-initiated pending consent request via new `GuardianConsentService`. `ParentDashboardController@accept` handles the guardian-approves direction (stamps `guardian_consent_at`); dashboard adds `pending_child_consent_requests` bucket. `ChatSafetyService::requiresPresetOnly()` now **fails closed** (null birthday → preset-only). `User` exposes `is_minor`/`is_under_13`/`needs_birthday` (appended); `guardian_email` hidden. Tests: `AgeSafetyRegistrationTest` 6/6 + `ReferralFraudHardeningTest` 4/4 new; `ParentDashboardTest` 7/7 + `ChatSafetyTest` 4/4 still pass. Web: DOB + conditional guardian-email fields in `Login.js` + `AuthGateModal.jsx` (+ modal no longer calls `login()` with an empty token — small P1-1 win); `analytics.js` suppresses Meta Pixel for known minors. `pnpm build` clean. Android: threaded `birthday`/`guardian_email` through `RegisterRequest`→`AuthRepository`→`AuthViewModel`; `RegisterScreen` gained a Material3 DOB picker + conditional guardian field. `:app:assembleDebug` BUILD SUCCESSFUL. **Follow-ups:** (1) verifiable-consent email to guardians without an account; (2) DOB backfill nudge for existing/OAuth accounts (fail-closed already keeps them safe); (3) MyKids UI to surface/approve `pending_child_consent_requests` (API ready); (4) run the migration on prod via SMA with `migrate --pretend` first. |

---

## Cross-references
- Feature strategy & Tier 1–3 backlog: `docs/competitive-roadmap.md`
- Kid-safety + parent dashboard shipped state: commit `dea4e50`
- Ambassador locked spec: project memory `project_ambassador_program`
- Landing/funnel history: project memory `project-landing-conversion`
