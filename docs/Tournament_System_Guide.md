# 🏆 Chess Tournament System Architecture Guide

## Overview

Your chess tournament system is a comprehensive platform designed to handle multiple tournament formats, from simple Swiss tournaments to complex hybrid formats with elimination brackets. The system is built on modern Laravel best practices with proper separation of concerns.

## 📊 Database Architecture

### Core Tables

```
championships                    // Main tournament records
├── id (PK)
├── title
├── description
├── status_id (FK → championship_statuses)
├── format_id (FK → championship_formats)
├── max_participants
├── entry_fee
├── registration_deadline
├── start_date
├── time_control_minutes
├── time_control_increment
├── tournament_config (JSON)
├── created_by (FK → users)
├── organization_id (FK → organizations)
├── visibility (public/private)
├── allow_public_registration
└── deleted_at (soft deletes)

championship_statuses           // Tournament states lookup
├── id: 1 = 'upcoming'
├── id: 2 = 'registration_open'
├── id: 3 = 'in_progress'
├── id: 4 = 'cancelled'
├── id: 5 = 'completed'
├── id: 6 = 'paused'
└── code, label, timestamps

championship_formats          // Tournament type definitions
├── id: 1 = 'swiss_elimination'
├── id: 2 = 'swiss_only'
└── id: 3 = 'elimination_only'

championship_participants     // Player registrations
├── championship_id (FK)
├── user_id (FK)
├── payment_status
├── amount_paid
├── registered_at
├── seed_number (for pairings)
└── withdrawn_at

championship_matches          // Individual games/matches
├── championship_id (FK)
├── round_number
├── round_type (swiss/elimination)
├── player1_id / player2_id (legacy)
├── white_player_id / black_player_id (current)
├── scheduled_at
├── deadline
├── game_id (FK → games)
├── winner_id
├── result_type
├── status
└── auto_generated

championship_standings       // Live tournament rankings
├── championship_id (FK)
├── user_id (FK)
├── rank
├── points
├── wins
├── losses
├── draws
├── buchholz_score
├── sonnenborn_berger
└── tiebreaks
```

## 🎮 Tournament Creation Process

### Step 1: Basic Configuration
```php
// User fills out tournament creation form
$championship = Championship::create([
    'title' => 'Annual Chess Championship',
    'description' => 'Open to all players',
    'format_id' => 2, // Swiss Only
    'max_participants' => 50,
    'entry_fee' => 100.00,
    'time_control_minutes' => 10,
    'time_control_increment' => 5,
    'registration_deadline' => '2025-12-15 23:59:59',
    'start_date' => '2025-12-20 18:00:00',
    'tournament_config' => [
        'total_rounds' => 5,
        'swiss_rounds' => 5,
        'top_qualifiers' => 8,
        'color_assignment_method' => 'balanced',
        'auto_pairing' => true,
        'allow_early_play' => true,
        'default_grace_period_minutes' => 15
    ]
]);
```

### Step 2: Status Progression
```
1. UPCOMING (1) → Registration not yet open
2. REGISTRATION_OPEN (2) → Players can register
3. IN_PROGRESS (3) → Tournament started, pairings generated
4. PAUSED (6) → Tournament temporarily suspended
5. COMPLETED (5) → All rounds finished
6. CANCELLED (4) → Tournament cancelled
```

### Step 3: Registration Flow
```php
// Player wants to join tournament
$participant = ChampionshipParticipant::create([
    'championship_id' => $championship->id,
    'user_id' => $user->id,
    'payment_status' => 'completed', // pending/completed/refunded
    'amount_paid' => $championship->entry_fee,
    'registered_at' => now(),
    'seed_number' => $this->calculateInitialSeed($championship)
]);
```

## 🔄 Match Generation System

