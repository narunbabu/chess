# Chess99 Web vs Android — Gap Analysis

**Date:** 2026-07-15
**Method:** Live Playwright tour of chess99.com (22 screenshots, logged-out
landing + full logged-in nav walkthrough) + full source-code route inventory
of `chess-frontend/src/` (37 routes catalogued), cross-referenced against the
Android app's exhaustive review/fix history from 2026-07-14/15
(`2026_07_14_android_app_quality_review.md`, `2026_07_15_android_followup_review.md`,
and the S1-S10 spec program). Purpose: identify what to build, defer, or
deliberately not replicate on Android — decision NOT made here, this is the
input list only.

Artifacts: `chess-frontend/research-artifacts/web-tour/*.png` (22 files),
reusable script `chess-frontend/tests/e2e/research-web-tour.spec.js`.

---

## 1. Framing: web is a platform, Android is a consumer app

Web has 37 routes total — but a meaningful chunk are **admin/ops surfaces**
(`/admin/dashboard`, `/admin/referrals`, `/championships/:id/admin`,
`/championships/:id/matches/edit`, `/system-status`, `/health`,
`/coming-soon`, `/test/championship`) that no consumer-facing mobile app
should replicate. Stripping those, the *real* comparison surface is ~28
routes. This matters for scoping — "web has X routes, Android has Y" is not
itself a gap; only specific missing consumer-facing capability is.

---

## 2. Confirmed gaps — Android is missing something real

### Play / Online (the flagged item)
- **No synthetic/bot opponents in the online-play surface.** Web's Dashboard
  "Nearby Opponents" list explicitly uses **synthetic-player fallbacks for
  beginners** when the real pool is thin — i.e., the web already solves the
  exact liquidity problem Android's Lobby has ("0 online", bare empty
  state). This is already scoped as **spec S10** in the fix program, not yet
  built. **Refinement worth considering when building S10**: the web's proven
  pattern is a rating-filtered "Nearby Opponents" list with synthetic
  fallback woven directly in, not a 15-second wait-then-toast — mirroring
  that exact UX (rather than the original S10 draft's toast-offer approach)
  would match a design the product has already validated.
- **No "Active Games" / "Unfinished Games" resume section.** Web's Dashboard
  surfaces in-progress and abandoned games with one-tap Resume/Discard —
  Android's Home has no equivalent; a paused/interrupted game has no visible
  resume path from Home.
- **No "Nearby Opponents" list on Home at all** (distinct from Lobby's
  matchmaking queue) — web shows this directly on Dashboard as a low-friction
  "just tap a name" alternative to formal matchmaking.

### Onboarding / first impression
- **No landing/marketing page equivalent.** Web's logged-out `/` is a full
  conversion-oriented page: hero with a live playable board, "Learn chess the
  fun way" positioning, trust stats ("1,000+ Active Players · 50+ Countries
  · 10,000+ Games Played"), a 3-pillar Play/Learn/Compete summary, pricing
  tiers, and a safety disclaimer. Android's equivalent first-run experience
  is just the Login screen. **This is already spec S7** (first-run
  onboarding) — the web landing copy/structure above is ready-made source
  material for that spec's 3 onboarding pages (mirror the hero headline,
  trust stats, and Play/Learn/Compete framing directly).

