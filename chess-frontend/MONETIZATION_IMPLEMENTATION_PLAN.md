# Chess99 Premium Monetization — Implementation Plan

> Generated: 2026-02-17 | Based on full codebase audit of chess-backend + chess-frontend

---

## Executive Summary

Chess99 has a **fully implemented subscription system** (Free/Premium/Pro tiers, Razorpay integration, authorization gates, frontend context) but **almost no features are actually gated**. The undo system is the only enforced premium limit today. This plan prioritizes 12 monetizable features by ROI vs effort, providing a phased roadmap to drive conversions.

---

## Current State

### Subscription Tiers (Already Built)

| | Free (₹0) | Premium (₹99/mo) | Pro (₹499/mo) |
|---|---|---|---|
| Play vs Computer | All difficulties | All difficulties | All difficulties |
| Online Multiplayer | Yes | Yes | Yes |
| Undos per Game | 5 (depth-based) | Unlimited | Unlimited |
| Ad-Free | No | **Yes** | **Yes** |
| Priority Matchmaking | No | **Yes** | **Yes** |
| Custom Board Themes | No | **Yes** | **Yes** |
| Full Game Statistics | Basic only | **Yes** | **Yes** |
| Create Tournaments | No | No | **Yes** |
| Advanced Analytics | No | No | **Yes** |
| Synthetic AI Opponents | No | No | **Yes** |
| Opening Explorer | No | No | **Yes** |
| Game Annotations | No | No | **Yes** |

### What's Actually Enforced Today

| Feature | Gated? | How |
|---------|--------|-----|
| Undo limits | **Yes** | GameControls.js checks `subscription_tier` |
| Tournament creation | **Yes** | `Gate::define('create-tournament')` in backend |
| Everything else | **No** | Gates defined but not enforced anywhere |

### Infrastructure Already Built (No Work Needed)

- SubscriptionService with Razorpay checkout/webhook/cancel
- SubscriptionContext (React) with `isPremium`, `isPro` helpers
- CheckSubscription middleware for route protection
- 5 authorization gates in AppServiceProvider
- Pricing page with tier comparison and checkout flow
- Mock mode for development testing

---

## Feature Priority Matrix

### Scoring Methodology
- **Revenue Impact** (1-5): How strongly this drives upgrades
- **Effort** (1-5): Implementation complexity (1=easy, 5=hard)
- **ROI Score**: Revenue Impact / Effort (higher = do first)
- **Retention**: Does this reduce churn for existing subscribers?

| # | Feature | Tier | Revenue | Effort | ROI | Retention | Phase |
|---|---------|------|---------|--------|-----|-----------|-------|
| 1 | Upsell Modals & Upgrade Prompts | All | 5 | 1 | **5.0** | Medium | 1 |
| 2 | Ad Integration + Ad-Free Gate | Premium | 4 | 1 | **4.0** | High | 1 |
| 3 | Board Themes & Piece Sets | Premium | 4 | 2 | **2.0** | High | 1 |
| 4 | Advanced Game Analytics Gate | Pro | 3 | 1 | **3.0** | High | 1 |
| 5 | Game Export (PGN/PDF) | Premium | 3 | 2 | **1.5** | Medium | 2 |
| 6 | Priority Matchmaking Badge | Premium | 2 | 1 | **2.0** | Medium | 2 |
| 7 | Synthetic AI Opponents | Pro | 4 | 3 | **1.3** | High | 2 |
| 8 | Opening Explorer | Pro | 4 | 3 | **1.3** | High | 3 |
| 9 | Game Annotations & Notes | Pro | 3 | 3 | **1.0** | High | 3 |
| 10 | Unlimited Game Review Depth | Premium | 3 | 2 | **1.5** | Medium | 3 |
| 11 | Premium Profile Badges | Premium | 2 | 1 | **2.0** | Medium | 4 |
| 12 | Exclusive Daily Challenges | Premium | 3 | 3 | **1.0** | High | 4 |

---

## Phase 1: Quick Wins (Week 1-2) — Gate What Exists

**Goal**: Start driving conversions immediately with minimal code changes.

