# Web vs Android Parity Report — Cluster 4: Dashboard + Tournaments

**Date:** 2026-07-17
**Scope:** Dashboard (`Dashboard.js` ↔ `DashboardScreen.kt`) and Championships/Tournaments.
**Verdict:** Dashboard is roughly at parity with a handful of WEB-only widgets. Tournaments have a **large ANDROID-MISSING gap** — Android has a solid read/browse/register/basic-organizer shell, but the entire **player-side match lifecycle** (scheduling negotiation, play-a-match, report result, resume/challenge requests, live updates) is absent.

Tags: **WEB-MISSING** (web lacks it), **ANDROID-MISSING** (Android lacks it), **DIVERGENT** (both have it, behave differently).

---

## 1. Dashboard

| Item | Web (`Dashboard.js`) | Android (`DashboardScreen.kt` / `DashboardViewModel.kt`) | Gap | Key files |
|------|----------------------|----------------------------------------------------------|-----|-----------|
| Welcome header (name + avatar) | ✅ Name only in header | ✅ Avatar + "Welcome back" + name | Parity (Android slightly richer) | both |
| Rating display | ✅ In stats grid (current rating tile) | ✅ Dedicated Rating card w/ **peak rating + "All-time high!" badge + trend icon** | DIVERGENT — Android has a nicer rating card; web shows peak only inside Progress modal | — |
| Quick stats (games / win rate / streak) | ✅ Full stats section: games, win%, avg score, rating, W/L/D, streak | ✅ 3 mini-cards: games, win rate, streak | DIVERGENT — web also shows **avg score, wins, losses, draws** as tiles | — |
| Quick actions | ✅ Play Online (hero), vs Computer, vs Friend, Learn, Championships | ✅ Computer, Online, Learn, Tournaments | Parity (web has extra vs-Friend + hero quick-match) | `PlayOnlineButton` |
| Recent games list | ✅ Rich cards: result, opponent+rating, mode badge, opening name, time-ago, Review btn, "Load 10 more" | ✅ Cards: result, opponent, time control, rating change, "See All" | DIVERGENT — web shows opening name, mode badges, review; Android shows rating delta | — |
| Active (multiplayer) games | ✅ Section w/ resume + **abandon** stale game | ❌ Not on dashboard | **ANDROID-MISSING** — no active-games section w/ abandon | `Dashboard.js:789` |
| Unfinished games | ✅ Section w/ resume + discard, per-game turn info | ⚠️ Single **prompt dialog** for first unfinished game only (resume/discard) | DIVERGENT — Android surfaces only one via modal; web lists all | `UnfinishedGamePrompt` |
| Daily challenge widget | ✅ `DailyChallengeCard` embedded on dashboard | ❌ Exists as **separate screen** (`DailyChallengesScreen.kt`), not on dashboard | DIVERGENT — feature exists on Android but not surfaced on dashboard | `components/daily/DailyChallengeCard.js` |
| Daily quota / upgrade strip | ✅ Free/Silver usage bar + "X left of N games" + upgrade CTA | ❌ Not on dashboard (has `UpgradePromptCard` elsewhere) | **ANDROID-MISSING** on dashboard | `Dashboard.js:632` |
| Nearby opponents / matchmaking | ✅ `PlayersList` (nearby real + synthetic bots) w/ rating-window filter + challenge; `MatchmakingQueue` modal | ❌ None on dashboard | **ANDROID-MISSING** | `lobby/PlayersList`, `lobby/MatchmakingQueue` |
| Progress charts | ✅ `ProgressChartsModal` (rating history + stats) launched from dashboard | ❌ Exists as `RatingHistoryScreen.kt` under Profile, not dashboard | DIVERGENT — reachable on Android but not from dashboard | `ProgressChartsModal.js` |
| Detailed stats modal | ✅ `DetailedStatsModal` from dashboard | ❌ Not from dashboard | **ANDROID-MISSING** (dashboard entry) | `DetailedStatsModal.js` |
| Skill-assessment prompt | ✅ Banner when rating==400 & 0 games → `SkillAssessmentModal` | ❌ None | **ANDROID-MISSING** | `auth/SkillAssessmentModal.js` |
| Admin section | ✅ Manage Tournaments / Platform Admin / Organizations cards (role-gated) | ❌ None | **ANDROID-MISSING** | `permissionHelpers.js` |
| Notifications | ❌ None on dashboard | ✅ Collapsible notifications section (mark-read/dismiss) — but **state is local/empty**, no feed source wired | **WEB-MISSING** (but Android's is a stub — no data source populates `notifications`) | `DashboardScreen.kt:229` |
| Ad banner | ✅ `AdBanner` | ❌ None | WEB-only (monetization) | `common/AdBanner` |
| Pull-to-refresh | ⚠️ Re-fetch on tab visibility | ✅ Material pull-to-refresh | DIVERGENT | — |

**Dashboard summary:** Core (rating, stats, quick actions, recent games) is at parity. Android is **missing several dashboard-surfaced widgets**: active-games w/ abandon, daily-quota upgrade strip, nearby-opponents/matchmaking, skill-assessment prompt, admin cards, and dashboard entry points to progress/detailed-stats. Android's notifications section is a **UI stub with no backing data**.

---

## 2. Tournaments / Championships

### Browse / Register / View (parity layer)

| Item | Web | Android | Gap | Key files |
|------|-----|---------|-----|-----------|
| List tournaments + filters | ✅ search, status, format, upcoming-only, my-champs, **archived** (admin) | ✅ search, status, format chips | DIVERGENT — web has my-champs & archived filters | `ChampionshipList.jsx` / `ChampionshipListScreen.kt` |
| Tournament card | ✅ format tooltip, time, participants, prize, entry fee, visibility, org, deadline urgency | ✅ format, time, participants, prize, entry fee, dates | Near-parity | both |
| Register (free) | ✅ | ✅ (`register`) | Parity | `ChampionshipApi.kt:46` |
| Register (paid, Razorpay) | ✅ full Razorpay SDK checkout + mock mode + callback | ⚠️ `registerWithPayment` endpoint declared in API, but **list/detail screens only call free `register`** — no Razorpay checkout UI | **ANDROID-MISSING** paid-entry checkout flow | `ChampionshipDetails.jsx:183`, `ChampionshipListScreen.kt:187` |
| Tournament-contact gate (mobile+consent before register) | ✅ `TournamentContactModal` pre-check | ❌ None | **ANDROID-MISSING** | `TournamentContactModal.jsx` |
| Detail tabs | ✅ Overview, Participants, Standings, Matches, My Matches, Manage | ✅ Overview, Players, Standings, Matches | DIVERGENT — Android lacks **My Matches** & **Manage** tabs | both |
| Standings | ✅ sortable, tiebreak toggle (Buchholz/SB/rating), streaks, medals, stats summary | ✅ rank, pts, W/D/L, rating, medals, buchholz field parsed | Near-parity (web richer sorting/tiebreak UI) | `ChampionshipStandings.jsx` |
| Round leaderboard | ✅ `RoundLeaderboardModal` per-round | ❌ None | **ANDROID-MISSING** | `RoundLeaderboardModal.jsx` |
| Matches (view by round) | ✅ | ✅ grouped by round, tap → game | Parity for viewing | both |

### Organizer / Admin layer

| Item | Web | Android | Gap | Key files |
|------|-----|---------|-----|-----------|
| Create tournament | ✅ `CreateChampionshipModal` (rich: prizes, visibility, org, schedule, rounds) | ✅ basic dialog (name, format, max, time, fee, desc) | DIVERGENT — web far richer config | `CreateChampionshipModal.jsx` |
| Edit tournament | ✅ | ❌ None | **ANDROID-MISSING** | — |
| Archive / restore / force-delete | ✅ full lifecycle (soft delete, restore, platform-admin hard delete) | ❌ None | **ANDROID-MISSING** | `ChampionshipList.jsx` |
| Start / pause / resume / complete | ✅ all four transitions | ⚠️ **Start** only (`startChampionship`) | **ANDROID-MISSING** pause/resume/complete | `ChampionshipDetailScreen.kt:215` |
| Generate pairings / full tournament | ✅ `PairingManager`, `PairingPreview`, generate-full, schedule-next | ⚠️ `generateFullTournament` + `scheduleNextRound` buttons (no preview) | DIVERGENT — Android fires blind, web previews first | `PairingManager.jsx` |
| Admin dashboards | ✅ `TournamentAdminDashboard`, `TournamentManagementDashboard` (stats, analytics, invitations tab, settings, maintenance, health) | ❌ None | **ANDROID-MISSING** | `TournamentAdminDashboard.jsx` |
| Manual reschedule / send match invitation (admin) | ✅ | ❌ None | **ANDROID-MISSING** | `ChampionshipMatchController` |

### Player-side match lifecycle — **the big gap**

| Item | Web | Android | Gap | Key files |
|------|-----|---------|-----|-----------|
| Schedule negotiation (propose / accept / counter-propose time, quick slots, deadlines) | ✅ `MatchSchedulingCard`, `ChampionshipSchedule.jsx` — full workflow | ❌ None | **ANDROID-MISSING** | `MatchSchedulingCard.jsx`, `ChampionshipSchedule.jsx` |
| Play a tournament match (create game / play-now / request-play / resume) | ✅ create-game, challenge, play-immediate, resume-request accept/decline | ⚠️ Matches tab only **navigates to an existing game** if `gameId` present — cannot initiate/create/schedule | **ANDROID-MISSING** | `ChampionshipMatches.jsx` |
| Report match result (win/draw/loss + agreement) | ✅ | ⚠️ `submitMatchResult` endpoint declared in API but **no UI calls it** | **ANDROID-MISSING** | `ChampionshipApi.kt:93` |
| My Matches (cross-tournament + per-tournament) | ✅ `my-matches` tab + `/championship-matches/my-matches` | ⚠️ `getMyMatches` endpoint declared, **no screen** | **ANDROID-MISSING** | `ChampionshipApi.kt:70` |
| Tournament invitations | ✅ `ChampionshipInvitations.jsx` + context (accept w/ color choice, decline) | ✅ `ChampionshipInvitationsScreen.kt` (accept/decline) | Near-parity (web adds desired-color) | both |
| Live updates (schedule updated, match scheduled, game created, timeout warnings, round completed) | ✅ 5 WebSocket events via `ChampionshipInvitationContext` + browser notifications | ❌ No championship WebSocket listeners; refresh-button only | **ANDROID-MISSING** | `ChampionshipInvitationContext.jsx` |
| Championship instructions/rules | ✅ shown in scheduling card | ⚠️ `getInstructions` endpoint declared, no UI | **ANDROID-MISSING** | `ChampionshipApi.kt:73` |

**Tournaments summary:** Android implements **browse → register(free) → view detail (overview/players/standings/matches) → accept invite → basic organizer start/generate**. It is **missing the entire competitive play loop**: no time-scheduling negotiation, no way to start/play/report a tournament match from the app, no My Matches, no round leaderboard, no live/WebSocket updates, no paid-entry checkout, no admin management dashboards, and no edit/archive/pause/complete lifecycle. Several endpoints are already declared in `ChampionshipApi.kt` (`submitMatchResult`, `getMyMatches`, `getInstructions`, `registerWithPayment`) but have **no UI wired to them**.

---

## Backend note
The backend exposes a full championship API (see route table): match scheduling (`.../schedule/propose|accept|propose-alternative|confirm|play-immediate`), match play (`.../matches/{match}/game|challenge|notify-start|resume-request/accept|decline|result|can-play`), pairing generation, admin lifecycle (`/admin/tournaments/{id}/start|pause|resume|complete`), analytics/health, and payment. **Web consumes nearly all of it; Android consumes a small subset.** The gap is Android-client-side, not backend.