### Learn
- **"Training Drills" may be a stub on Android.** Web's `/training` is a
  distinct feature from Tactical Trainer — skill-band-organized repeatable
  drills. Android's Learn→Training tab has an "Endgame Drills" entry that
  S5's own completion report explicitly flagged as untouched/unverified
  ("Left `Endgame Drills`/`Opening Explorer` cards untouched — not named as
  broken in the spec"). Needs a working-or-not check before deciding.
- **"Opening Explorer" — same status**, mentioned as a card but not verified
  working.

### Social
- **Friends is a tab, not a full page.** Web has a dedicated `/friends` with
  request management (pending, search, accept/remove). Android's Friends
  lives as one tab inside Lobby — likely thinner (search+add only, per
  earlier review notes) than web's full request-management flow. Worth a
  closer look, not confirmed broken.

### Game history / analysis
- **No PGN export found on Android.** Web's `/history` and `/game/:id`
  support PGN download; no evidence of an equivalent Android action.

### Content
- **Profile's location hierarchy is richer on web**: country → state →
  district → mandal → village cascading picker, vs Android's simpler
  fields (relevant for India-specific school/organization matching —
  low priority unless organization-matching becomes a priority).
- **Ambassador poster/QR-code generator** (`/ambassador/poster`) and
  multi-language (incl. Telugu) share templates — web-only, not on Android.

---

## 3. Confirmed at rough parity — don't spend time here

- **Companion Mode, CCT (Chess Coaching Tool) analysis panel** — both
  platforms have these; Android was ported from web intentionally.
- **Tactical Trainer** — both platforms bundle the *same* puzzle JSON
  client-side and work offline; genuinely equivalent (and now
  chess-correct on both, after S1).
- **Organizations** — Android's `OrganizationsViewModel` already has
  search, create, open/members, and invite — closer to web's feature set
  than assumed. Only the empty-state polish was flagged (S9 item 7), not a
  missing capability.
- **Daily Challenges** (track selection + the challenge itself), **board
  theme picker**, **avatar picker**, **Championships browse/register/invite**,
  **Leaderboard**, **Referral dashboard**, **Ambassador dashboard** (minus
  poster/QR) — all present on both, matched against the same backend API.
- **In-game chat** — implemented on both (2026-02-23 web, ported to Android).
- **Interactive lesson content** — same backend (`/tutorial/*`), and as of
  S5 both clients read the contract correctly; web's "player paths" rating-band
  segmentation may be a presentation-layer richness gap worth a look, but the
  underlying content and progress tracking are shared and working.

---

## 4. Intentionally different — do NOT replicate

- **Full pricing/billing UI** (`/pricing`, `/account/subscription`,
  Razorpay checkout) — Android's minimal "My Plan" (view status only, no
  purchase flow, honest "not available in this app" notice) is the
  **correct, Play-Store-compliant** design. Building a purchase flow here
  would violate Play Billing policy. Keep as-is.
- **Admin dashboard, tournament admin, referral admin** — ops tooling for
  staff, not end users. No mobile need.
- **System status / health / coming-soon / test pages** — infra/dev
  artifacts, not product surface.

---

## 5. Notable findings (not gaps, but worth knowing)

- **Android's "My Kids" (parent dashboard) may currently be AHEAD of web.**
  The live tour found web's `/parent` route exists in source
  (`Header.js`/`App.js`, matching the active branch
  `feat/tier1-kid-safety-parent-dashboard`) but is **not reachable on
  production** — the nav item is absent from the deployed bundle and direct
  navigation bounces to the login guard. Android's My Kids screen, by
  contrast, was called out in the original Android review as "excellent...
  clear value copy, child-must-approve linking, real empty state" and is
  live. Worth confirming web's parent dashboard deploy status before
  assuming web is the reference implementation here.
- **The E-Book is broken on BOTH platforms.** Web's live `/ebook` throws the
  app's generic error boundary in production right now. Android's S4 spec
  removed it entirely from v1 rather than ship a broken WebView — in
  hindsight, the more honest call, not a regression vs a working web feature.
- **Web has its own session-stability bug**: repeated full-page navigation
  to several authenticated routes (`/dashboard`, `/profile`, `/settings`,
  `/parent`, `/privacy`, `/terms`) intermittently bounces to a logged-out
  guard screen despite a valid stored token — looks like an AuthContext
  race, not a true logout. Worth a backend/frontend ticket independent of
  the Android work.
- **Ambassador adult-gating is missing on both platforms**, not just
  Android. S9 item 10 already flags this for Android (a commission-earning
  program shouldn't be surfaced to children); the web tour found no
  evidence of an age/parent gate on `/ambassador` or `/become-ambassador`
  either. If this gets prioritized, it may need a backend-level fix so both
  clients inherit it.

---

## 6. Suggested next step

This is the input list, not a decision. Natural groupings for a
build/defer/drop conversation:
1. **Build now (extends existing specs)**: S10 synthetic opponents (refined
   per §2), S7 onboarding (content is ready from the landing page), a
   Home "resume active/unfinished games" section.
2. **Investigate before deciding**: Training Drills / Opening Explorer
   (stub or real?), Friends tab depth, PGN export demand.
3. **Low priority / defer indefinitely**: location hierarchy depth,
   ambassador poster/QR/multi-language.
4. **Don't build**: admin tooling, billing UI, system-status pages.
5. **Cross-platform fix, not Android-specific**: ambassador adult-gating,
   web's session-stability bug.
