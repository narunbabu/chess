# S7 — First-run onboarding (P1, Android)

**Amended 2026-07-15** (gap analysis §2): web's production landing page is the
validated source material for this spec's copy. Verbatim from
`chess-frontend/src/pages/LandingPage.js` (lines noted):

- Eyebrow (:262-264): **"Safe online chess academy · Ages 5–18"**
- Hero (:265-268): **"Learn chess the fun way 🏆"**
- Subhead (:269-273): *"A safe, friendly place for kids and teens to learn and
  play chess — guided lessons, fun puzzles, and real games against players
  their level."*
- Trust stats (:314-327): **"1,000+ Active Players · 50+ Countries · 10,000+
  Games Played"**; trust line (:290-292): "Join 1,000+ young players ·
  beginner-friendly · no pressure"
- Pillars (:328-368): **Play** — "vs Computer or Friends"; **Learn** —
  "Lessons & Tutorials"; **Compete** — "Tournaments & Rankings"
- Guest subtext (:216-234): "Quick casual game — your rating & progress won't
  be saved"

Use this to finalize T1's page copy: page 1 = hero headline + subhead (add the
eyebrow as a small overline); page 2 = the three pillars framing; page 3 =
safety/parents message + trust stats as a small footer row. The draft copy
below remains acceptable where it already matches; where it differs, prefer
the web-verbatim wording above. Do NOT show pricing in onboarding (Play
Billing policy — Android has no purchase flow).

## Problem (review §3.20)

A brand-new install opens directly on the Login screen, which greets the child
with **"Welcome back"** — zero value pitch, no distinct "I'm new here" path
(screenshot `51`). Benchmarks (Duolingo, ChessKid) run 2–3 playful value
screens then split "Get started" vs "I have an account". Guest mode exists
(good) but is buried at the bottom of the login form.

## Tasks

### T1 — Onboarding pager (first run only)

New `presentation/onboarding/OnboardingScreen.kt` + `Screen.Onboarding` route:

- `HorizontalPager` (androidx.compose.foundation.pager), 3 pages, page dots,
  "Skip" top-right. Each page: large icon/illustration area (reuse existing
  assets: `R.drawable.ic_launcher_foreground` logo for page 1, the bundled
  piece PNGs `piece_wn`/`piece_wq` composed decoratively for pages 2–3 — no
  new art required), headline `headlineMedium` bold, body `bodyLarge`,
  brand-gradient background like the Home hero (reuse
  `Brush.linearGradient(listOf(ChessGreen, ChessDarkGreen))`).
- Copy (kid + parent voice):
  1. **"Learn chess the fun way"** — "Lessons, puzzles and games built for
     young players."
  2. **"Play and improve every day"** — "Solve daily challenges, earn XP and
     climb the leaderboard."
  3. **"Safe for kids. Loved by parents."** — "Kid-safe chat controls and a
     parent dashboard keep you in charge."
- Bottom buttons (all pages): primary filled **"Get started"** → Register;
  text button **"I already have an account"** → Login; on page 3 add secondary
  outlined **"Try as guest"** → the existing guest flow (same callback Login
  uses for `onPlayAsGuest`).

### T2 — Show once

- Persist `onboarding_seen` with Jetpack DataStore (check for an existing
  DataStore/preferences wrapper in the codebase — e.g. anything under `data/
  local/` or a `FeatureFlagManager` — and reuse its storage rather than adding
  a second store).
- Start-destination logic (wherever the NavGraph start destination / splash
  decision lives): authenticated → Home; not authenticated && !onboarding_seen
  → Onboarding; else → Login. Set `onboarding_seen = true` when the user
  leaves onboarding by any path (Skip included).

### T3 — Copy touch-ups on auth screens

- Login: keep "Welcome back" (it's correct there now that only returning users
  land on it).
- Register: under the birthday field add microcopy (`bodySmall`,
  onSurfaceVariant): **"We use birthdays to keep chat safe for kids."**
- Forgot Password: top-align the content under the app bar (today it floats at
  vertical center-bottom, screenshot `53`).

## Acceptance criteria (RELEASE build)

1. `adb shell pm clear com.chess99.app` → launch → onboarding pager shows;
   swiping through 3 pages works; dots track.
2. "Get started" → Register; "I already have an account" → Login; "Try as
   guest" enters guest play.
3. Relaunch after seeing it once → goes straight to Login (or Home if logged
   in). Onboarding never shows again.
4. Register shows the birthday microcopy.
5. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S7-page{1,2,3}.png`.
