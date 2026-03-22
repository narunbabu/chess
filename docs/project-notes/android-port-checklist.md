# Android Port Checklist — Web Features Missing from Android App

**Generated:** 2026-03-18
**Scope:** chess-frontend/ (React 18) → chess99-android/ (Kotlin/Compose)
**Method:** Systematic diff of all web routes, components, services, utils vs Android screens, ViewModels, APIs

---

## Legend

- ❌ = Not implemented at all
- ⚠️ = Partially implemented (basic version exists, missing key features)
- ✅ = Feature parity achieved
- 🔇 = Web-only by design (admin tools, landing page)

---

## 1. MISSING SCREENS & PAGES

### 1.1 Daily Challenge — Full Interactive Screen ❌
**Priority: P0 (Critical)**

Android has only a teaser card in LearnScreen. Web has a full interactive puzzle page.

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Full puzzle board with drag+click moves | `pages/DailyChallengePage.js:80-200` | ❌ |
| Move validation against solution | `pages/DailyChallengePage.js:210-260` | ❌ |
| Progressive hint system | `pages/DailyChallengePage.js:270-310` | ❌ |
| Show Solution button | `pages/DailyChallengePage.js:315-340` | ❌ |
| Timer (elapsed seconds) | `pages/DailyChallengePage.js:45-55` | ❌ |
| Attempt counter | `pages/DailyChallengePage.js:42` | ❌ |
| XP reward submission | `pages/DailyChallengePage.js:350-380` | ❌ |
| Streak tracking (daily continuity) | `pages/DailyChallengePage.js:390-420` | ❌ |
| Stats card (solved-by, success rate) | `pages/DailyChallengePage.js:430-470` | ❌ |
| Celebration overlay on completion | `pages/DailyChallengePage.js:480-510` | ❌ |

**API endpoints:**
- `GET /api/v1/tutorials/daily-challenge` → `TutorialApi.getDailyChallenge()`
- `POST /api/v1/tutorials/daily-challenge/complete`

**Android action:** Create `DailyChallengeScreen.kt` + `DailyChallengeViewModel.kt`, add `Screen.DailyChallenge` route.

---

### 1.2 Ambassador Dashboard ❌
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Enrollment form for non-ambassadors | `pages/AmbassadorDashboard.js:30-80` | ❌ |
| Commission tier display (10%–20%) | `pages/AmbassadorDashboard.js:85-130` | ❌ |
| Referral link + copy-to-clipboard | `pages/AmbassadorDashboard.js:135-160` | ❌ |
| QR code generation | `pages/AmbassadorDashboard.js:165-190` | ❌ |
| WhatsApp direct share | `pages/AmbassadorDashboard.js:195-220` | ❌ |
| Earnings breakdown by period | `pages/AmbassadorDashboard.js:225-280` | ❌ |
| Tier progression tracking | `pages/AmbassadorDashboard.js:285-340` | ❌ |
| Referred users list with status | `pages/AmbassadorDashboard.js:345-364` | ❌ |

**API endpoints:**
- `POST /api/v1/ambassador/enroll`
- `GET /api/v1/ambassador/stats`
- `GET /api/v1/ambassador/referrals`

**Android action:** Create `AmbassadorScreen.kt` + `AmbassadorViewModel.kt`, add to `Screen.kt` and `NavGraph.kt`.

---

### 1.3 Landing Page 🔇
**Priority: P3 (Nice-to-have, web-only acceptable)**

Web has marketing page with animated board, trust stats, pricing comparison. Android can skip this — users arrive via Play Store listing instead.

---

### 1.4 Admin Dashboard / Admin Referral Dashboard 🔇
**Priority: N/A (Web-only by design)**

Admin tools remain web-only. No Android port needed.

---

## 2. GAME PLAY FEATURES

### 2.1 Synthetic Opponent Chat System ❌
**Priority: P1 (High-impact engagement feature)**