### Swiss Pairing Algorithm
```php
class SwissPairingService
{
    public function generatePairings($participants, $round, $previousPairings): array
    {
        // 1. Sort by current standings (points, tiebreaks)
        $sortedParticipants = $this->sortByStandings($participants);

        // 2. Avoid repeat pairings when possible
        $pairings = [];
        $paired = [];

        foreach ($sortedParticipants as $player) {
            $opponent = $this->findBestOpponent($player, $sortedParticipants, $paired);

            if ($opponent) {
                $pairings[] = [
                    'white_player_id' => $this->assignColor($player, $opponent, true),
                    'black_player_id' => $this->assignColor($opponent, $player, false),
                    'round_number' => $round
                ];
                $paired[] = $player->id;
                $paired[] = $opponent->id;
            } else {
                // Bye for odd number of players
                $pairings[] = [
                    'white_player_id' => $player->id,
                    'black_player_id' => null, // Bye
                    'round_number' => $round,
                    'result' => 'bye' // Automatic point
                ];
                $paired[] = $player->id;
            }
        }

        return $pairings;
    }
}
```

### Elimination Bracket Integration
```php
class EliminationBracketService
{
    public function generateEliminationRound($standings, $topQualifiers): array
    {
        // Take top N players from Swiss standings
        $qualified = $standings->take($topQualifiers);

        // Generate single-elimination bracket
        $bracket = [];
        $count = count($qualified);

        // Round of 1: 1 vs N/2, 2 vs N/2-1, etc.
        for ($i = 0; $i < $count / 2; $i++) {
            $bracket[] = [
                'round' => 'elimination_round_1',
                'match_number' => $swissRounds + 1,
                'white_player_id' => $qualified[$i]->id,
                'black_player_id' => $qualified[$count - 1 - $i]->id,
            ];
        }

        return $bracket;
    }
}
```

## 🏅 Admin vs User Capabilities

### Platform Admin (nalamara.arun@gmail.com)
```php
// Can do everything
✅ Create any tournament format
✅ Modify all tournament settings
✅ Start/pause/complete tournaments
✅ Manage registrations
✅ Override pairings
✅ Generate any round
✅ Force delete tournaments
✅ Access all admin panels
✅ Set registration requirements
```

### Tournament Organizer
```php
// Limited to their own tournaments
✅ Create tournaments under their organization
✅ Start/pause/complete their tournaments
✅ Manage registrations for their tournaments
✅ Generate pairings for their tournaments
❌ Cannot access other organizers' tournaments
❌ Cannot access platform-wide admin
```

### Regular Player
```php
// Standard registered user
✅ View public tournaments
✅ Register for open tournaments
✅ View their own matches
✅ View standings
✅ Play their assigned games
✅ Update their profile
✅ Join organizations they're invited to
❌ Cannot create tournaments (unless promoted)
❌ Cannot access admin panels
❌ Cannot manage other players
```

## 🎯 Tournament Types Explained

### 1. Swiss Only (Most Common)
```php
'format_id' => 2, // Swiss Only
'tournament_config' => [
    'total_rounds' => 5,
    'swiss_rounds' => 5,
    'pairing_system' => 'swiss',
    'scoring_system' => '1-0-0.5', // Win-draw-loss
]
```

**Characteristics:**
- Players play same number of rounds
- Paired with similar scores
- Winner determined by final standings
- No elimination phase

### 2. Swiss + Elimination (Hybrid)
```php
'format_id' => 1, // Swiss Elimination
'tournament_config' => [
    'total_rounds' => 7, // 5 Swiss + 2 Elimination
    'swiss_rounds' => 5,
    'top_qualifiers' => 8,
    'elimination_rounds' => 2,
    'scoring_swiss' => '1-0-0.5',
    'scoring_elimination' => '1-0', // Win-loss only
]
```

**Progression:**
1. **Swiss Phase (5 rounds):** All players participate
2. **Elimination Phase (2 rounds):** Top 8 qualify, single-elimination
3. **Champion determined** by elimination bracket winner

### 3. Elimination Only
```php
'format_id' => 3, // Elimination Only
'tournament_config' => [
    'elimination_type' => 'single',
    'elimination_rounds' => 'log2(32) + 1', // Rounds needed
    'third_place_match' => true
]
```

## ⚙️ Configuration Options

### Time Control
```php
'time_control_minutes' => 10,     // Base minutes
'time_control_increment' => 5,     // Seconds per move
'time_control_type' => 'standard',   // standard/fischer/bullet
```

### Registration Settings
```php
'allow_public_registration' => true,    // Anyone can join
'max_participants' => 50,             // Player limit
'entry_fee' => 100.00,              // Cost to enter
'registration_deadline' => '2025-12-15', // Last day to join
'min_rating' => 1200,               // Rating requirement
'max_rating' => 2200,               // Rating ceiling
```