---

### Feature 1: Upsell Modals & Upgrade Prompts

**Why first**: Zero new features needed — just show users what they're missing.

**Revenue Impact**: 5/5 — This is the #1 conversion driver. Users who never see the upgrade prompt never upgrade.

**Implementation**:

#### 1A. Create `<UpgradePrompt>` Component

**New file**: `chess-frontend/src/components/common/UpgradePrompt.js`

```jsx
// Props: { feature, requiredTier, onDismiss, inline? }
// Shows: Lock icon + feature name + "Upgrade to {tier}" button
// Variants: modal (blocking), inline (embedded in UI), toast (dismissible)
// Links to /pricing with ?highlight={tier} query param
```

**Behavior**:
- Check `useSubscription()` context for current tier
- If user has required tier: render `children` (passthrough)
- If user lacks tier: render upgrade prompt instead
- Track impressions/clicks for conversion analytics

#### 1B. Trigger Points (Add to Existing Components)

| Location | Trigger | Message |
|----------|---------|---------|
| `GameControls.js` | Undo denied (limit hit) | "Upgrade to Premium for unlimited undos" |
| `GameReview.js` | After 3 games reviewed | "Unlock full game analytics with Pro" |
| `ChampionshipList.js` | Create tournament button | "Create your own tournaments with Pro" |
| `PlayComputer.js` | After game ends | "Want deeper analysis? Upgrade to Pro" |
| `LobbyPage.js` | Waiting in queue >30s | "Premium members get priority matchmaking" |
| `Profile.js` | Stats section | "Unlock detailed performance insights" |

#### 1C. Backend: Track Upgrade Prompt Events

**Modify**: `chess-backend/app/Http/Controllers/UserController.php`

```php
// POST /api/v1/users/track-event
public function trackEvent(Request $request) {
    // Log: user_id, event_type (upgrade_prompt_shown, upgrade_prompt_clicked),
    //       feature, tier, timestamp
    // Store in simple analytics table or log file
}
```

**Files to create/modify**:
- `chess-frontend/src/components/common/UpgradePrompt.js` (new)
- `chess-frontend/src/components/common/UpgradePrompt.css` (new)
- `chess-frontend/src/components/play/GameControls.js` (add prompt on undo deny)
- `chess-frontend/src/pages/LobbyPage.js` (add prompt on long queue wait)
- `chess-frontend/src/components/Profile.js` (add prompt on stats section)

**Effort**: 1 day | **Impact**: Immediate conversion lift

---

### Feature 2: Ad Integration + Ad-Free Gate

**Why**: Ads generate revenue from free users AND motivate upgrades. Double revenue stream.

**Revenue Impact**: 4/5 — Ads are the most visible "annoyance" that drives upgrades.

**Implementation**:

#### 2A. Create `<AdBanner>` Component

**New file**: `chess-frontend/src/components/common/AdBanner.js`

```jsx
// Shows: Google AdSense banner (or placeholder in dev)
// Checks: useSubscription().isPremium → render nothing if premium
// Placements: between-game interstitial, sidebar, below board
// Sizes: leaderboard (728x90), rectangle (300x250), mobile (320x50)
```

#### 2B. Ad Placements

| Location | Type | When |
|----------|------|------|
| Game end screen | Interstitial (300x250) | After every 3rd game |
| Lobby sidebar | Banner (300x250) | Always visible |
| Game history page | In-feed (728x90) | Between game entries |
| Profile page | Banner (300x250) | Below stats section |

#### 2C. Backend: Ad Configuration

**Modify**: `chess-backend/config/services.php`

```php
'adsense' => [
    'client_id' => env('GOOGLE_ADSENSE_CLIENT_ID'),
    'enabled' => env('ADS_ENABLED', false),
],
```

#### 2D. "Ad-Free" Badge in Pricing

**Modify**: Pricing page to prominently show "No Ads" as Premium benefit with crossed-out ad icon.