Web has personality-driven AI chat during computer games. Android has zero implementation.

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| 6 bot personalities (aggressive, defensive, balanced, tactical, positional, default) | `utils/syntheticChatUtils.js:26-440` | ❌ |
| Personality-specific response probability (0.3–0.5) | `utils/syntheticChatUtils.js:7-14` | ❌ |
| Personality-based delay ranges (800ms–8000ms) | `utils/syntheticChatUtils.js:16-24` | ❌ |
| Game start messages (6 variants/personality) | `syntheticChatUtils.js:28-32, 105-109` etc. | ❌ |
| Move quality comments (good moves, blunders, captures) | `syntheticChatUtils.js:33-48` per personality | ❌ |
| Quick message responses (good luck, nice move, etc.) | `syntheticChatUtils.js:55-76` per personality | ❌ |
| Game end reactions (win/loss/draw) | `syntheticChatUtils.js:87-101` per personality | ❌ |
| Ping/nudge response messages | `syntheticChatUtils.js:82-86` per personality | ❌ |
| Auto-response logic with probability engine | `syntheticChatUtils.js:496-537` | ❌ |

**Android action:** Create `SyntheticChatManager.kt` in `data/` layer. Integrate with `PlayComputerViewModel.kt`.

---

### 2.2 In-Game Chat UI Enhancements ⚠️
**Priority: P1**

Android has basic chat panel in multiplayer. Web has rich chat with emoji, quick messages, ping.

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Quick message buttons (6 pre-defined) | `play/GameChat.js:173-194` | ❌ |
| Emoji picker (6 emojis: 👍🔥😮🤔💪😅) | `play/GameChat.js:244-282` | ❌ |
| Floating emoji animation (1.5s fade-up) | `play/GameChat.js:132-145` | ❌ |
| Ping/nudge button (appears after 5s idle) | `play/GameChat.js:148-168` | ❌ |
| Ping cooldown (30s with countdown) | `play/GameChat.js:46-70` | ❌ |
| Ping alert sound (800Hz sine, 0.3s) | `play/GameChat.js:53-66` | ❌ |
| Color-coded message borders | `play/GameChat.js:100-129` | ❌ |
| System messages (gray italic) | `play/GameChat.js:111-112` | ❌ |
| Chat unread badge on tab | `play/GameContainer.js:354-366` | ⚠️ |

**Android action:** Enhance `PlayMultiplayerScreen.kt` chat panel with quick messages, emoji, ping.

---

### 2.3 ELO-Based Think-Time Scaling ❌
**Priority: P1 (Makes AI feel realistic)**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| ELO→multiplier mapping (800→0.4×, 2800→1.8×) | `utils/computerMoveUtils.js:197-212` | ❌ |
| Personality-based time profiles | `utils/computerMoveUtils.js:188-194` | ❌ |
| Game phase multiplier (opening 0.5×, endgame 1.2×) | `utils/computerMoveUtils.js:239-254` | ❌ |
| Capture move delay bonus (+500-1500ms) | `utils/computerMoveUtils.js:264-265` | ❌ |
| Check delivery delay (+300-800ms) | `utils/computerMoveUtils.js:267-268` | ❌ |
| Escaping check panic delay (+1000-3000ms) | `utils/computerMoveUtils.js:273-284` | ❌ |
| Difficulty scaling curve (0.7–1.3×) | `utils/computerMoveUtils.js:286-288` | ❌ |
| ELO-aware jitter (low ELO ±30%, high ±10%) | `utils/computerMoveUtils.js:290-300` | ❌ |
| Bell-curve random sampling | `utils/computerMoveUtils.js:260-261` | ❌ |
| Promise-based perceived delay | `utils/computerMoveUtils.js:318-322` | ❌ |

**Android action:** Create `ThinkTimeCalculator.kt` in `engine/`, integrate with `PlayComputerViewModel.kt`.

---

### 2.4 Sound Effects System ❌
**Priority: P1**