### Pairing Preferences
```php
'tournament_config' => [
    'color_assignment_method' => 'balanced',  // balanced/alternating/random
    'auto_pairing' => true,             // Automatic vs manual
    'pairing_optimization' => true,       // Optimize for best matchups
    'avoid_repeat_pairings' => 2,        // Don't repeat for X rounds
    'rating_difference_limit' => 200,     // Max rating gap
]
```

## 📱 Real-time Features

### WebSocket Integration
```javascript
// Live game updates
websocket://localhost:8080/game/{championshipId}/{matchId}

// Features:
- Real-time move broadcasting
- Automatic timeouts
- Move validation
- Chat between players
- Spectator mode
- Tournament clock sync
```

### Match Scheduling
```php
class MatchSchedulerService
{
    public function scheduleNextRound($championship): void
    {
        // 1. Check if current round complete
        if (!$this->isCurrentRoundComplete($championship)) {
            return;
        }

        // 2. Generate pairings for next round
        $pairings = $this->generatePairings(
            $championship->participants,
            $championship->current_round + 1
        );

        // 3. Create match records
        foreach ($pairings as $pairing) {
            ChampionshipMatch::create([
                'championship_id' => $championship->id,
                'round_number' => $championship->current_round + 1,
                'scheduled_at' => now()->addHours(24), // 24-hour window
                'deadline' => now()->addHours(48),  // 48-hour deadline
                'status' => 'pending'
            ]);
        }

        // 4. Update championship current round
        $championship->update([
            'current_round' => $championship->current_round + 1
        ]);
    }
}
```

## 🎨 Frontend Architecture

### Component Structure
```javascript
src/
├── components/championship/
│   ├── ChampionshipList.jsx          // Tournament browser
│   ├── CreateChampionshipModal.jsx  // Creation wizard
│   ├── ChampionshipDetails.jsx       // Individual tournament view
│   ├── ChampionshipManagement.jsx  // Admin dashboard
│   └── RegistrationModal.jsx      // Sign-up flow
├── contexts/
│   └── ChampionshipContext.js     // Global tournament state
└── services/
    └── championshipAPI.js           // API calls
```

### State Management
```javascript
const ChampionshipContext = {
    championships: [],        // All tournaments
    activeChampionshipId: null,  // Currently selected
    loading: false,           // Loading states
    error: null,             // Error messages

    // Actions
    fetchChampionships: () => {},
    createChampionship: (data) => {},
    registerForChampionship: (id) => {},
    startChampionship: (id) => {},
    pauseChampionship: (id) => {},
    completeChampionship: (id) => {},
    archiveChampionship: (id) => {}
};
```

### Route Protection
```php
Route::middleware('auth:sanctum')->prefix('championships')->group(function () {
    // Public routes
    Route::get('/', [ChampionshipController::class, 'index']);
    Route::get('/{id}', [ChampionshipController::class, 'show']);

    // Protected routes (requires login)
    Route::post('/{id}/register', [ChampionshipRegistrationController::class, 'register']);
    Route::get('/{id}/my-matches', [ChampionshipController::class, 'myMatches']);

    // Admin routes (requires 'manage' permission)
    Route::middleware('can:manage,championship')->group(function () {
        Route::post('/{id}/start', [TournamentAdminController::class, 'startChampionship']);
        Route::post('/{id}/pause', [TournamentAdminController::class, 'pauseChampionship']);
        Route::delete('/{id}', [ChampionshipController::class, 'destroy']);
    });
});
```

## 🔧 Advanced Features

### Tiebreak System
```php
// Buchholz Score: Sum of opponents' scores
$buchholzScore = array_sum($opponentScores);

// Sonneborn-Berger: Sum of scores of defeated opponents
$sonnenbornBerger = array_sum($defeatedOpponentScores);

// Final ranking: Points → Buchholz → Sonneborn-Berger → Head-to-head
```

### Bye Point Handling
```php
class MatchGenerator
{
    public function handleBye($participant, $round): void
    {
        // Automatic point awarded for bye
        $standing = ChampionshipStanding::firstOrCreate([
            'championship_id' => $championship->id,
            'user_id' => $participant->user_id
        ]);

        $standing->update([
            'points' => DB::raw('points + 1.0'), // Automatic point
            'byes' => DB::raw('byes + 1'),
            'rounds_played' => DB::raw('rounds_played + 1')
        ]);
    }
}
```