**Files to create/modify**:
- `chess-frontend/src/components/common/AdBanner.js` (new)
- `chess-frontend/src/components/common/AdBanner.css` (new)
- `chess-frontend/src/components/GameEndCard.js` (add interstitial)
- `chess-frontend/src/pages/LobbyPage.js` (add sidebar ad)
- `chess-frontend/src/pages/GameHistoryPage.js` (add in-feed ad)
- `chess-backend/config/services.php` (add adsense config)
- `chess-frontend/.env` (add REACT_APP_ADSENSE_CLIENT_ID)

**Effort**: 1-2 days | **Impact**: Revenue from free users + upgrade motivation

---

### Feature 3: Board Themes & Piece Sets

**Why**: Visual customization is the most universally desired premium perk in chess apps. Low effort, high perceived value.

**Revenue Impact**: 4/5 — Lichess and Chess.com prove this drives upgrades.

**Implementation**:

#### 3A. Theme System

**New file**: `chess-frontend/src/config/boardThemes.js`

```javascript
export const BOARD_THEMES = {
  // Free themes (2)
  classic: { light: '#f0d9b5', dark: '#b58863', name: 'Classic', tier: 'free' },
  blue: { light: '#dee3e6', dark: '#8ca2ad', name: 'Blue', tier: 'free' },

  // Premium themes (6)
  green: { light: '#ffffdd', dark: '#86a666', name: 'Forest', tier: 'premium' },
  purple: { light: '#e8d0ff', dark: '#7b61a6', name: 'Royal', tier: 'premium' },
  coral: { light: '#fce4e4', dark: '#d48c8c', name: 'Coral', tier: 'premium' },
  midnight: { light: '#c8c8c8', dark: '#4a4a6a', name: 'Midnight', tier: 'premium' },
  wood: { light: '#e8c99b', dark: '#a97a50', name: 'Walnut', tier: 'premium' },
  marble: { light: '#f5f5f0', dark: '#a0a0a0', name: 'Marble', tier: 'premium' },
};

export const PIECE_SETS = {
  standard: { name: 'Standard', tier: 'free' },
  neo: { name: 'Neo', tier: 'free' },
  alpha: { name: 'Alpha', tier: 'premium' },
  merida: { name: 'Merida', tier: 'premium' },
  california: { name: 'California', tier: 'premium' },
  cardinal: { name: 'Cardinal', tier: 'premium' },
};
```

#### 3B. Theme Selector Component

**New file**: `chess-frontend/src/components/settings/ThemeSelector.js`

```jsx
// Grid of theme previews (mini 4x4 board)
// Free themes: selectable
// Premium themes: show lock icon + "Premium" badge
// Click locked theme → UpgradePrompt modal
// Selected theme saved to localStorage + user preferences API
```

#### 3C. Apply Theme to Board

**Modify**: `chess-frontend/src/components/play/PlayComputer.js` (and PlayMultiplayer)

```jsx
// Read theme from user preferences
// Apply CSS custom properties: --board-light, --board-dark
// Board component reads these variables
```

#### 3D. Backend: Store Theme Preference

**Modify**: `chess-backend/app/Http/Controllers/UserController.php`

```php
// Add to updateProfile validation:
'board_theme' => 'sometimes|string|max:30',
'piece_set' => 'sometimes|string|max:30',
```

**New migration**: Add `board_theme` and `piece_set` columns to users table.

**Files to create/modify**:
- `chess-frontend/src/config/boardThemes.js` (new)
- `chess-frontend/src/components/settings/ThemeSelector.js` (new)
- `chess-frontend/src/components/settings/ThemeSelector.css` (new)
- `chess-frontend/src/components/Profile.js` (add theme selector section)
- `chess-frontend/src/components/play/PlayComputer.js` (apply theme)
- `chess-backend/database/migrations/..._add_theme_prefs_to_users.php` (new)
- `chess-backend/app/Http/Controllers/UserController.php` (save prefs)
- `chess-backend/app/Models/User.php` (add to $fillable)

**Effort**: 2-3 days | **Impact**: High perceived value, strong visual differentiator

---

### Feature 4: Advanced Game Analytics Gate

**Why**: The analytics system already exists (ACPL, move quality grades, accuracy %). Just needs a paywall.

