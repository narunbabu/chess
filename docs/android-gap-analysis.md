# Chess99 Android Gap Analysis

**Date**: 2026-04-26
**Compared**: `chess-frontend/` (React web) vs `chess99-android/` (Kotlin/Compose)
**Status**: Android has 11/13 phases complete; gaps identified below

---

## Summary

| Category | Web Status | Android Status | Gaps |
|----------|-----------|----------------|------|
| Auth | Complete | Complete (Google+Apple, no Facebook) | 1 |
| Gameplay | Complete | Complete | 0 |
| Real-time/WebSocket | Complete | Complete | 0 |
| Matchmaking | Complete | Complete | 0 |
| Invitations | Complete | Complete | 0 |
| Tournaments | Complete | Complete | 0 |
| Profile | Complete | Complete (partial org support) | 1 |
| Payments | Complete | Complete | 0 |
| Learning | Complete | Complete (no staged tactical trainer) | 1 |
| Replays/History | Complete | Complete (no move analysis) | 1 |
| Social | Complete | Complete | 0 |
| Companion Mode | Complete | **Missing** | 1 |
| CCT Analysis | Complete | **Missing** | 1 |
| Admin/Ambassador | Complete | **Missing** | 1 |
| Organization Mgmt | Complete | **Partial** (field only, no dashboard) | 1 |
| Settings/Customization | Complete | Complete | 0 |
| Notifications | Complete | Complete | 0 |
| Deep Links | N/A (web) | Complete | 0 |
| SEO/Health | N/A (web only) | N/A | 0 |
| **Total Gaps** | | | **8** |

---

## Auth

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 1 | Facebook OAuth | P2 | `Socialite` Facebook provider, button on login/register | Not implemented; Google Sign-In works, Apple Sign-In structure exists | Add Facebook SDK dependency, implement `FacebookSignInHelper` similar to `GoogleSignInHelper.kt`, wire into `AuthViewModel` login/register flows. Backend already supports Facebook via Socialite. |

---

## Gameplay

No gaps. Android has full chess engine (`ChessGame.kt`), board UI (`ChessBoardView.kt`), timers (`GameTimerDisplay.kt`), resign/draw/game-end flows, rated/casual modes, and undo system.

---

## Real-time/WebSocket

No gaps. Android has `GameWebSocketService.kt` + `PusherManager.kt` with auto-reconnection, move sync, presence, chat, and polling fallback.

---

## Matchmaking

No gaps. Android has `MatchmakingApi.kt`, lobby matchmaking tab, queue with cancel, rating-based pairing, and time control selection.

---

## Invitations

No gaps. Android has `GlobalInvitationManager.kt` + `GlobalInvitationDialog.kt` for cross-app invitations, plus `NewGameRequestDialog.kt` for friend challenges.

---

## Tournaments

No gaps. Android has full championship support: `ChampionshipListScreen/VM`, `ChampionshipDetailScreen`, `ChampionshipInvitationsScreen/VM`, creation, joining, Swiss/Elimination/Round Robin formats, and entry fees.

---

## Profile

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 2 | Profile quick-edit (inline name/avatar) | P2 | `AvatarQuickEdit.js`, `NameQuickEdit.js` with inline editing in header | Avatar upload exists in `ProfileScreen.kt`; no inline quick-edit from header/nav | Add inline tap-to-edit on avatar/name in the top bar or dashboard. Reuse existing `ProfileApi.kt` update endpoint. Low effort, nice-to-have UX improvement. |

---

## Payments/Monetization

No gaps. Android has `PricingScreen.kt`, `SubscriptionScreen.kt`, `RazorpayCheckout.kt`, `PaymentViewModel.kt`, `SubscriptionRepository.kt`, and mock mode. 3-tier Free/Pro/Gold with FAQ section.

---

## Learning & Training

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 3 | Tactical Progression Trainer (staged puzzles) | P1 | `TacticalPuzzleBoard.js`, `TacticalTrainer.js`, `TacticalTrainerDashboard.js`, 4 stages with sequential unlock, Lichess puzzle data (`stage{1..4}_puzzles.json`), badge awards, leaderboard integration | Android has `PuzzleScreen.kt` + `PuzzleViewModel.kt` with basic puzzles, but no staged progression system, no sequential unlock, no badge awards | Port the staged puzzle system: create `TacticalTrainerScreen/VM`, bundle stage JSON data as assets, implement sequential unlock logic, add badge display. Backend endpoints (`GET /api/v1/tactical/progress`, `GET /api/v1/tactical/stage/{n}`) already exist. ~3-4 days effort. |
| 4 | Tutorial lesson content parity | P2 | Web has rich interactive lessons with animated board demonstrations, multiple lesson types per module | Android has `TutorialLessonScreen.kt` but lesson content may not match web's latest interactive lesson content | Verify lesson API responses match between web and Android. Content is API-driven, so mostly a presentation-layer concern. Ensure all lesson types (animated, interactive, quiz) render on Android. |

---

## Replays & History

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 5 | Post-game move analysis & evaluation | P1 | `GameReview.js` with move-by-move evaluation scores, opening detection (`MoveAnalysisService.php`), accuracy percentage, brilliant/great/inaccuracy/mistake/blunder classification | Android has `GameReviewScreen.kt` with move navigation but no evaluation scores, no opening detection, no accuracy metrics | Integrate Stockfish analysis in `GameReviewScreen.kt`: run engine on each position, classify moves (brilliant/blunder/etc), display accuracy %. Can use local `StockfishEngine.kt` for analysis. Backend `GET /api/v1/games/{id}/analysis` endpoint may exist; check and consume if available. ~2-3 days. |
| 6 | PGN export/download | P2 | `GET /api/v1/games/{id}/pgn` endpoint + Download PGN button on review page | Android has `GameReviewScreen.kt` but no PGN export button | Call `GET /api/v1/games/{id}/pgn`, save to Downloads via `MediaStore`, add export button to review screen. ~0.5 day. |