| Sound Event | Web Reference | Android Status |
|-------------|--------------|----------------|
| Move sound | `play/PlayComputer.js:38` | ❌ |
| Capture sound | `play/PlayComputer.js:41` | ❌ |
| Check sound | `play/PlayComputer.js:39` | ❌ |
| Castle sound | `play/PlayComputer.js:42` | ❌ |
| Game start sound | `play/PlayComputer.js:43` | ❌ |
| Victory sound | `play/PlayComputer.js:43` | ❌ |
| Defeat sound | `play/PlayComputer.js:44` | ❌ |
| Generic game end sound | `play/PlayComputer.js:40` | ❌ |
| Sound based on move type | `play/PlayComputer.js:450-453` | ❌ |

**Android action:** Add sound files to `res/raw/`, create `SoundManager.kt` singleton, integrate with both PlayComputer and PlayMultiplayer ViewModels.

---

### 2.5 Move Classification & Evaluation System ❌
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Move quality badges (excellent/great/good/inaccuracy/mistake/blunder) | `GameReview.js:159-180` | ❌ |
| Color-coded move quality (green/blue/yellow/orange/red) | `GameReview.js:164-180` | ❌ |
| Quality icons (✓, ?, X) | `GameReview.js:243-254` | ❌ |
| Centipawn evaluation display | `GameReview.js:255-260` | ❌ |
| Opening detection (27 openings) | `utils/openingDetection.js` | ❌ |
| PGN export | `GameReview.js` (implied) | ❌ |
| Move-by-move accuracy percentage | `GameReview.js` (stats section) | ❌ |

**Android action:** Create `MoveEvaluator.kt` utility, create `OpeningBook.kt`, enhance `GameReviewScreen.kt`.

---

### 2.6 Game Completion Animation Enhancements ⚠️
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Staggered card fade-in (0.5-3s delay) | `GameCompletionAnimation.js:37-88` | ⚠️ basic |
| Synthetic opponent rating calc (1000 + level×100) | `GameCompletionAnimation.js:122, 141` | ❌ |
| Championship context display | `GameCompletionAnimation.js:34` | ❌ |
| Game history encoding for sharing | `GameCompletionAnimation.js:10, 524` | ❌ |
| Share game as link/image | `GameCompletionAnimation.js:573+` | ❌ |

---

### 2.7 Game End Card — Social Sharing ⚠️
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Share as PNG image | `GameEndCard.js:520-622` | ❌ |
| WhatsApp/Twitter/Facebook share links | `GameEndCard.js:10-17` | ❌ |
| Dynamic share text generation | `GameEndCard.js:577-587` | ❌ |
| Download game as PNG | `GameEndCard.js:628-643` | ❌ |
| Guest player custom name for sharing | `GameEndCard.js:33` | ❌ |
| Cross-origin image conversion | `GameEndCard.js:531+` | ❌ |
| Rating change with color coding | `GameEndCard.js:23, 68+` | ⚠️ basic |
| Championship tournament info on card | `GameEndCard.js:31, 114+` | ❌ |

---

### 2.8 Game Container UI Features ⚠️
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Rated game rules tooltip | `play/GameContainer.js:155-184` | ❌ |
| Move classification badges inline | `play/GameContainer.js:117-126` | ❌ |
| Performance display during game | `play/GameContainer.js:287-296` | ❌ |

---

## 3. INFRASTRUCTURE & STATE MANAGEMENT

### 3.1 WebSocket Event Listeners — Missing Events ⚠️
**Priority: P1 (Breaks real-time features)**

Android handles ~7 events. Web handles 13+. Missing:

| Event | Web Reference | Purpose |
|-------|--------------|---------|
| `.resume.request.sent` | `GlobalInvitationContext.js` | Show resume dialog |
| `.resume.request.expired` | `GlobalInvitationContext.js` | Auto-dismiss resume dialog |
| `.resume.request.response` | `GlobalInvitationContext.js` | Handle accept/decline |
| `.match.request.received` | `GlobalInvitationContext.js` | Smart match request dialog |
| `.match.request.cancelled` | `GlobalInvitationContext.js` | Dismiss match request |
| `.match.request.accepted` | `GlobalInvitationContext.js` | Navigate to game |
| `.match.request.declined` | `GlobalInvitationContext.js` | Show remaining targets |
| `.championship.game.resume.request` | `GlobalInvitationContext.js` | Championship resume |
| `.championship.game.resume.accepted` | `GlobalInvitationContext.js` | Navigate to game |
| `.championship.game.resume.declined` | `GlobalInvitationContext.js` | Show notification |