**Revenue Impact**: 3/5 — Serious players will pay for this. Core retention feature.

**Implementation**:

#### 4A. Gate the DetailedStatsModal

**Modify**: `chess-frontend/src/components/DetailedStatsModal.js`

```jsx
// Current: Shows all stats to everyone
// Change: Show summary stats to free users (games, W/L/D, rating)
// Gate: Move quality breakdown, ACPL, accuracy trends behind Pro
// Show blurred preview of gated stats with upgrade prompt overlay
```

#### 4B. Gate Performance History API

**Modify**: `chess-backend/app/Http/Controllers/GameController.php`

```php
// GET /api/games/{id}/performance
// Free users: return basic result (win/loss/draw, rating change)
// Pro users: return full analysis (ACPL, move grades, accuracy, time analysis)
public function getPerformance(Request $request, $gameId) {
    $game = Game::findOrFail($gameId);
    $user = $request->user();

    $basicData = [...]; // Always returned
    $advancedData = [...]; // ACPL, move quality, accuracy

    if (!$user->hasSubscriptionTier('pro')) {
        return response()->json([
            ...$basicData,
            'advanced_analytics_locked' => true,
            'required_tier' => 'pro',
        ]);
    }

    return response()->json([...$basicData, ...$advancedData]);
}
```

#### 4C. Blurred Preview Pattern

```jsx
// Show real data but blurred with CSS: filter: blur(4px)
// Overlay with lock icon + "Unlock with Pro" button
// This "teases" the data and is more compelling than hiding it entirely
```

**Files to modify**:
- `chess-frontend/src/components/DetailedStatsModal.js` (gate advanced stats)
- `chess-frontend/src/components/play/GameReview.js` (gate deep analysis)
- `chess-backend/app/Http/Controllers/GameController.php` (gate API response)

**Effort**: 1 day | **Impact**: Direct Pro conversion driver for serious players

---

## Phase 2: Core Premium Features (Week 3-5)

**Goal**: Build the features that justify ongoing subscription payments.

---

### Feature 5: Game Export (PGN/PDF)

**Why**: Competitive players need to review games offline. PGN is the standard format.

**Implementation**:

#### 5A. PGN Export

**New file**: `chess-frontend/src/utils/pgnExportUtils.js`

```javascript
export function generatePGN(game) {
  // Standard PGN format with headers:
  // [Event "Chess99 Online"]
  // [Site "chess99.com"]
  // [Date "2026.02.17"]
  // [White "Player1"]
  // [Black "Player2"]
  // [Result "1-0"]
  // 1. e4 e5 2. Nf3 Nc6 ...
}
```

#### 5B. PDF Report

```javascript
// Use jsPDF or html2canvas
// Include: board position snapshots at key moments, move list,
//          performance summary, accuracy chart
// Premium feature — free users can export basic PGN only
```

#### 5C. Export Buttons

**Modify**: `chess-frontend/src/components/GameReview.js`

```jsx
// Add "Export" dropdown: PGN (free), PDF Report (premium)
// PGN: direct download, no gate
// PDF: check isPremium, show UpgradePrompt if not
```

**Files to create/modify**:
- `chess-frontend/src/utils/pgnExportUtils.js` (new)
- `chess-frontend/src/utils/pdfExportUtils.js` (new)
- `chess-frontend/src/components/GameReview.js` (add export buttons)
- `chess-frontend/package.json` (add jspdf dependency)

**Effort**: 2-3 days | **Impact**: Strong differentiator for serious players

---

### Feature 6: Priority Matchmaking

**Why**: Wait time is a real pain point. Premium users skip the queue.

**Implementation**:

#### 6A. Backend Queue Priority

**Modify**: `chess-backend/app/Services/MatchmakingService.php`

```php
// When matching players, sort queue by:
// 1. Premium/Pro users first (priority_matchmaking flag)
// 2. Then by wait time
// 3. Then by rating proximity
// Result: Premium users get matched 2-3x faster
```

#### 6B. Frontend Badge

**Modify**: `chess-frontend/src/components/lobby/MatchmakingQueue.jsx`

