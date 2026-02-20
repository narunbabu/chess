# Chess99 UX Improvement Plan

> Full-site analysis based on visual review of 15 pages across desktop (1920x1080) and mobile (390x844) viewports.
> Screenshots: `Chess-Web/images/screenshots/`
> Date: Feb 20, 2026

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Lobby](#2-lobby)
3. [Play Against Computer](#3-play-against-computer)
4. [Tutorial / Learn](#4-tutorial--learn)
5. [Training & Puzzles](#5-training--puzzles)
6. [Championships](#6-championships)
7. [Game History / Review](#7-game-history--review)
8. [Profile & Settings](#8-profile--settings)
9. [Landing Page](#9-landing-page)
10. [Pricing Page](#10-pricing-page)
11. [Subscription Management](#11-subscription-management)
12. [Site-Wide Issues](#12-site-wide-issues)
13. [Active Games & Unfinished Games Decision](#13-active-games--unfinished-games-decision)
14. [Implementation Priority Matrix](#14-implementation-priority-matrix)

---

## 1. Dashboard

**Screenshots**: `dashboard_desktop.png`, `dashboard_mobile.png`
**Design mockups**: `images/dashboard_design.png` (desktop), `images/dashboard_design_mobile.png` (mobile)

### Current State

**Desktop layout** (3-column):
- Left: Quick Actions (4 colored buttons stacked)
- Center: Active Games (empty state)
- Right: Unfinished Games (empty state)
- Bottom-left: Recent Games (empty)
- Bottom-right: Statistics (0 games, 0% win, 0.0 avg, 1200 rating)
- Top: Welcome banner + upgrade CTA + skill assessment prompt

**Mobile layout** (single column, long scroll):
- Welcome + upgrade banner + skill assessment side by side (cramped on mobile)
- Quick Actions (4 full-width buttons)
- Active Games (empty)
- Unfinished Games (empty)
- Recent Games (empty)
- Statistics (4 stacked cards)
- Footer

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| D1 | Says "Welcome, Player!" instead of actual username ("Arun") | High | Personalization |
| D2 | Active Games + Unfinished Games take 2/3 of prime real estate while almost always empty | High | Layout |
| D3 | On mobile, upgrade banner + skill assessment sit side by side and are truncated/cramped | High | Responsive |
| D4 | 4 Quick Action buttons use 4 different colors (orange, green, coral, dark) with no visual hierarchy — which is primary? | Medium | Visual hierarchy |
| D5 | Statistics show 0/0%/0.0/1200 for new users — demoralizing empty state | Medium | Onboarding |
| D6 | No rating trend or progress visualization — just static numbers | Medium | Engagement |
| D7 | No distinction between rated/casual in Recent Games | Low | Information |
| D8 | No "online players" count or social proof | Low | Engagement |
| D9 | Empty states are plain text with no actionable CTAs | Medium | Onboarding |

### Recommendations

#### D-R1: Fix Information Hierarchy (P0)
The dashboard should answer one question: **"What do you want to do?"** Currently everything competes for equal attention.

**Proposed layout (desktop)**:
```
 ┌──────────────────────────────────────────────────────────┐
 │ [CONDITIONAL] Active Game Banner — "Resume vs Kiran"     │  <- Only if game exists
 ├──────────────────────────────────────────────────────────┤
 │  Welcome, Arun!              [Rating: 1200] [Plan: Free] │
 ├─────────────────────┬────────────────────────────────────┤
 │  PLAY               │  Your Stats                        │
 │  ┌───────┐ ┌──────┐ │  Rating: 1200 (sparkline graph)    │
 │  │Quick  │ │Play  │ │  W: 8  L: 4  D: 2  (14 games)     │
 │  │Match  │ │Friend│ │  Current streak: WWL               │
 │  └───────┘ └──────┘ │  Win rate: 64% (mini bar)          │
 │  [vs Computer]      │                                     │
 ├─────────────────────┴────────────────────────────────────┤
 │  Recent Games (last 5)                    [View All →]   │
 │  ♔ vs Kiran (1390)  W  Blitz  Rated  32 moves   2h ago  │
 │  ♚ vs Suresh (1780) L  Rapid  Rated  45 moves   1d ago  │
 ├──────────────────────────────────────────────────────────┤
 │  [Daily Puzzle]  [Continue Learning]  [Championships]    │
 └──────────────────────────────────────────────────────────┘
```

**Proposed layout (mobile)**:
```
 ┌────────────────────────┐
 │ [Resume Game banner]   │  <- Conditional
 ├────────────────────────┤
 │ Welcome, Arun!         │
 │ Rating: 1200  Free     │
 ├────────────────────────┤
 │ ┌──────────────────┐   │
 │ │   PLAY NOW       │   │  <- One big CTA
 │ └──────────────────┘   │
 │ [vs Friend] [vs CPU]   │  <- Secondary row
 ├────────────────────────┤
 │ Stats: 1200 | 64% | 14 │  <- Compact horizontal
 ├────────────────────────┤
 │ Recent: last 3 games   │
 │          [View All →]  │
 ├────────────────────────┤
 │ [Puzzle] [Learn] [More]│
 └────────────────────────┘
```

#### D-R2: Conditional Active Game Display (P0)
- **When no active game**: Don't show the section at all. Zero wasted space.
- **When active game exists**: Show a prominent banner at the TOP with mini board preview, opponent name/rating, and a big "Resume" button. This is highest-priority real estate when relevant.

#### D-R3: Use Actual Username (P0)
Replace "Welcome, Player!" with "Welcome, Arun!" — the user's display name is already available via auth.

#### D-R4: Fix Mobile Banner Layout (P1)
The upgrade banner and skill assessment prompt are squished side-by-side on mobile. Stack them vertically, or better: show only one at a time (skill assessment for new users, upgrade nudge after they've played 5+ games).

#### D-R5: Redesign Quick Actions (P1)
- **One primary CTA**: "Play Now" (green, full-width or large) → opens mode selector
- **Two secondary CTAs**: "Play Friend" and "vs Computer" (muted/outline style)
- **Tertiary row**: Learn, Championships (smaller, icon-only or text links)
- Remove the traffic-light color scheme (orange/green/red/dark)

#### D-R6: Enrich Statistics with Engagement Hooks (P1)
- Add a **rating sparkline** (last 10-20 games trend line)
- Show **W/L/D breakdown** instead of just win %
- Add **current streak** indicator ("3-game win streak" or "Current form: W W L W")
- Replace "Average Score" (unclear what 3.7 means) with "Games This Week" or "Best Win"
- For new users (0 games): Show motivational prompt instead of zeros: "Play your first game to start tracking!"

#### D-R7: Enrich Recent Games (P2)
Each row should show:
- Your color (small white/black circle)
- Opponent name + rating
- Result (W/L/D with color coding)
- Game type (Rated/Casual badge)
- Time control
- Move count
- Time ago
- Click → opens game review

#### D-R8: Add Social Proof (P3)
- Show "247 players online" counter somewhere visible
- Optionally show friend activity feed

---

## 2. Lobby

**Screenshots**: `lobby_desktop.png`, `lobby_mobile.png`

### Current State
- Two tabs: "Play Online" / "Play Friends"
- Players (19) / Friends toggle
- Refresh button
- Online player cards: Avatar, Name, Rating, "Online" badge, Challenge button
- "Show 16 more players" expandable

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| L1 | Desktop: Massive empty space — content is a narrow centered column, ~40% of screen is wasted chess-pattern background | High | Layout |
| L2 | No time control or game mode selection before challenging — what happens when you click "Challenge"? | High | Flow |
| L3 | No way to filter players by rating range | Medium | Functionality |
| L4 | "Players" tab text is truncated to "Play..." on mobile with the (19) badge | Medium | Responsive |
| L5 | Player cards on mobile are vertically centered with large padding — wastes scroll space | Medium | Density |
| L6 | No visual indicator of whether a player is in a game vs. available | Low | Information |
| L7 | No search for specific players | Low | Functionality |

### Recommendations

#### L-R1: Use Desktop Width (P1)
On desktop, the content sits in a narrow ~600px column with chess-pattern gutters. Options:
- **Two-column layout**: Player list on left, game setup panel on right (when a player is selected)
- **Wider player grid**: Show players in a 2-3 column card grid to use space
- **Side panel**: Show recent challenge history or friends list alongside

#### L-R2: Inline Game Setup on Challenge (P1)
When clicking "Challenge", show an inline dropdown/modal with:
- Time control (Bullet 1+0, Blitz 3+2, Blitz 5+0, Rapid 10+0, etc.)
- Rated / Casual toggle
- Your color preference (White/Black/Random)
Then send the challenge. Don't just fire a generic challenge.

#### L-R3: Add Rating Range Filter (P2)
Simple slider or dropdown: "Show players rated 1000-1500" — helps users find appropriate opponents.

#### L-R4: Fix Mobile Tab Truncation (P1)
"Play..." (19) is cut off. Options:
- Shorten to "Online (19)" / "Friends"
- Use icons instead of text tabs
- Make tabs scrollable or reduce font size

#### L-R5: Denser Mobile Cards (P2)
Player cards on mobile are too tall (avatar centered above name, each taking ~200px height). Use horizontal card layout: `[Avatar] Name  Rating  [Challenge]` in one row, fitting 6-8 visible without scrolling.

#### L-R6: Player Status Indicators (P3)
Show whether a player is:
- Available (green dot)
- In a game (orange dot + "Playing")
- Idle (grey dot)

---

## 3. Play Against Computer

**Screenshots**: `play_computer_desktop.png`, `play_computer_mobile.png`

### Current State
- "Play Against Computer" heading
- Game Mode: Rated / Casual (two cards, Casual selected)
- Hardness dial showing "2" (semicircular gauge)
- Color selector: White / Black toggle
- "Start Game" green button
- Note: This is the PUBLIC (logged-out) view — no nav bar, just "Login" button

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| P1 | "Hardness: 2" — the word "Hardness" is unusual for chess. Standard term is "Difficulty" or "Level" | Medium | Terminology |
| P2 | The semicircular gauge for difficulty is unclear — what's the range? What does 2 mean? | Medium | Clarity |
| P3 | No difficulty labels (Easy/Medium/Hard/Expert) to help beginners understand | Medium | Onboarding |
| P4 | Desktop: Card is centered with massive empty space around it — unused screen | Low | Layout |
| P5 | Rated games vs Computer — does this actually affect ELO? Should it? Consider if this makes sense | Medium | Design decision |
| P6 | No preview of the board or what the experience will look like | Low | Anticipation |
| P7 | No time control option for computer games | Low | Feature gap |

### Recommendations

#### P-R1: Rename "Hardness" to "Difficulty" (P0)
Use standard chess terminology. "Hardness" sounds like a material property, not a game setting.

#### P-R2: Replace Gauge with Labeled Levels (P1)
Instead of an abstract semicircular dial:
```
Difficulty:
[Beginner]  [Easy]  [Medium]  [Hard]  [Expert]
   ●          ○        ○        ○        ○
  ~500      ~800     ~1200    ~1600    ~2000
```
Show approximate rating for each level so players can self-calibrate.

#### P-R3: Consider Removing Rated Mode for Computer Games (P2)
Rating changes from computer games are controversial — most platforms (Lichess, Chess.com) don't count computer games toward online rating. If you keep it, clearly explain the rating impact (e.g., "Your ELO will change based on the computer's difficulty rating").

#### P-R4: Add Board Preview (P3)
Show a small board with the selected color's perspective below the color toggle, so users see what they'll get.

---

## 4. Tutorial / Learn

**Screenshots**: `tutorial_desktop.png`, `tutorial_mobile.png`

### Current State
- "Learn Chess - Master the game with our interactive tutorials"
- Difficulty tabs: Beginner / Intermediate / Advanced
- Module cards with:
  - Title, description, difficulty badge
  - Lesson count, estimated time, XP rewards
  - Progress bar (0%)
  - Lock icon for modules requiring prerequisites
- Right sidebar: Your Progress (Level 1, 0 XP, 0 Lessons, 0 Achievements)
- Daily Challenge widget (Tactical Puzzle, 25 XP, "0 players completed")

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| T1 | This is excellent! The gamification (XP, levels, locks, daily challenge) is well-suited for the kids audience | -- | Positive |
| T2 | "0 players completed" on Daily Challenge — social proof backfiring when low numbers | Medium | Social proof |
| T3 | Desktop: Module cards are small and cramped for the available space | Low | Layout |
| T4 | Mobile: Very long scroll — Progress section is pushed far down | Medium | Mobile UX |
| T5 | No clear distinction between Tutorial (/tutorial) and Training (/training) — users may be confused about which to use | Medium | Navigation |
| T6 | The locked modules show "Complete previous lessons to unlock" but don't show WHICH lesson unlocks them | Low | Clarity |

### Recommendations

#### T-R1: Fix Social Proof Display (P1)
- If daily challenge completions are low, show "Be the first to solve today's puzzle!" instead of "0 players completed"
- Only show player count when it's encouraging (10+)

#### T-R2: Move Progress to Top on Mobile (P1)
On mobile, the Progress sidebar drops below all modules. Move it to a sticky top card or collapsible summary bar so users always see their level/XP.

#### T-R3: Merge Tutorial + Training Under One "Learn" Section (P2)
Currently there are two separate pages:
- `/tutorial` — structured lessons with XP progression
- `/training` — exercises organized by difficulty

These should be unified under one "Learn" hub:
```
Learn Chess
├── Lessons (structured curriculum — currently /tutorial)
├── Exercises (practice drills — currently /training)
└── Puzzles (daily/weekly puzzles — currently placeholder)
```

#### T-R4: Show Unlock Path (P3)
On locked modules, add: "Unlocked after: Chess Basics" with a link to the prerequisite.

---

## 5. Training & Puzzles

**Screenshots**: `training_desktop.png`, `training_mobile.png`, `puzzles_desktop.png`, `puzzles_mobile.png`

### Current State

**Training page** (`/training`):
- "Training Exercises & Puzzles"
- Three difficulty tiers with exercise cards:
  - Beginner: Basic King Movement, Basic Mate (K+Q vs K)
  - Intermediate: Complex Pawn Structures, Minor Piece Endgames, Bishop Pair Advantage
  - Advanced: Advanced Tactics, Strategic Positional Play
- Cards show difficulty badge (colored), title, description

**Puzzles page** (`/puzzles`):
- Empty placeholder: just "Puzzles Page" text
- No actual content

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| TR1 | `/puzzles` is a dead placeholder — links from footer/nav lead to empty page | High | Broken |
| TR2 | `/learn` is also an empty placeholder — should redirect to `/tutorial` | High | Broken |
| TR3 | Training cards on desktop are small — underusing available space | Medium | Layout |
| TR4 | No progress tracking on training exercises (unlike tutorials which have XP) | Medium | Consistency |
| TR5 | Exercise descriptions are generic — no indication of what the interactive experience involves | Low | Clarity |

### Recommendations

#### TR-R1: Fix Dead Placeholder Pages (P0)
- `/puzzles` → redirect to `/training` or build out the puzzles feature
- `/learn` → redirect to `/tutorial`
- Remove footer links to non-functional pages OR implement them

#### TR-R2: Add Progress Tracking to Training (P1)
Each exercise should show: completed/not-completed status, best score, time spent — consistent with the XP system in tutorials.

#### TR-R3: Unify Under Learn Hub (P2)
See T-R3 above — merge tutorials, training, and puzzles into a single learning center.

---

## 6. Championships

**Screenshots**: `championships_desktop.png`, `championships_mobile.png`

### Current State
- Trophy emoji + "Chess Championships" heading
- Filter bar: Search, Status dropdown (All/Registration Open/Starting Soon/In Progress/Completed), Format dropdown (Swiss/Single Elimination/Hybrid/Round Robin)
- Checkboxes: Upcoming Only, My Championships
- Empty state: "No championships found — Try adjusting your filters"

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| C1 | Page is completely empty — no tournaments exist at all | High | Content |
| C2 | Filter UI is prominent but there's nothing to filter | Medium | Premature UI |
| C3 | Desktop: Very sparse — huge empty space below filters | Medium | Layout |
| C4 | No ability to create/schedule championships (even for premium users) | Medium | Feature gap |
| C5 | No explanation of formats (Swiss, Round Robin, etc.) for beginners | Low | Education |
| C6 | Mobile: Filter dropdowns stack vertically and take a lot of space | Low | Responsive |

### Recommendations

#### C-R1: Seed with System Tournaments (P1)
Create recurring system tournaments:
- "Daily Blitz Arena" — every day at a fixed time
- "Weekend Rapid" — Saturday/Sunday
- "Beginner Friendly (Under 1200)" — weekly
- "Monthly Championship" — once per month

Even if participation is low initially, showing upcoming events makes the page feel alive.

#### C-R2: Better Empty State (P1)
Replace "No championships found" with:
```
No championships scheduled yet.

Upcoming features:
- Daily arenas
- Weekly tournaments
- School championships

[Notify me when available]
```

#### C-R3: Add Format Tooltips (P3)
Hover/tap on "Swiss System" → shows brief explanation: "Players are paired based on similar scores. No elimination — everyone plays all rounds."

---

## 7. Game History / Review

**Screenshots**: `history_desktop.png`, `history_mobile.png`

### Current State
- "Game History" heading
- Filters: Player Color (All/White/Black), Result (All/Won/Lost/Draw), Computer Level (All/Easy/Medium/Hard)
- Games list: "Games (0) — No games found"
- Right pane: "Select a game to review"
- Note: `/game-history` redirects to `/profile` — routing inconsistency

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| H1 | `/game-history` redirects to `/profile` instead of showing history — routing bug | High | Bug |
| H2 | Filters only include Computer Level — no filter for opponent rating, time control, rated/casual, date range | Medium | Functionality |
| H3 | "Select a game to review" shown even when 0 games exist — confusing empty state | Medium | UX copy |
| H4 | Desktop: Left panel (game list) and right panel (review) are both tiny and left-aligned — 60% of screen is empty | Medium | Layout |
| H5 | No game analysis or move-by-move review visible in UI | Medium | Feature gap |
| H6 | Filters aren't connected to the nav — user must manually navigate to `/history` | Low | Discoverability |

### Recommendations

#### H-R1: Fix `/game-history` Route (P0)
Either:
- Make `/game-history` work properly and show the history page, OR
- Remove it and make `/history` the canonical route accessible from dashboard "View All" and nav

#### H-R2: Expand Filters (P1)
Add:
- Date range picker
- Opponent name search
- Rated / Casual filter
- Time control filter
- Rating range at time of game

#### H-R3: Improve Empty State (P1)
When 0 games:
```
No games played yet!
Play your first game and come back here to review and improve.

[Play Now →]
```

#### H-R4: Full-Width Review Layout (P2)
Desktop layout should be:
- Left (40%): Scrollable game list with rich info per row
- Right (60%): Full chessboard with move list, analysis annotations, engine evaluation

#### H-R5: Add to Navigation (P2)
"History" or "My Games" should be accessible from:
- Dashboard "Recent Games → View All"
- Profile page
- Nav dropdown under user avatar

---

## 8. Profile & Settings

**Screenshots**: `profile_desktop.png`, `profile_mobile.png`

### Current State
Long single-page with sections:
1. Subscription Plan (FREE + Upgrade button)
2. Edit Profile (Display Name, Avatar, Birthday, Class of Study)
3. School / Organization (search + join)
4. Board Theme (8 themes, 6 locked for premium)
5. Chess Mates (Friends) — empty + search
6. Pending Friend Requests — empty
7. Tutorial Progress (Level 1, 0 XP, 0%, 0/14 lessons, Daily Streak, Skill Tier, Focus Learning, Achievements)
8. Invite Friends (WhatsApp, Facebook, X, Telegram, Instagram, Email, Copy Link)

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| PR1 | Page is extremely long — mixes settings, social, progress, and marketing into one scroll | High | Organization |
| PR2 | Board theme preview squares are very small — hard to see the actual theme | Medium | Visual |
| PR3 | "Class of Study" dropdown seems disconnected — no explanation of why it matters | Medium | Clarity |
| PR4 | Tutorial Progress section is detailed but duplicates info from /tutorial page | Low | Duplication |
| PR5 | Invite Friends section has 7 social buttons — visually cluttered | Low | Visual |
| PR6 | No way to change password or manage email/security | Medium | Missing feature |

### Recommendations

#### PR-R1: Split Profile Into Tabs or Sub-Pages (P1)
```
Profile
├── Overview (avatar, name, rating, plan)
├── Settings (edit profile, password, email, notifications)
├── Appearance (board themes, piece styles)
├── Friends (chess mates, requests, invite)
└── Progress (tutorial, achievements, stats)
```

#### PR-R2: Larger Board Theme Previews (P2)
Show a mini 4x4 board for each theme so users can actually see what they're selecting. The current tiny squares are too small to evaluate.

#### PR-R3: Add Account Security Section (P2)
- Change password
- Connected accounts (Google, Facebook)
- Session management
- Email preferences / notifications

#### PR-R4: Explain "Class of Study" (P3)
Add helper text: "This helps us match you with age-appropriate opponents and content" — otherwise users don't know why they're providing school grade.

---

## 9. Landing Page

**Screenshots**: `landing_desktop.png`, `landing_mobile.png`

### Current State
- Hero: "Play Chess Online" + "Learn, play, and improve. Safe for all ages."
- Two CTAs: "Play Now" + "Play Online"
- Sub-section: "No account needed to play vs computer" with decorative board
- Three feature cards: Play, Learn, Compete
- Pricing section: Monthly/Yearly toggle, Free/Standard (Rs 99)/Premium (Rs 499) cards
- Footer: Educational disclaimer, copyright 2024

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| LP1 | Two CTAs "Play Now" and "Play Online" — what's the difference? Confusing | High | CTA clarity |
| LP2 | Copyright says "2024" — should be 2025 or auto-updated | Low | Maintenance |
| LP3 | No screenshots or videos of actual gameplay — the decorative board isn't interactive | Medium | Social proof |
| LP4 | "Safe for all ages" messaging is good for parents but the pricing section is below the fold | Low | Conversion |
| LP5 | Feature cards are generic (Play, Learn, Compete) — don't show what makes Chess99 unique | Medium | Differentiation |
| LP6 | No testimonials, user count, or social proof | Medium | Trust |
| LP7 | Premium card says "Everything in Premium" — should say "Everything in Standard" | Medium | Copy error |

### Recommendations

#### LP-R1: Clarify CTAs (P0)
Use one primary CTA: **"Play Free"** or **"Start Playing"**
Secondary: "Sign Up" or "Learn More"
Remove the ambiguity between "Play Now" and "Play Online".

#### LP-R2: Add Social Proof (P1)
- "Join 500+ players learning chess" (or whatever the real number is)
- A few short testimonials or ratings
- Show a live game count: "23 games in progress right now"

#### LP-R3: Fix Copy Error (P1)
Premium tier: Change "Everything in Premium" to "Everything in Standard".

#### LP-R4: Show Actual Gameplay (P2)
Replace the decorative board with:
- An animated GIF of a quick game
- A short video walkthrough
- Interactive mini-puzzle ("Solve this in one move to sign up!")

#### LP-R5: Update Copyright Year (P0)
Change "2024" to "2026" or use dynamic year.

---

## 10. Pricing Page

**Screenshots**: `pricing_desktop.png`

### Current State
- "Choose Your Plan — Upgrade your chess experience with premium features"
- Monthly/Yearly toggle (Yearly saves 16%)
- Three plan cards with feature bullets
- Full feature comparison table below (20+ rows)

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| PRC1 | Feature comparison table is comprehensive — this is good | -- | Positive |
| PRC2 | Standard plan uses green/gold color, Premium uses purple — color associations don't convey value | Low | Visual |
| PRC3 | "Current Plan" badge on Free plan but no clear way to select/switch plans | Medium | Conversion |
| PRC4 | Feature table uses checkmarks and dashes — dashes ("-—") for missing features are a negative visual | Low | Visual |
| PRC5 | Same copy error as landing: Premium says "Everything in Premium" | Medium | Copy error |

### Recommendations

#### PRC-R1: Add "Most Value" Badge to Yearly Plans (P2)
When yearly is selected, show annual savings amount: "Save Rs 200/year" alongside the toggle.

#### PRC-R2: Replace Dashes with Explicit Labels (P3)
Instead of "—" for missing features, use "Free plan" / "Standard+" to show which plan unlocks it. Dashes feel like missing data, not a deliberate limitation.

#### PRC-R3: Fix Copy Error (P1)
Same as LP-R3 — "Everything in Premium" should be "Everything in Standard".

---

## 11. Subscription Management

**Screenshots**: `subscription_desktop.png`, `subscription_mobile.png`

### Current State
- Heading: "Subscription"
- Shows: "Free"
- Button: "Upgrade Now"
- That's it. The entire page is 3 elements with a massive empty page.

### Issues Found

| # | Issue | Severity | Type |
|---|-------|----------|------|
| S1 | Page is nearly empty — just a label and a button | High | Incomplete |
| S2 | No plan comparison, no billing history, no payment method management | High | Missing features |
| S3 | No clear path to manage an existing subscription (cancel, change plan) | High | Missing features |
| S4 | "Upgrade Now" button — where does it go? Should link to pricing page or inline plan selector | Medium | Flow |

### Recommendations

#### S-R1: Build Full Subscription Page (P1)
```
Subscription Management
├── Current Plan: Free (details, limits)
├── [Upgrade] → inline plan comparison or link to /pricing
├── Billing History (if any payments)
├── Payment Method (add/change card)
├── Cancel / Downgrade options
└── FAQ: "What happens if I cancel?"
```

#### S-R2: Show Usage vs. Limits (P2)
For free plan users:
```
Today: 3/5 games used  |  Undos: 2/5 remaining
[Upgrade for unlimited →]
```
This creates urgency when they're near limits.

---

## 12. Site-Wide Issues

### Navigation

| # | Issue | Severity |
|---|-------|----------|
| SW1 | Nav has 4 items (Dashboard, Lobby, Learn, Championships) but no "Play" — the most important action | High |
| SW2 | Profile is only accessible via avatar click (top-right) — not discoverable | Medium |
| SW3 | "Learn" nav link goes to `/tutorial` but footer "Learn" goes to `/learn` (empty page) | High |
| SW4 | No "History" / "My Games" in nav | Medium |
| SW5 | Footer links to "Puzzles" and "Learn" — both are empty placeholder pages | High |
| SW6 | Copyright year "2024" throughout | Low |

### Visual Design

| # | Issue | Severity |
|---|-------|----------|
| SW7 | Chess-pattern background is nice but creates visual noise — especially when content is narrow | Low |
| SW8 | Color palette is inconsistent: orange CTAs, green CTAs, coral CTAs, gold upgrade buttons — no clear color system | Medium |
| SW9 | Dark theme is good for chess but some text contrast is marginal (grey on dark grey) | Medium |

### Responsive Design

| # | Issue | Severity |
|---|-------|----------|
| SW10 | Desktop pages underuse screen width — most content sits in a narrow ~600-800px center column | High |
| SW11 | Mobile nav icons are small (especially on 390px viewport) — touch targets may be < 44px | Medium |
| SW12 | No tablet-specific layout considerations visible | Low |

### Recommendations

#### SW-R1: Restructure Navigation (P0)
```
Desktop: [Logo] [Play ▼] [Learn ▼] [Championships] [Lobby]     [Upgrade] [Avatar ▼]
                  │           │                                              │
                  ├ Quick     ├ Tutorials                                    ├ Profile
                  ├ vs Friend ├ Training                                     ├ My Games
                  ├ vs CPU    └ Puzzles                                      ├ Settings
                  └ Lobby                                                    └ Logout

Mobile: [Logo] [Play] [Learn] [Lobby] [Championships] [Avatar]
```

"Play" should be the most prominent nav item with a dropdown for play modes.

#### SW-R2: Fix Broken Footer/Nav Links (P0)
- Footer "Puzzles" → `/training` (or implement puzzles)
- Footer "Learn" → `/tutorial` (not `/learn`)
- Or remove links to unimplemented pages entirely

#### SW-R3: Establish Color System (P2)
```
Primary (green #4CAF50):     Play actions, success, positive
Secondary (amber #FFA726):   Upgrade, premium, achievements
Accent (blue #42A5F5):       Information, links, selections
Danger (red #EF5350):        Losses, errors, destructive actions
Neutral (grey #9E9E9E):      Disabled, secondary text, borders
```

#### SW-R4: Use Full Desktop Width (P2)
On 1920px screens, current content barely fills 800px. Use responsive max-widths:
- Content area: max-width 1200px (not 600-800px)
- Sidebars where appropriate (dashboard stats, lobby game setup)
- Multi-column grids for card layouts

---

## 13. Active Games & Unfinished Games Decision

### Active Games — KEEP but redesign

**Rationale**: Even if typically 0-1 active games, this is the *highest-priority information* when a game IS active. A returning player needs an obvious "Resume" path.

**Current problem**: Takes permanent space (1/3 of desktop dashboard) whether empty or not.

**Recommendation**:
- **Conditional banner**: Only render when active game exists
- Show as a prominent top banner with mini board, opponent name, time remaining
- When no active game: the space collapses, Quick Actions move up

### Unfinished Games — REMOVE from dashboard

**Rationale**:
1. **Rated games**: Players who disconnect should lose on time/forfeit. Allowing resume creates rating manipulation opportunities (disconnect when losing, resume when ready). Standard chess platforms auto-adjudicate disconnects.
2. **Casual games**: Low stakes — neither player cares enough to resume later. If they did, they'd start a new game.
3. **UX cost**: A permanent "Unfinished Games" section that's empty 99% of the time wastes prime dashboard real estate and makes the dashboard feel deserted.

**Alternative**: If you still want to support game resumption:
- Handle it server-side: auto-reconnect within 60 seconds of disconnect
- After 60 seconds: auto-forfeit for rated, auto-draw for casual
- No need for a persistent dashboard section

### Rated vs. Casual — Surface the Distinction

Currently the dashboard and history don't show whether games were rated or casual. Add:
- **Recent Games**: Small "Rated" or "Casual" badge per row
- **Statistics**: Optionally split: "Rated: 1200 ELO (8 games) | Casual: 6 games"
- **Game History filters**: Rated/Casual filter

---

## 14. Implementation Priority Matrix

### P0 — Critical (Do First)

| ID | Change | Page | Effort |
|----|--------|------|--------|
| D-R3 | Use actual username ("Welcome, Arun!") | Dashboard | Small |
| LP-R1 | Clarify landing page CTAs (remove "Play Now" vs "Play Online" confusion) | Landing | Small |
| LP-R5 | Update copyright year to 2026 | Site-wide | Tiny |
| LP-R3 / PRC-R3 | Fix "Everything in Premium" → "Everything in Standard" | Landing, Pricing | Tiny |
| TR-R1 | Fix dead `/puzzles` and `/learn` placeholder pages | Nav/Routing | Small |
| SW-R2 | Fix broken footer nav links | Footer | Small |
| P-R1 | Rename "Hardness" to "Difficulty" | Play Computer | Tiny |
| H-R1 | Fix `/game-history` routing bug | Routing | Small |

### P1 — High Impact

| ID | Change | Page | Effort |
|----|--------|------|--------|
| D-R1 | Redesign dashboard information hierarchy | Dashboard | Large |
| D-R2 | Make Active Games conditional (banner only when active) | Dashboard | Medium |
| D-R4 | Fix mobile banner layout (upgrade + skill assessment) | Dashboard | Medium |
| D-R5 | Redesign Quick Actions (single primary CTA) | Dashboard | Medium |
| D-R6 | Enrich Statistics with sparkline, streak, W/L/D | Dashboard | Medium |
| L-R2 | Inline game setup on Challenge click | Lobby | Medium |
| L-R4 | Fix mobile tab truncation | Lobby | Small |
| T-R1 | Fix social proof display (daily challenge count) | Tutorial | Small |
| T-R2 | Move Progress to top on mobile | Tutorial | Small |
| S-R1 | Build full subscription management page | Subscription | Large |
| C-R1 | Seed with recurring system tournaments | Championships | Medium |
| SW-R1 | Restructure navigation (add "Play" as primary) | Site-wide | Medium |
| LP-R2 | Add social proof to landing page | Landing | Medium |
| P-R2 | Replace difficulty gauge with labeled levels | Play Computer | Medium |

### P2 — Meaningful Improvements

| ID | Change | Page | Effort |
|----|--------|------|--------|
| D-R7 | Enrich Recent Games with opponent/result details | Dashboard | Medium |
| L-R1 | Use full desktop width in lobby | Lobby | Medium |
| L-R5 | Denser mobile player cards | Lobby | Small |
| T-R3 | Unify Tutorial + Training under one Learn hub | Learn | Large |
| H-R2 | Expand game history filters | History | Medium |
| H-R4 | Full-width review layout with analysis board | History | Large |
| PR-R1 | Split profile into tabs/sub-pages | Profile | Large |
| PR-R2 | Larger board theme previews | Profile | Small |
| PR-R3 | Add account security section | Profile | Medium |
| S-R2 | Show usage vs. limits for free users | Dashboard/Sub | Medium |
| SW-R3 | Establish consistent color system | Site-wide | Large |
| SW-R4 | Use full desktop width across all pages | Site-wide | Large |
| LP-R4 | Show actual gameplay screenshots/video | Landing | Medium |
| P-R3 | Evaluate rated mode for computer games | Play Computer | Design decision |
| H-R5 | Add History to navigation | Nav | Small |

### P3 — Polish & Nice-to-Have

| ID | Change | Page | Effort |
|----|--------|------|--------|
| D-R8 | Add online player count / social proof | Dashboard | Small |
| L-R3 | Rating range filter for players | Lobby | Medium |
| L-R6 | Player availability status indicators | Lobby | Small |
| T-R4 | Show unlock prerequisites on locked modules | Tutorial | Small |
| TR-R2 | Add progress tracking to training exercises | Training | Medium |
| C-R2 | Better empty state for championships | Championships | Small |
| C-R3 | Format tooltips (Swiss, Round Robin, etc.) | Championships | Small |
| PR-R4 | Explain "Class of Study" field | Profile | Tiny |
| PRC-R1 | "Most Value" badge on yearly billing | Pricing | Small |
| PRC-R2 | Replace dashes with explicit labels in comparison table | Pricing | Small |
| P-R4 | Board preview on play setup | Play Computer | Small |

---

## Summary

**Total issues identified**: 62
**Total recommendations**: 52

**Breakdown by severity**:
- P0 (Critical): 8 items — mostly copy fixes, broken links, routing bugs
- P1 (High Impact): 15 items — dashboard redesign, nav restructure, key UX flows
- P2 (Meaningful): 15 items — layout improvements, feature completeness
- P3 (Polish): 14 items — minor enhancements

**Biggest wins with least effort**:
1. Fix copy errors ("Hardness", "Everything in Premium", copyright year) — 30 min
2. Fix broken routes and placeholder pages — 1-2 hours
3. Use actual username on dashboard — 15 min
4. Redesign Quick Actions to single primary CTA — 2-3 hours
5. Make Active Games conditional — 2-3 hours

**Biggest wins with most effort**:
1. Full dashboard redesign with new hierarchy — 2-3 days
2. Unified Learn hub (tutorial + training + puzzles) — 3-5 days
3. Subscription management page — 2-3 days
4. Site-wide responsive width fix — 3-5 days