**Android action:** Add listeners in `GlobalInvitationManager.kt` and `PusherManager.kt`.

---

### 3.2 Game Navigation Guards ⚠️
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Browser back prevention during game | `contexts/GameNavigationContext.js` | ⚠️ basic dialog |
| Rated vs casual distinction | `GameNavigationContext.js` | ❌ |
| Pause game and navigate | `GameNavigationContext.js` | ❌ |
| Forfeit game and navigate | `GameNavigationContext.js` | ❌ |
| Register/unregister active game state | `GameNavigationContext.js` | ❌ |

**Android action:** Enhance `GameNavigationWarningDialog.kt`, add `BackHandler` in game screens.

---

### 3.3 Matchmaking Options Dialog ❌
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Time preset selection (3\|1, 5\|2, 10, 15\|10, etc.) | `lobby/MatchmakingQueue.jsx` | ❌ |
| Color preference (white/black/random) | `lobby/MatchmakingQueue.jsx` | ❌ |
| Game mode selection (rated/casual) | `lobby/MatchmakingQueue.jsx` | ❌ |
| Smart match → queue fallback flow | `lobby/MatchmakingQueue.jsx` | ❌ |
| 30s unified search countdown | `lobby/MatchmakingQueue.jsx` | ❌ |
| Match request accepted/declined handling | `lobby/MatchmakingQueue.jsx` | ❌ |

**Android action:** Create matchmaking options bottom sheet in `LobbyScreen.kt`.

---

### 3.4 Subscription Context — Full Payment Flow ⚠️
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| `createOrder()` Razorpay order creation | `contexts/SubscriptionContext.js` | ⚠️ PaymentApi exists |
| `verifyPayment()` server verification | `contexts/SubscriptionContext.js` | ⚠️ PaymentApi exists |
| `cancelSubscription()` | `contexts/SubscriptionContext.js` | ⚠️ PaymentApi exists |
| Plan resumption after login redirect | `pages/PricingPage.js` | ❌ |
| Checkout → verify → activate flow | `contexts/SubscriptionContext.js` | ❌ |

**Android action:** Wire `PaymentViewModel.kt` to `RazorpayCheckout.kt` with full lifecycle.

---

### 3.5 Presence & Online Status System ❌
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Database-backed heartbeat | `services/userStatusService.js` | ❌ |
| Status cache with TTL (30s) | `services/userStatusService.js` | ❌ |
| `getOnlineUsers()` | `services/userStatusService.js` | ❌ |
| Visibility change handling | `services/userStatusService.js` | ❌ |
| Presence channel subscription | `services/presenceService.js` | ❌ |
| Status types (online, away, in_game, in_tournament) | `services/presenceService.js` | ❌ |
| Online player count in header | `layout/Header.js` (polls `presence/stats`) | ❌ |

---

### 3.6 Analytics & Event Tracking ❌
**Priority: P3**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| `track(event, payload)` | `utils/analytics.js` | ❌ |
| `trackPageView(pageName)` | `utils/analytics.js` | ❌ |
| `trackAuth(action, method)` | `utils/analytics.js` | ❌ |
| `trackNavigation(dest, source)` | `utils/analytics.js` | ❌ |

**Android action:** Firebase Analytics is already a dependency. Create `AnalyticsManager.kt`.

---

## 4. TUTORIAL & LEARNING SYSTEM