```jsx
// Show "Priority" badge next to premium users in queue
// Show estimated wait time: "~10s" for premium, "~30s" for free
// When free user waits >20s, show: "Tired of waiting? Premium gets priority"
```

**Files to modify**:
- `chess-backend/app/Services/MatchmakingService.php` (priority sorting)
- `chess-frontend/src/components/lobby/MatchmakingQueue.jsx` (badge + prompt)

**Effort**: 1 day | **Impact**: Tangible benefit that free users feel every session

---

### Feature 7: Synthetic AI Opponents

**Why**: Solves the "no one online" problem. Paid users always have opponents available.

**Implementation**:

#### 7A. Backend: Synthetic Player Selection

**Modify**: `chess-backend/app/Http/Controllers/LobbyController.php`

```php
// When Pro user requests a match and no humans available:
// 1. Select SyntheticPlayer closest to user's rating
// 2. Create game with synthetic player as opponent
// 3. Run Stockfish at calibrated difficulty for synthetic's rating
// 4. Mark game as vs_synthetic (for analytics, not shown to user)
```

#### 7B. Frontend: "Always Find a Match" Toggle

**Modify**: `chess-frontend/src/pages/LobbyPage.js`

```jsx
// Pro users see toggle: "Match with AI if no players available"
// When enabled and queue timeout (30s), auto-create game vs synthetic
// Synthetic players show with special avatar style (subtle indicator)
// Free users see this toggle locked with Pro badge
```

#### 7C. Synthetic Player Profiles

The `SyntheticPlayer` model and seeder already exist. Need to:
- Ensure variety in names, ratings (800-2400), avatars
- Calibrate Stockfish depth to match synthetic player's rating
- Track games vs synthetic separately for rating purposes

**Files to modify**:
- `chess-backend/app/Http/Controllers/LobbyController.php` (synthetic matching)
- `chess-backend/app/Http/Controllers/GameController.php` (create synthetic game)
- `chess-frontend/src/pages/LobbyPage.js` (toggle + gate)
- `chess-backend/database/seeders/SyntheticPlayerSeeder.php` (ensure data)

**Effort**: 3-4 days | **Impact**: Eliminates the #1 churn reason (no opponents)

---

## Phase 3: Depth Features (Week 6-9)

**Goal**: Build features that create long-term stickiness and justify Pro pricing.

---

### Feature 8: Opening Explorer

**Why**: This is the feature that defines Pro-tier chess platforms. Opens analysis depth.

**Implementation**:

#### 8A. Backend: Opening Database

**Option A** (Recommended): Use Lichess Opening Explorer API (free, no key needed)
```
GET https://explorer.lichess.ovh/lichess?fen={fen}&ratings=1600,1800,2000,2200,2500
```

**Option B**: Build local opening book from master games (higher effort, offline capable)

#### 8B. Backend Proxy Controller

**New file**: `chess-backend/app/Http/Controllers/OpeningExplorerController.php`

```php
// GET /api/v1/openings/explore?fen={fen}
// Middleware: subscription:pro (gate to Pro users)
// Proxy to Lichess API with caching (Redis, 24h TTL)
// Return: top moves with win/draw/loss percentages, game count
// Rate limit: 10 requests/minute per user
```

#### 8C. Frontend: Explorer Panel

**New file**: `chess-frontend/src/components/analysis/OpeningExplorer.js`

```jsx
// Side panel showing:
// - Current opening name (e.g., "Sicilian Defense: Najdorf Variation")
// - Move table: Move | Games | Win% | Draw% | Loss%
// - Click move to play it on board
// - Depth navigation (main line + variations)
// Pro-gated: show blurred preview for non-Pro users
```

#### 8D. Integration Points

- Game review: Show explorer alongside move list
- Play vs computer: Optional explorer panel for study
- Standalone analysis board (new route: `/analysis`)

**Files to create/modify**:
- `chess-backend/app/Http/Controllers/OpeningExplorerController.php` (new)
- `chess-backend/routes/api_v1.php` (add routes)
- `chess-frontend/src/components/analysis/OpeningExplorer.js` (new)
- `chess-frontend/src/components/analysis/OpeningExplorer.css` (new)
- `chess-frontend/src/components/play/GameReview.js` (integrate panel)