### Payment Integration
```php
class ChampionshipRegistration
{
    public function processPayment($championshipId, $userId, $paymentMethod): JsonResponse
    {
        // 1. Create registration record
        $participant = ChampionshipParticipant::create([
            'championship_id' => $championshipId,
            'user_id' => $userId,
            'payment_status' => 'pending',
            'amount_paid' => $entryFee
        ]);

        // 2. Process with payment gateway
        $paymentResult = $this->paymentGateway->process([
            'amount' => $entryFee,
            'method' => $paymentMethod,
            'tournament_id' => $championshipId,
            'user_id' => $userId
        ]);

        // 3. Update registration status
        if ($paymentResult->success) {
            $participant->update([
                'payment_status' => 'completed',
                'payment_id' => $paymentResult->transactionId,
                'paid_at' => now()
            ]);

            return response()->json(['status' => 'registered']);
        } else {
            $participant->update([
                'payment_status' => 'failed'
            ]);

            return response()->json(['error' => 'Payment failed'], 400);
        }
    }
}
```

## 🚀 Performance Optimizations

### Database Indexes
```sql
-- Critical performance indexes
CREATE INDEX idx_championships_status ON championships(status_id);
CREATE INDEX idx_championships_visibility ON championships(visibility, status_id);
CREATE INDEX idx_championships_created_by ON championships(created_by);
CREATE INDEX idx_championships_org ON championships(organization_id, status_id);

CREATE INDEX idx_participants_champ_user ON championship_participants(championship_id, user_id);
CREATE INDEX idx_participants_status ON championship_participants(payment_status);

CREATE INDEX idx_matches_champ_round ON championship_matches(championship_id, round_number);
CREATE INDEX idx_matches_status ON championship_matches(status_id);
CREATE INDEX idx_matches_players ON championship_matches(white_player_id, black_player_id);

CREATE INDEX idx_standings_champ_user ON championship_standings(championship_id, user_id);
CREATE INDEX idx_standings_ranking ON championship_standings(championship_id, points DESC, rank ASC);
```

### Query Optimization
```php
// Use resource classes for different contexts
class ChampionshipListResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status,
            'participant_count' => $this->whenCounted('participants'),
            'entry_fee' => $this->entry_fee,
            // Excludes expensive relationships for list views
        ];
    }
}

class ChampionshipDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            // Includes all relationships for detail views
            'participants' => ChampionshipParticipantResource::collection($this->participants),
            'matches' => ChampionshipMatchResource::collection($this->matches),
            'standings' => ChampionshipStandingResource::collection($this->standings),
        ];
    }
}
```

## 🛡️ Security & Validation

### Permission System
```php
// Policy-based authorization
class ChampionshipPolicy
{
    public function update(User $user, Championship $championship): bool
    {
        // Owner can edit
        if ($championship->created_by === $user->id) return true;

        // Admin can edit
        if ($user->hasRole('platform_admin')) return true;

        // Tournament organizer can edit their tournaments
        if ($this->isOrganizer($user, $championship)) return true;

        return false;
    }

    public function delete(User $user, Championship $championship): bool
    {
        // Cannot delete if matches are in progress
        if ($championship->matches()->where('status', 'in_progress')->exists()) {
            return false;
        }

        return $this->update($user, $championship);
    }
}
```

### Input Validation
```php
class ChampionshipRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'max_participants' => 'required|integer|min:2|max:1024',
            'entry_fee' => 'required|numeric|min:0|max:10000',
            'time_control_minutes' => 'required|integer|min:1|max:180',
            'registration_deadline' => 'required|date|after:today',
            'start_date' => 'required|date|after:registration_deadline',
            'format_id' => 'required|exists:championship_formats,id',
            'tournament_config.total_rounds' => 'required|integer|min:1|max:50',
            'tournament_config.swiss_rounds' => 'required_if:format_id,2|integer|min:1|max:50',
        ];
    }
}
```

---

This architecture supports tournaments from 2 to 1024+ participants, handles multiple formats simultaneously, and provides comprehensive real-time features. The system is designed for scalability with proper indexing, caching strategies, and clean separation of concerns.