### 4.1 Interactive Lessons ❌
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Multi-stage interactive lessons | `tutorial/EnhancedInteractiveLesson.jsx` | ❌ |
| Visual aids overlay (arrows, highlights, ghost pieces) | `tutorial/VisualAidsOverlay.jsx` | ❌ |
| FEN validation feedback | `tutorial/EnhancedInteractiveLesson.jsx:124-147` | ❌ |

---

### 4.2 Quiz System ❌
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Embedded quizzes in theory lessons | `tutorial/LessonPlayer.jsx:383-503` | ❌ |
| Multiple-choice with feedback | `tutorial/LessonPlayer.jsx:383-503` | ❌ |
| Proportional scoring | `tutorial/LessonPlayer.jsx:383-503` | ❌ |
| Per-slide quiz state tracking | `tutorial/LessonPlayer.jsx:30-31` | ❌ |

---

### 4.3 Lesson Progression & Gating ❌
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Prerequisite system (lock modules) | `tutorial/TutorialHub.jsx:216-270` | ❌ |
| Lesson unlock indicators | `tutorial/ModuleDetail.jsx:269-285` | ❌ |
| Module tier subscription gating | `tutorial/TutorialHub.jsx:228-254` | ❌ |
| Level-up progress bar (XP formula) | `tutorial/TutorialHub.jsx:144-170` | ❌ |
| Completion toast with score | `tutorial/TutorialHub.jsx:509-550` | ❌ |

---

### 4.4 Puzzle Enhancements ⚠️
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Progressive hint system with penalty | `tutorial/PuzzlePlayer.jsx:88-99` | ❌ |
| Puzzle objective display | `tutorial/PuzzlePlayer.jsx:208-210` | ❌ |
| Auto-hint on wrong attempt | `tutorial/PuzzlePlayer.jsx:141-165` | ❌ |
| Feedback card component | `tutorial/FeedbackCard.jsx` | ❌ |

---

## 5. CHAMPIONSHIP/TOURNAMENT MANAGEMENT

### 5.1 Tournament Creation & Admin ❌
**Priority: P2 (Admin features, could stay web-only)**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Create championship modal/wizard | `championship/CreateChampionshipModal` | ❌ |
| Configuration (format, rules, time, prizes) | `championship/ChampionshipConfigurationModal` | ❌ |
| Tournament admin dashboard | `championship/TournamentAdminDashboard` | ❌ |
| Match result editing | `championship/ChampionshipMatchesEdit.jsx` | ❌ |
| Pairing generation | `championship/PairingManager` | ❌ |
| Start/pause/complete lifecycle | `championship/ChampionshipDetails.js` | ❌ |

**Recommendation:** Consider keeping tournament admin as web-only; port only participant-facing features.

---

### 5.2 Advanced Tournament Display ⚠️
**Priority: P2**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Tiebreaker display (Buchholz/SOS/Koya) | `championship/ChampionshipStandings.jsx` | ❌ |
| Performance rating calculation | `championship/ChampionshipDetails.js` | ❌ |
| Round-specific leaderboards | `championship/ChampionshipDetails.js` | ❌ |
| Days remaining countdown | `championship/ChampionshipDetails.js` | ❌ |
| Entry fee + Razorpay payment | `championship/ChampionshipDetails.js` | ❌ |

---

## 6. PROFILE & SETTINGS

### 6.1 DiceBear Avatar Generator ❌
**Priority: P3**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| 12 avatar styles (adventurer, avataaars, bottts, fun-emoji, etc.) | `Profile.js:16-31` | ❌ |
| Random seed avatar generation | `Profile.js:16-31` | ❌ |
| Avatar picker modal | `Profile.js` | ❌ |

---

### 6.2 Image Cropping ❌
**Priority: P3**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Interactive crop tool | `Profile.js:186-237` | ❌ |
| Quality reduction (max 100KB) | `Profile.js:186-237` | ❌ |
| Dimension auto-scaling | `Profile.js:186-237` | ❌ |

---