**Effort**: 3-4 days | **Impact**: Signature Pro feature, strong competitive moat

---

### Feature 9: Game Annotations & Notes

**Why**: Lets players add personal notes to moves — essential for improvement tracking.

**Implementation**:

#### 9A. Backend: Annotations Storage

**New migration**: `create_game_annotations_table.php`

```php
Schema::create('game_annotations', function (Blueprint $table) {
    $table->id();
    $table->foreignId('game_id')->constrained()->onDelete('cascade');
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->unsignedSmallInteger('move_number');
    $table->enum('color', ['white', 'black']);
    $table->text('comment')->nullable();
    $table->string('nag', 10)->nullable(); // !, ?, !!, ??, !?, ?!
    $table->json('arrows')->nullable(); // [{from: 'e2', to: 'e4', color: 'green'}]
    $table->json('highlights')->nullable(); // [{square: 'e4', color: 'red'}]
    $table->timestamps();
    $table->unique(['game_id', 'user_id', 'move_number', 'color']);
});
```

#### 9B. Frontend: Annotation UI

**New file**: `chess-frontend/src/components/analysis/AnnotationPanel.js`

```jsx
// Per-move text input for comments
// NAG buttons: !, ?, !!, ??, !?, ?!
// Arrow drawing on board (click-drag with modifier key)
// Square highlighting (right-click)
// Auto-save with debounce (500ms)
// Pro-gated: show "Add notes with Pro" prompt for non-Pro
```

**Files to create/modify**:
- `chess-backend/database/migrations/..._create_game_annotations_table.php` (new)
- `chess-backend/app/Models/GameAnnotation.php` (new)
- `chess-backend/app/Http/Controllers/AnnotationController.php` (new)
- `chess-backend/routes/api_v1.php` (add routes)
- `chess-frontend/src/components/analysis/AnnotationPanel.js` (new)
- `chess-frontend/src/components/play/GameReview.js` (integrate)

**Effort**: 3-4 days | **Impact**: Deep engagement feature for dedicated players

---

### Feature 10: Unlimited Game Review Depth

**Why**: Free users can review recent games; premium unlocks full history and deeper analysis.

**Implementation**:

#### 10A. Gate Game History Depth

```jsx
// Free: Last 10 games reviewable with basic replay
// Premium: All games + detailed move-by-move replay
// Pro: All games + replay + annotations + opening explorer
```

#### 10B. Backend Gate

**Modify**: `chess-backend/app/Http/Controllers/GameController.php`

```php
// GET /api/games/history
// Free: limit 10, basic fields only
// Premium+: unlimited, full fields
// Add 'subscription_limit' to response so frontend knows
```

**Files to modify**:
- `chess-backend/app/Http/Controllers/GameController.php` (limit history)
- `chess-frontend/src/pages/GameHistoryPage.js` (show limit + upgrade prompt)

**Effort**: 1-2 days | **Impact**: Creates natural upgrade moment for returning players

---

## Phase 4: Engagement & Retention (Week 10-12)

**Goal**: Features that reduce churn and increase daily engagement.

---

### Feature 11: Premium Profile Badges

**Why**: Social proof and status signaling. Low effort, high emotional value.

**Implementation**:

#### 11A. Badge System

```jsx
// Premium users: Gold crown icon next to name
// Pro users: Diamond icon next to name
// Visible in: lobby player list, game opponent info, leaderboard, profile
```

#### 11B. Component

**New file**: `chess-frontend/src/components/common/SubscriptionBadge.js`

```jsx
// Props: { tier, size: 'sm'|'md'|'lg' }
// Renders: nothing (free), gold crown (premium), diamond (pro)
// Tooltip: "Premium Member" / "Pro Member"
```

**Files to create/modify**:
- `chess-frontend/src/components/common/SubscriptionBadge.js` (new)
- `chess-frontend/src/components/lobby/PlayersList.jsx` (add badge)
- `chess-frontend/src/components/play/GameInfo.js` (add badge)
- `chess-frontend/src/pages/GameHistoryPage.js` (add badge)