---

## Social

No gaps. Android has `LeaderboardScreen/VM`, `GameEndCard.kt`, `ShareManager.kt`, `SharedResultScreen/VM`, `RatingChangeNotification.kt`, friends management, and referral system (`ReferralDashboardScreen/VM`).

---

## Companion Mode

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 7 | AI Companion Mode | P0 | `CompanionControls.jsx` + `CompanionSelector.jsx` — AI plays on user's behalf (not as opponent), casual games only, companion selector UI with synthetic player list | **Completely missing** — no companion UI, no synthetic player selection, no "play for me" mode | **Highest-impact gap.** Core differentiating feature. Implement: (1) `CompanionSelectorScreen.kt` — fetch synthetic players via `GET /api/v1/synthetic-players`, display list with difficulty/ELO; (2) `CompanionControls.kt` — bottom sheet during game with enable/disable, move suggestion; (3) Wire into `PlayMultiplayerViewModel.kt` to receive companion moves via WebSocket event `companion.move`. Backend already supports companion mode. ~3-5 days. |

---

## CCT Analysis

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 8 | CCT In-Game Analysis Panel | P1 | `CCTPanel.jsx` + `cctAnalysis.js` + `computeCCT.js` — Checks, Captures, Threats detection, best-move arrows, threat warnings, safe move indicators, two-phase scoring with badges | **Completely missing** — no analysis panel, no move arrows, no threat detection | Implement as a collapsible panel in `PlayMultiplayerScreen.kt`: (1) `CCTPanel.kt` — Compose panel showing checks/captures/threats counts; (2) Integrate `StockfishEngine.kt` for position analysis (MultiPV top moves); (3) Draw arrows on `ChessBoardView.kt` using `Canvas` overlay for best move visualization; (4) Two-phase scoring: threshold gate + score badges (pending → complete). ~4-5 days. |

---

## Admin/Ambassador

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 9 | Ambassador Dashboard | P2 | `AmbassadorDashboard.js` — referral tracking, commission management, performance metrics, ambassador tools | **Missing** — no ambassador UI | Low priority for mobile. Most ambassadors will use web dashboard. If needed: create `AmbassadorScreen.kt` consuming `AmbassadorController` API endpoints. ~2 days. |

---

## Organization Management

| # | Gap | Priority | Web Feature | Android State | Implementation Notes |
|---|-----|----------|-------------|---------------|---------------------|
| 10 | Organization Dashboard | P2 | `OrganizationDashboard.js` — org management, member invitation (by email), pending invites list, accept/reject UI for invitees, admin delegation | Android has `organization` field in `ProfileViewModel.kt`/`ProfileApi.kt` but no org dashboard, no invitation flow, no member management | Create `OrganizationScreen.kt` + `OrganizationApi.kt` consuming existing backend endpoints: `GET /api/v1/organizations/{id}`, `POST /api/v1/organizations/{id}/invite`, `GET /api/v1/organizations/{id}/invitations`, `POST /api/v1/organization-invitations/{id}/accept`, `POST /api/v1/organization-invitations/{id}/reject`. ~3-4 days. |

---

## Settings & Customization

No gaps. Android has `BoardCustomizerSheet.kt` with 12 board themes, piece style selection, sound toggle (`SoundManager.kt`), and notification preferences.

---

## Notifications

No gaps. Android has `Chess99FirebaseMessagingService.kt` + `NotificationHelper.kt` with FCM push notifications, multiple channels (game/tournament/social/system), and badge counts.

---

## Deep Links

No gaps (web equivalent: URL routing). Android has `DeepLinkHandler.kt` handling `chess99://` scheme and web URLs for games, tournaments, profiles, referral codes, and password reset.

---

## Feature Flags

No gaps. Android has `FeatureFlagManager.kt` with remote config, caching, auto-refresh, and known flags (multiplayer, tournaments, payments, chat, ai_analysis).

---

## Implementation Priority Roadmap

### P0 — Must Have (Core UX gaps)
1. **Companion Mode** (#7) — 3-5 days — Key differentiating feature, backend ready

### P1 — Should Have (Feature parity gaps)
2. **CCT Analysis Panel** (#8) — 4-5 days — Learning tool, increases engagement
3. **Post-game Move Analysis** (#5) — 2-3 days — Standard chess app expectation
4. **Tactical Progression Trainer** (#3) — 3-4 days — Learning feature with retention value

### P2 — Nice to Have (Polish gaps)
5. **PGN Export** (#6) — 0.5 day — Quick win
6. **Facebook OAuth** (#1) — 1-2 days — Expands auth options
7. **Organization Dashboard** (#10) — 3-4 days — Admin feature, web-first
8. **Ambassador Dashboard** (#9) — 2 days — Web-first, low mobile priority
9. **Profile Quick-Edit** (#2) — 1 day — UX polish
10. **Tutorial Content Parity** (#4) — 1-2 days — Verify and align

### Total Estimated Effort
- **P0**: ~4 days
- **P1**: ~10 days
- **P2**: ~9 days
- **Grand total**: ~23 days (3-4 weeks)

---

*Generated by gap analysis between `chess-frontend/` (React) and `chess99-android/` (Kotlin/Compose) on 2026-04-26.*