### 6.3 Organization Affiliation ❌
**Priority: P3**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Organization search with debounce | `Profile.js:258-281` | ❌ |
| Join/leave organization | `Profile.js:283-300` | ❌ |
| Affiliation display on profile | `Profile.js:64-70` | ❌ |

---

## 7. UTILITIES NOT PORTED

### 7.1 Critical Utils ❌

| Utility | Web File | Purpose | Priority |
|---------|----------|---------|----------|
| Game history encoding/decoding | `utils/gameHistoryStringUtils.js` | Compact game storage + sharing | P1 |
| Social share URL generators | `utils/socialShareUtils.js` | WhatsApp/Twitter/Facebook links | P2 |
| Opening detection (27 openings) | `utils/openingDetection.js` | Show opening name in review | P2 |
| ELO/rating calculations | `utils/eloUtils.js` | Rating delta display | P2 |
| Permission/role helpers | `utils/permissionHelpers.js` | Role-based UI visibility | P2 |
| Player display formatting | `utils/playerDisplayUtils.js` | Name truncation, avatar extraction | P3 |
| Timer calculations | `utils/timerCalculator.js` | Complex time control logic | P2 |
| Result standardization | `utils/resultStandardization.js` | Normalize win/loss/draw | P3 |

### 7.2 Optimization Utils ❌ (P3, only if needed)

| Utility | Web File | Purpose |
|---------|----------|---------|
| WebSocket payload optimizer | `utils/websocketPayloadOptimizer.js` | Compress WS payloads |
| FEN optimizer | `utils/fenOptimizer.js` | Compress FEN strings |
| Timer optimizer | `utils/timerOptimizer.js` | Compress timer data |
| Evaluation optimizer | `utils/evaluationOptimizer.js` | Compress eval data |

---

## 8. ACTIVE GAME BANNER ❌
**Priority: P1**

| Feature | Web Reference | Android Status |
|---------|--------------|----------------|
| Pulsing "Enter Game" banner on all pages | `layout/ActiveGameBanner.js` | ❌ |
| Shows when user has active/paused game | `layout/ActiveGameBanner.js` | ❌ |
| One-tap resume navigation | `layout/ActiveGameBanner.js` | ❌ |

**Android action:** Add persistent banner composable in `MainActivity.kt` or `NavGraph.kt`.

---

## IMPLEMENTATION PRIORITY SUMMARY

### Phase A — Core Game Polish (P0-P1)
1. ❌ **Daily Challenge Screen** — Full interactive puzzle page
2. ❌ **Sound Effects System** — Move/capture/check/victory/defeat sounds
3. ❌ **ELO Think-Time Scaling** — Realistic AI difficulty perception
4. ❌ **Synthetic Chat System** — Personality-driven bot conversations
5. ❌ **Chat UI Enhancements** — Quick messages, emoji, ping
6. ❌ **Active Game Banner** — Persistent resume prompt
7. ⚠️ **WebSocket Events** — Add 6 missing event listeners
8. ⚠️ **Game Navigation Guards** — Rated/casual distinction, forfeit flow
9. ❌ **Matchmaking Options** — Time/color/mode selection before search

### Phase B — Social & Sharing (P2)
10. ❌ **Game End Card Sharing** — PNG capture, social platform links
11. ❌ **Move Classification** — Quality badges in game review
12. ❌ **Opening Detection** — Show opening name
13. ❌ **Leaderboard Image Sharing** — Already in Android ✅
14. ❌ **Ambassador Dashboard** — Earnings, tier progress, QR sharing
15. ⚠️ **Subscription Checkout Flow** — Wire Razorpay end-to-end

### Phase C — Tutorial Depth (P2)
16. ❌ **Interactive Lessons** — Multi-stage with visual aids
17. ❌ **Quiz System** — Embedded quizzes with scoring
18. ❌ **Lesson Progression** — Prerequisites, unlock indicators
19. ❌ **Puzzle Hints** — Progressive hints with penalty
20. ❌ **XP & Level-Up Progress** — Progress bar, level formula