**Effort**: 1 day | **Impact**: Social proof drives FOMO upgrades

---

### Feature 12: Exclusive Daily Challenges

**Why**: Creates daily engagement habit. Premium challenges are harder and reward more.

**Implementation**:

#### 12A. Challenge Tiers

```javascript
// Free: 1 daily challenge (easy/medium)
// Premium: 3 daily challenges (easy/medium/hard) + streak bonuses
// Pro: 5 daily challenges + themed series + leaderboard position
```

#### 12B. Backend: Daily Challenge Generator

**Modify**: `chess-backend/app/Http/Controllers/TutorialController.php`

```php
// GET /api/v1/daily-challenges
// Returns challenges based on tier
// Track completions, streaks, XP earned
// Premium challenges use curated puzzle database
```

#### 12C. Frontend: Challenge Hub

**Modify existing tutorial/challenge components** to tier-gate challenge count.

**Files to modify**:
- `chess-backend/app/Http/Controllers/TutorialController.php` (tier-gate challenges)
- `chess-frontend/src/components/tutorial/TrainingHub.js` (show tier limits)

**Effort**: 3 days | **Impact**: Daily engagement + habit formation

---

## Revenue Projections

### Assumptions
- 10,000 MAU (monthly active users) at launch
- 3% free-to-premium conversion (industry avg for chess: 2-5%)
- 0.5% free-to-pro conversion
- ₹3/day ad revenue per free user (with ads)

### Monthly Revenue Estimate

| Source | Users | Rate | Monthly |
|--------|-------|------|---------|
| Premium subscriptions | 300 | ₹99/mo | ₹29,700 |
| Pro subscriptions | 50 | ₹499/mo | ₹24,950 |
| Ad revenue (free users) | 9,650 | ₹90/mo | ₹868,500 |
| Tournament entry fees | varies | 10% platform cut | ₹5,000-50,000 |
| **Total** | | | **₹928,150 - ₹973,150** |

### Key Conversion Drivers by Feature

| Feature | Expected Lift | Target Tier |
|---------|--------------|-------------|
| Upsell modals | +50% baseline conversions | All |
| Ad removal | +30% premium conversions | Premium |
| Board themes | +20% premium conversions | Premium |
| Analytics gate | +15% pro conversions | Pro |
| Opening explorer | +25% pro conversions | Pro |
| Synthetic opponents | +10% pro conversions | Pro |

---

## Implementation Timeline

```
Week 1-2:  Phase 1 — Quick Wins
           ├── Upsell modals & upgrade prompts (1 day)
           ├── Ad integration + ad-free gate (1-2 days)
           ├── Board themes & piece sets (2-3 days)
           └── Advanced analytics gate (1 day)

Week 3-5:  Phase 2 — Core Premium Features
           ├── Game export PGN/PDF (2-3 days)
           ├── Priority matchmaking badge (1 day)
           └── Synthetic AI opponents (3-4 days)

Week 6-9:  Phase 3 — Depth Features
           ├── Opening explorer (3-4 days)
           ├── Game annotations & notes (3-4 days)
           └── Unlimited game review depth (1-2 days)

Week 10-12: Phase 4 — Engagement & Retention
            ├── Premium profile badges (1 day)
            └── Exclusive daily challenges (3 days)
```

**Total effort**: ~25-30 development days across 12 weeks

---

## Technical Architecture Notes

### Frontend Gating Pattern (Consistent Across All Features)

```jsx
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from './common/UpgradePrompt';

function PremiumFeature() {
  const { isPremium, isPro, currentTier } = useSubscription();

  if (!isPremium) {
    return <UpgradePrompt feature="Board Themes" requiredTier="premium" />;
  }

  return <ActualFeatureComponent />;
}
```

### Backend Gating Pattern (Consistent Across All Features)