### Phase D — Polish & Profile (P3)
21. ❌ **DiceBear Avatars** — Generated avatar styles
22. ❌ **Image Cropping** — Interactive crop for uploads
23. ❌ **Organization Affiliation** — School/org search + join
24. ❌ **Analytics** — Firebase event tracking
25. ❌ **Presence System** — Heartbeat + online status
26. ❌ **Tournament Admin** — Keep web-only or minimal mobile

---

## FILE REFERENCE INDEX

### Web Source (chess-frontend/src/)
```
pages/
  DailyChallengePage.js         — Daily puzzle page (513 lines)
  AmbassadorDashboard.js        — Ambassador program (364 lines)
  LeaderboardPage.js            — Public leaderboard (623 lines)
  PricingPage.js                — Subscription pricing (343 lines)
  AdminDashboard.js             — Admin tools (982 lines)

components/play/
  PlayComputer.js               — Computer game (2400+ lines)
  GameContainer.js              — Game layout/UI (480+ lines)
  GameChat.js                   — Chat component (282 lines)

components/
  GameCompletionAnimation.js    — Victory/defeat animation (620+ lines)
  GameEndCard.js                — End card + sharing (643+ lines)
  GameReview.js                 — Move-by-move review (1260+ lines)
  Dashboard.js                  — Main dashboard (860+ lines)
  Profile.js                    — Profile settings (800+ lines)

components/tutorial/
  TutorialHub.js                — Tutorial hub (570+ lines)
  LessonPlayer.jsx              — Lesson playback (712+ lines)
  EnhancedInteractiveLesson.jsx — Interactive lessons
  VisualAidsOverlay.jsx         — Board visual aids
  PuzzlePlayer.jsx              — Puzzle solving
  FeedbackCard.jsx              — Move feedback

components/championship/
  ChampionshipList.js           — Tournament list
  ChampionshipDetails.js        — Tournament details
  TournamentAdminDashboard.js   — Admin dashboard
  ChampionshipMatchesEdit.jsx   — Match editing

components/lobby/
  MatchmakingQueue.jsx          — Matchmaking with options

contexts/
  SubscriptionContext.js        — Payment lifecycle
  FeatureFlagsContext.js        — Feature flags
  GameNavigationContext.js      — Nav guards
  GlobalInvitationContext.js    — Game invitations

utils/
  syntheticChatUtils.js         — AI chat personalities
  gameHistoryStringUtils.js     — Game encoding
  computerMoveUtils.js          — AI think time
  openingDetection.js           — Opening book
  socialShareUtils.js           — Share URL generators
  analytics.js                  — Event tracking
  permissionHelpers.js          — Role checks
  playerDisplayUtils.js         — Name formatting

layout/
  ActiveGameBanner.js           — Resume game banner
  Header.js                     — Nav header
```

### Android Target (chess99-android/.../com/chess99/)
```
presentation/game/
  PlayComputerViewModel.kt      — Add think time, sounds, chat
  PlayMultiplayerScreen.kt      — Enhance chat UI

presentation/learn/
  LearnScreen.kt                — Add daily challenge nav
  NEW: DailyChallengeScreen.kt  — Full puzzle screen
  NEW: DailyChallengeViewModel.kt

presentation/common/
  GameCompletionAnimation.kt    — Add rating calc, sharing
  GameNavigationWarningDialog.kt — Add rated/forfeit flow
  GlobalInvitationManager.kt    — Add 6 missing event listeners

presentation/social/
  GameEndCard.kt                — Add image sharing, social links
  ShareManager.kt               — Add platform share URLs

engine/
  NEW: ThinkTimeCalculator.kt   — ELO-based delay
  NEW: OpeningBook.kt           — 27 openings

data/
  NEW: SyntheticChatManager.kt  — Bot chat personalities
  NEW: SoundManager.kt          — Game sound effects
  NEW: AnalyticsManager.kt      — Event tracking

presentation/
  NEW: AmbassadorScreen.kt      — Ambassador dashboard
  NEW: AmbassadorViewModel.kt
```