```php
// Option A: Middleware (for entire routes)
Route::middleware('subscription:pro')->group(function () {
    Route::get('/openings/explore', [OpeningExplorerController::class, 'explore']);
});

// Option B: Gate check (for partial responses)
if ($request->user()->hasSubscriptionTier('pro')) {
    $response['advanced_analytics'] = $this->getAdvancedAnalytics($game);
} else {
    $response['advanced_analytics_locked'] = true;
}
```

### Database Changes Summary

| Migration | Table | Columns |
|-----------|-------|---------|
| `add_theme_prefs_to_users` | users | `board_theme`, `piece_set` |
| `create_game_annotations` | game_annotations | id, game_id, user_id, move_number, color, comment, nag, arrows, highlights |
| `create_upgrade_events` | upgrade_events | id, user_id, event_type, feature, tier, created_at |

### New Files Summary (All Phases)

| File | Purpose |
|------|---------|
| `components/common/UpgradePrompt.js` | Reusable upgrade CTA |
| `components/common/AdBanner.js` | Ad integration with premium gate |
| `components/common/SubscriptionBadge.js` | Tier badge (crown/diamond) |
| `components/settings/ThemeSelector.js` | Board theme picker |
| `components/analysis/OpeningExplorer.js` | Opening database panel |
| `components/analysis/AnnotationPanel.js` | Game notes/arrows |
| `config/boardThemes.js` | Theme definitions |
| `utils/pgnExportUtils.js` | PGN generation |
| `utils/pdfExportUtils.js` | PDF report generation |

### Modified Files Summary (All Phases)

| File | Changes |
|------|---------|
| `components/play/GameControls.js` | Undo upgrade prompt |
| `components/play/GameReview.js` | Analytics gate + export + explorer |
| `components/GameEndCard.js` | Post-game ad + upgrade prompt |
| `components/DetailedStatsModal.js` | Blurred premium stats |
| `components/Profile.js` | Theme selector section |
| `components/lobby/PlayersList.jsx` | Subscription badge |
| `components/lobby/MatchmakingQueue.jsx` | Priority badge |
| `pages/LobbyPage.js` | Synthetic toggle + ad sidebar |
| `pages/GameHistoryPage.js` | History depth limit |

---

## Success Metrics

### KPIs to Track

| Metric | Target | Tool |
|--------|--------|------|
| Free → Premium conversion | 3%+ | Analytics events |
| Free → Pro conversion | 0.5%+ | Analytics events |
| Upgrade prompt CTR | 5%+ | Event tracking |
| Premium churn (monthly) | <8% | Razorpay dashboard |
| Pro churn (monthly) | <5% | Razorpay dashboard |
| Ad revenue per free user | ₹3/day | AdSense dashboard |
| DAU/MAU ratio | 30%+ | Analytics |
| Avg session duration (premium) | +20% vs free | Analytics |

### A/B Test Recommendations

1. **Upsell modal timing**: After 3rd game vs after 5th game
2. **Ad frequency**: Every 3rd game vs every 5th game
3. **Free theme count**: 2 free themes vs 3 free themes
4. **History limit**: 10 games vs 20 games for free users
5. **Blurred vs hidden**: Blurred premium stats vs completely hidden

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Too aggressive gating drives users away | Start with soft gates (blurred previews, late prompts), A/B test |
| Ad revenue lower than expected | Use multiple ad networks, optimize placements |
| Low conversion despite features | Offer 7-day free trial of Premium |
| Pro features not compelling enough | Bundle opening explorer + annotations as "Analysis Suite" |
| Payment failures in India | Support UPI, net banking alongside cards via Razorpay |
| Competition (Lichess is free) | Focus on Indian market, Hindi/Telugu localization, school system |

---

## Quick Start Checklist

- [ ] Create `UpgradePrompt` component
- [ ] Add upgrade prompts to 3 highest-traffic locations
- [ ] Gate advanced analytics behind Pro tier
- [ ] Create board theme config and selector
- [ ] Integrate AdSense with premium exemption
- [ ] Add subscription badges to player lists
- [ ] Set up conversion event tracking
- [ ] Configure Razorpay production keys
- [ ] Create Google AdSense account
- [ ] Deploy Phase 1, measure for 2 weeks before Phase 2
