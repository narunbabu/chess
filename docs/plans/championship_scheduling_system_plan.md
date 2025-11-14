# Championship Scheduling System - Comprehensive Implementation Plan
**Date:** November 14, 2025
**Status:** 📋 **PLANNING**
**Priority:** 🔴 **HIGH**

---

## 🎯 Executive Summary

Complete championship scheduling system where:
- **Admin** creates and publishes matches for each round
- **Players** see matches with deadlines, can schedule flexible play times
- **System** auto-creates games when both players are ready
- **Notifications** remind players of scheduled matches
- **Round progression** happens automatically when all matches complete
- **Draw rules** are comprehensively implemented

---

## 📊 System Flow Overview

```
┌─────────────────────────────────────────────────────────┐
│ 1. ADMIN CREATES ROUND                                  │
│    → Generate matches (automatic pairing)               │
│    → Or manually create matches                         │
│    → Set round deadline                                 │
│    → Publish matches to participants                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. PLAYERS SEE MATCHES                                  │
│    → "My Matches" tab shows assigned matches            │
│    → Each match has: opponent, colors, deadline         │
│    → Status: pending_schedule, scheduled, in_progress   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. SCHEDULING OPTIONS                                   │
│                                                          │
│ Option A: DIRECT PLAY (if opponent online)              │
│    → Player clicks "Play Now"                           │
│    → Opponent receives real-time notification           │
│    → Opponent clicks "Accept" → Game starts immediately │
│                                                          │
│ Option B: SCHEDULE FOR LATER                            │
│    → Player proposes time: "Tomorrow 3 PM"              │
│    → Opponent must: Accept OR propose alternative time  │
│    → Cannot decline (must play within deadline)         │
│    → Once agreed, both players notified                 │
│                                                          │
│ Option C: PLAY AT SCHEDULED TIME                        │
│    → When scheduled time arrives, notification sent     │
│    → Either player can initiate game                    │
│    → Game opens, waiting for opponent (10 min grace)    │
│    → If opponent doesn't join → auto-loss by timeout    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. GAME PLAYS                                           │
│    → Game created with championship context             │
│    → Time control from championship settings            │
│    → Draw detection: 50-move, threefold, stalemate, etc │
│    → Result auto-reports to championship                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. ROUND COMPLETION                                     │
│    → When ALL matches in round finish                   │
│    → Standings updated: Win +1, Loss -1, Draw 0         │
│    → System checks if all matches complete              │
│    → Auto-generates next round (if configured)          │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema Changes

### 1. New Table: `championship_match_schedules`
```sql
CREATE TABLE championship_match_schedules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    championship_match_id BIGINT NOT NULL,
    proposed_by_user_id BIGINT NOT NULL,
    proposed_time DATETIME NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending',
    responded_by_user_id BIGINT NULL,
    responded_at DATETIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (championship_match_id) REFERENCES championship_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (proposed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (responded_by_user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_match_id (championship_match_id),
    INDEX idx_proposed_time (proposed_time),
    INDEX idx_status (status)
);
```

### 2. Update Table: `championship_matches`
```sql
ALTER TABLE championship_matches ADD COLUMN IF NOT EXISTS scheduled_time DATETIME NULL;
ALTER TABLE championship_matches ADD COLUMN IF NOT EXISTS agreed_by_both BOOLEAN DEFAULT FALSE;
ALTER TABLE championship_matches ADD COLUMN IF NOT EXISTS game_initiated_at DATETIME NULL;
ALTER TABLE championship_matches ADD COLUMN IF NOT EXISTS game_timeout_at DATETIME NULL; -- 10 min after initiation
ALTER TABLE championship_matches MODIFY COLUMN status ENUM(
    'pending',
    'pending_schedule',
    'scheduled',
    'game_initiated',
    'in_progress',
    'completed',
    'timeout',
    'forfeit'
) DEFAULT 'pending_schedule';
```

### 3. Update Table: `championships`
```sql
ALTER TABLE championships ADD COLUMN IF NOT EXISTS instructions TEXT NULL;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS scheduling_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS direct_play_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS game_initiation_timeout_minutes INT DEFAULT 10;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS auto_progress_rounds BOOLEAN DEFAULT FALSE;
```

### 4. Update Table: `games`
```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS initiated_by_user_id BIGINT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS waiting_for_opponent BOOLEAN DEFAULT FALSE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS opponent_join_deadline DATETIME NULL;

-- Ensure draw detection fields exist
ALTER TABLE games ADD COLUMN IF NOT EXISTS halfmove_clock INT DEFAULT 0; -- For 50-move rule
ALTER TABLE games ADD COLUMN IF NOT EXISTS position_history JSON NULL; -- For threefold repetition
ALTER TABLE games ADD COLUMN IF NOT EXISTS draw_offer_by BIGINT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS draw_offer_at DATETIME NULL;
```

---

## 🔧 Backend Implementation

### Phase 1: Match Scheduling Service

#### File: `app/Services/ChampionshipMatchSchedulingService.php`
```php
<?php

namespace App\Services;

use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\User;
use App\Events\MatchScheduleProposed;
use App\Events\MatchScheduleAccepted;
use App\Events\MatchScheduleRejected;
use App\Events\DirectPlayRequested;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChampionshipMatchSchedulingService
{
    /**
     * Propose a scheduled time for a match
     */
    public function proposeSchedule(
        ChampionshipMatch $match,
        User $proposer,
        Carbon $proposedTime,
        ?string $notes = null
    ): ChampionshipMatchSchedule {
        // Validate proposer is a participant
        if (!$match->hasPlayer($proposer->id)) {
            throw new \InvalidArgumentException('User is not a participant in this match');
        }

        // Validate proposed time is within deadline
        if ($proposedTime->isAfter($match->deadline)) {
            throw new \InvalidArgumentException('Proposed time exceeds match deadline');
        }

        // Validate proposed time is in the future
        if ($proposedTime->isPast()) {
            throw new \InvalidArgumentException('Proposed time must be in the future');
        }

        // Create schedule proposal
        $schedule = ChampionshipMatchSchedule::create([
            'championship_match_id' => $match->id,
            'proposed_by_user_id' => $proposer->id,
            'proposed_time' => $proposedTime,
            'notes' => $notes,
            'status' => 'pending',
        ]);

        // Update match status
        $match->update(['status' => 'pending_schedule']);

        // Get opponent
        $opponent = $match->getOpponent($proposer->id);

        // Broadcast event to opponent
        broadcast(new MatchScheduleProposed($schedule, $match, $proposer, $opponent));

        Log::info("Match schedule proposed", [
            'match_id' => $match->id,
            'proposer_id' => $proposer->id,
            'proposed_time' => $proposedTime->toISOString(),
        ]);

        return $schedule;
    }

    /**
     * Accept a schedule proposal
     */
    public function acceptSchedule(
        ChampionshipMatchSchedule $schedule,
        User $responder
    ): array {
        $match = $schedule->match;

        // Validate responder is the opponent
        $opponent = $match->getOpponent($schedule->proposed_by_user_id);
        if ($opponent->id !== $responder->id) {
            throw new \InvalidArgumentException('Only the opponent can accept this schedule');
        }

        DB::transaction(function () use ($schedule, $responder, $match) {
            // Update schedule
            $schedule->update([
                'status' => 'accepted',
                'responded_by_user_id' => $responder->id,
                'responded_at' => now(),
            ]);

            // Update match with agreed schedule
            $match->update([
                'scheduled_time' => $schedule->proposed_time,
                'agreed_by_both' => true,
                'status' => 'scheduled',
            ]);
        });

        // Broadcast to both players
        broadcast(new MatchScheduleAccepted($schedule, $match));

        return [
            'message' => 'Schedule accepted',
            'schedule' => $schedule,
            'match' => $match->fresh(),
        ];
    }

    /**
     * Reject schedule and propose alternative
     */
    public function rejectAndPropose(
        ChampionshipMatchSchedule $schedule,
        User $responder,
        Carbon $alternativeTime,
        ?string $notes = null
    ): ChampionshipMatchSchedule {
        $match = $schedule->match;

        // Validate responder is the opponent
        $opponent = $match->getOpponent($schedule->proposed_by_user_id);
        if ($opponent->id !== $responder->id) {
            throw new \InvalidArgumentException('Only the opponent can respond to this schedule');
        }

        DB::transaction(function () use ($schedule, $responder) {
            // Mark original as rejected
            $schedule->update([
                'status' => 'rejected',
                'responded_by_user_id' => $responder->id,
                'responded_at' => now(),
            ]);
        });

        // Broadcast rejection
        broadcast(new MatchScheduleRejected($schedule, $match));

        // Create new proposal with alternative time
        return $this->proposeSchedule($match, $responder, $alternativeTime, $notes);
    }

    /**
     * Request direct play (opponent is online)
     */
    public function requestDirectPlay(
        ChampionshipMatch $match,
        User $requester
    ): array {
        // Validate requester is a participant
        if (!$match->hasPlayer($requester->id)) {
            throw new \InvalidArgumentException('User is not a participant in this match');
        }

        // Check if match already has a game
        if ($match->game_id) {
            throw new \InvalidArgumentException('Game already exists for this match');
        }

        // Get opponent
        $opponent = $match->getOpponent($requester->id);

        // Check if opponent is online (using presence system)
        if (!$this->isUserOnline($opponent->id)) {
            throw new \InvalidArgumentException('Opponent is not currently online');
        }

        // Broadcast direct play request to opponent
        broadcast(new DirectPlayRequested($match, $requester, $opponent));

        return [
            'message' => 'Direct play request sent to opponent',
            'match' => $match,
            'opponent' => $opponent,
        ];
    }

    /**
     * Accept direct play request and create game immediately
     */
    public function acceptDirectPlay(
        ChampionshipMatch $match,
        User $acceptor
    ): array {
        // Validate acceptor is a participant
        if (!$match->hasPlayer($acceptor->id)) {
            throw new \InvalidArgumentException('User is not a participant in this match');
        }

        // Create game immediately
        $game = $this->createGameForMatch($match);

        return [
            'message' => 'Direct play accepted - Game created',
            'match' => $match->fresh(),
            'game' => $game,
        ];
    }

    /**
     * Initiate game at scheduled time
     */
    public function initiateScheduledGame(
        ChampionshipMatch $match,
        User $initiator
    ): array {
        // Validate initiator is a participant
        if (!$match->hasPlayer($initiator->id)) {
            throw new \InvalidArgumentException('User is not a participant in this match');
        }

        // Validate match is scheduled
        if ($match->status !== 'scheduled') {
            throw new \InvalidArgumentException('Match is not in scheduled status');
        }

        // Validate scheduled time has arrived or passed
        if ($match->scheduled_time && $match->scheduled_time->isFuture()) {
            throw new \InvalidArgumentException('Scheduled time has not arrived yet');
        }

        $championship = $match->championship;
        $timeoutMinutes = $championship->game_initiation_timeout_minutes ?? 10;

        // Create game with "waiting for opponent" status
        $game = $this->createGameForMatch($match, $initiator, true);

        // Update match
        $match->update([
            'status' => 'game_initiated',
            'game_initiated_at' => now(),
            'game_timeout_at' => now()->addMinutes($timeoutMinutes),
        ]);

        // Broadcast to opponent
        $opponent = $match->getOpponent($initiator->id);
        broadcast(new GameInitiated($game, $match, $initiator, $opponent));

        return [
            'message' => 'Game initiated - Waiting for opponent',
            'game' => $game,
            'match' => $match->fresh(),
            'timeout_at' => $match->game_timeout_at,
        ];
    }

    /**
     * Join initiated game
     */
    public function joinInitiatedGame(
        ChampionshipMatch $match,
        User $joiner
    ): array {
        // Validate joiner is a participant
        if (!$match->hasPlayer($joiner->id)) {
            throw new \InvalidArgumentException('User is not a participant in this match');
        }

        // Validate match has initiated game
        if ($match->status !== 'game_initiated') {
            throw new \InvalidArgumentException('No game has been initiated for this match');
        }

        // Check if timeout has passed
        if ($match->game_timeout_at && $match->game_timeout_at->isPast()) {
            // Timeout - joiner forfeits
            return $this->handleGameTimeout($match, $joiner);
        }

        $game = $match->game;

        // Update game to active
        $game->update([
            'waiting_for_opponent' => false,
            'status' => 'active',
            'started_at' => now(),
        ]);

        // Update match
        $match->update(['status' => 'in_progress']);

        return [
            'message' => 'Joined game - Match is now in progress',
            'game' => $game->fresh(),
            'match' => $match->fresh(),
        ];
    }

    /**
     * Handle game timeout (opponent didn't join)
     */
    private function handleGameTimeout(ChampionshipMatch $match, User $absentPlayer): array
    {
        $initiator = User::find($match->game->initiated_by_user_id);

        // Initiator wins by timeout
        $result = $initiator->id === $match->white_player_id ? '1-0' : '0-1';

        $game = $match->game;
        $game->update([
            'status' => 'completed',
            'result' => $result,
            'completed_at' => now(),
            'termination_reason' => 'timeout',
        ]);

        $match->update([
            'status' => 'timeout',
            'result' => $result,
            'winner_id' => $initiator->id,
        ]);

        // Update standings
        app(StandingsCalculatorService::class)->updateAfterMatch($match);

        return [
            'message' => 'Opponent failed to join - Win by timeout',
            'game' => $game,
            'match' => $match->fresh(),
            'result' => $result,
        ];
    }

    /**
     * Create game for a championship match
     */
    private function createGameForMatch(
        ChampionshipMatch $match,
        ?User $initiator = null,
        bool $waitingForOpponent = false
    ): \App\Models\Game {
        $championship = $match->championship;

        $game = \App\Models\Game::create([
            'white_player_id' => $match->white_player_id,
            'black_player_id' => $match->black_player_id,
            'time_control' => $championship->time_control ?? 'rapid',
            'initial_time_minutes' => $championship->time_control_minutes ?? 10,
            'increment_seconds' => $championship->time_control_increment ?? 0,
            'championship_match_id' => $match->id,
            'initiated_by_user_id' => $initiator?->id,
            'waiting_for_opponent' => $waitingForOpponent,
            'opponent_join_deadline' => $waitingForOpponent
                ? now()->addMinutes($championship->game_initiation_timeout_minutes ?? 10)
                : null,
            'status' => $waitingForOpponent ? 'waiting' : 'active',
            'started_at' => $waitingForOpponent ? null : now(),
            'halfmove_clock' => 0,
            'position_history' => json_encode([]), // For threefold repetition
        ]);

        // Link game to match
        $match->update([
            'game_id' => $game->id,
            'status' => $waitingForOpponent ? 'game_initiated' : 'in_progress',
        ]);

        Log::info("Game created for championship match", [
            'match_id' => $match->id,
            'game_id' => $game->id,
            'initiator_id' => $initiator?->id,
            'waiting' => $waitingForOpponent,
        ]);

        return $game;
    }

    /**
     * Check if user is online
     */
    private function isUserOnline(int $userId): bool
    {
        // Use presence system to check if user is online
        $presence = \App\Models\UserPresence::where('user_id', $userId)->first();

        if (!$presence) {
            return false;
        }

        // Consider online if last heartbeat was within 2 minutes
        return $presence->last_heartbeat_at &&
               $presence->last_heartbeat_at->greaterThan(now()->subMinutes(2));
    }
}
```

---

### Phase 2: API Routes

#### File: `routes/api.php` (additions)
```php
// Championship match scheduling routes
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('championships/{championship}/matches/{match}')->group(function () {
        // Schedule management
        Route::post('/schedule/propose', [ChampionshipMatchSchedulingController::class, 'proposeSchedule']);
        Route::post('/schedule/{schedule}/accept', [ChampionshipMatchSchedulingController::class, 'acceptSchedule']);
        Route::post('/schedule/{schedule}/reject', [ChampionshipMatchSchedulingController::class, 'rejectSchedule']);
        Route::get('/schedules', [ChampionshipMatchSchedulingController::class, 'getSchedules']);

        // Direct play
        Route::post('/direct-play/request', [ChampionshipMatchSchedulingController::class, 'requestDirectPlay']);
        Route::post('/direct-play/accept', [ChampionshipMatchSchedulingController::class, 'acceptDirectPlay']);

        // Game initiation
        Route::post('/initiate', [ChampionshipMatchSchedulingController::class, 'initiateGame']);
        Route::post('/join', [ChampionshipMatchSchedulingController::class, 'joinGame']);
    });
});
```

---

### Phase 3: WebSocket Events

#### New Events to Create:
```
MatchScheduleProposed
MatchScheduleAccepted
MatchScheduleRejected
DirectPlayRequested
GameInitiated
GameTimeoutWarning
RoundCompleted
```

---

### Phase 4: Draw Detection Rules

#### File: `app/Services/ChessDrawDetectionService.php`
```php
<?php

namespace App\Services;

use App\Models\Game;

class ChessDrawDetectionService
{
    /**
     * Check all draw conditions
     */
    public function checkDrawConditions(Game $game, string $fen): array
    {
        $checks = [
            'stalemate' => $this->isStalemate($fen),
            'insufficient_material' => $this->isInsufficientMaterial($fen),
            'fifty_move_rule' => $this->isFiftyMoveRule($game),
            'threefold_repetition' => $this->isThreefoldRepetition($game, $fen),
        ];

        $isDraw = in_array(true, $checks, true);

        return [
            'is_draw' => $isDraw,
            'draw_reason' => $this->getDrawReason($checks),
            'checks' => $checks,
        ];
    }

    /**
     * Check for stalemate (no legal moves, not in check)
     */
    private function isStalemate(string $fen): bool
    {
        // This requires chess.js or similar library integration
        // For now, placeholder - will integrate with frontend chess.js
        return false;
    }

    /**
     * Check for insufficient material
     * - King vs King
     * - King + Bishop vs King
     * - King + Knight vs King
     * - King + Bishop vs King + Bishop (same color bishops)
     */
    private function isInsufficientMaterial(string $fen): bool
    {
        // Parse FEN to get piece positions
        $piecePlacement = explode(' ', $fen)[0];
        $pieces = preg_replace('/[0-8\/]/', '', $piecePlacement);

        // Remove kings
        $piecesWithoutKings = str_replace(['K', 'k'], '', $pieces);

        // King vs King
        if (strlen($piecesWithoutKings) === 0) {
            return true;
        }

        // King + minor piece vs King
        if (strlen($piecesWithoutKings) === 1) {
            $piece = strtoupper($piecesWithoutKings);
            if ($piece === 'B' || $piece === 'N') {
                return true;
            }
        }

        // King + Bishop vs King + Bishop (same color)
        if (strlen($piecesWithoutKings) === 2) {
            if (strtoupper($piecesWithoutKings) === 'BB') {
                // Check if bishops are on same color squares
                // This requires board position analysis
                // Simplified: assume same color for now
                return true;
            }
        }

        return false;
    }

    /**
     * Check for 50-move rule (75 moves with no pawn move or capture)
     */
    private function isFiftyMoveRule(Game $game): bool
    {
        // Stored in game.halfmove_clock
        return $game->halfmove_clock >= 75; // 75 moves = 50 full moves
    }

    /**
     * Check for threefold repetition
     */
    private function isThreefoldRepetition(Game $game, string $currentFen): bool
    {
        // Get position history from game
        $positionHistory = json_decode($game->position_history ?? '[]', true);

        // Add current position
        $positionHistory[] = $this->normalizePosition($currentFen);

        // Count occurrences of current position
        $currentPosition = $this->normalizePosition($currentFen);
        $count = array_count_values($positionHistory)[$currentPosition] ?? 0;

        return $count >= 3;
    }

    /**
     * Normalize position for comparison (ignore move counters)
     */
    private function normalizePosition(string $fen): string
    {
        $parts = explode(' ', $fen);
        // Use only piece placement, active color, castling, and en passant
        return implode(' ', array_slice($parts, 0, 4));
    }

    /**
     * Get draw reason from checks
     */
    private function getDrawReason(array $checks): ?string
    {
        if ($checks['stalemate']) return 'stalemate';
        if ($checks['insufficient_material']) return 'insufficient_material';
        if ($checks['fifty_move_rule']) return 'fifty_move_rule';
        if ($checks['threefold_repetition']) return 'threefold_repetition';
        return null;
    }

    /**
     * Update position history for threefold detection
     */
    public function updatePositionHistory(Game $game, string $fen): void
    {
        $positionHistory = json_decode($game->position_history ?? '[]', true);
        $positionHistory[] = $this->normalizePosition($fen);

        // Keep last 100 positions (sufficient for detection)
        if (count($positionHistory) > 100) {
            $positionHistory = array_slice($positionHistory, -100);
        }

        $game->update(['position_history' => json_encode($positionHistory)]);
    }

    /**
     * Update halfmove clock for 50-move rule
     */
    public function updateHalfmoveClock(Game $game, bool $isPawnMove, bool $isCapture): void
    {
        if ($isPawnMove || $isCapture) {
            // Reset to 0
            $game->update(['halfmove_clock' => 0]);
        } else {
            // Increment
            $game->increment('halfmove_clock');
        }
    }
}
```

---

## 🎨 Frontend Implementation

### Component 1: Match Scheduling Card
```javascript
// chess-frontend/src/components/championship/MatchSchedulingCard.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

const MatchSchedulingCard = ({ match, currentUserId, onUpdate }) => {
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [proposedTime, setProposedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const opponent = match.white_player_id === currentUserId
    ? match.black_player
    : match.white_player;

  const userColor = match.white_player_id === currentUserId ? 'White' : 'Black';

  const handleProposeSchedule = async () => {
    if (!proposedTime) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/championships/${match.championship_id}/matches/${match.id}/schedule/propose`,
        {
          proposed_time: proposedTime,
          notes: notes,
        }
      );

      if (response.data.success) {
        onUpdate();
        setShowScheduleForm(false);
        alert('Schedule proposed successfully!');
      }
    } catch (err) {
      console.error('Failed to propose schedule:', err);
      alert('Failed to propose schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectPlay = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/championships/${match.championship_id}/matches/${match.id}/direct-play/request`
      );

      if (response.data.success) {
        alert('Direct play request sent to opponent!');
      }
    } catch (err) {
      console.error('Failed to request direct play:', err);
      alert(err.response?.data?.message || 'Opponent is not online');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateGame = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/championships/${match.championship_id}/matches/${match.id}/initiate`
      );

      if (response.data.success && response.data.data.game) {
        // Navigate to game
        window.location.href = `/play/${response.data.data.game.id}`;
      }
    } catch (err) {
      console.error('Failed to initiate game:', err);
      alert('Failed to initiate game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="match-scheduling-card">
      <div className="match-header">
        <h4>Round {match.round_number} - Board {match.board_number}</h4>
        <span className={`status-badge ${match.status}`}>{match.status}</span>
      </div>

      <div className="match-details">
        <div className="player-info">
          <span className="you">You ({userColor})</span>
          <span className="vs">vs</span>
          <span className="opponent">{opponent.name} ({userColor === 'White' ? 'Black' : 'White'})</span>
        </div>

        <div className="deadline">
          <strong>Deadline:</strong> {new Date(match.deadline).toLocaleString()}
        </div>

        {match.scheduled_time && (
          <div className="scheduled-time">
            <strong>Scheduled:</strong> {new Date(match.scheduled_time).toLocaleString()}
            {match.agreed_by_both && <span className="agreed">✓ Agreed by both</span>}
          </div>
        )}
      </div>

      <div className="match-actions">
        {match.status === 'pending_schedule' && (
          <>
            <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="btn-secondary">
              📅 Schedule Time
            </button>
            <button onClick={handleDirectPlay} className="btn-primary" disabled={loading}>
              ⚡ Play Now
            </button>
          </>
        )}

        {match.status === 'scheduled' && match.agreed_by_both && (
          <button onClick={handleInitiateGame} className="btn-primary" disabled={loading}>
            🎮 Start Game
          </button>
        )}

        {match.status === 'game_initiated' && (
          <div className="game-waiting">
            <p>Game initiated - Waiting for opponent to join</p>
            <p className="timeout-warning">
              Timeout in {/* countdown timer */}
            </p>
          </div>
        )}
      </div>

      {showScheduleForm && (
        <div className="schedule-form">
          <h5>Propose a Time</h5>
          <input
            type="datetime-local"
            value={proposedTime}
            onChange={(e) => setProposedTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            max={new Date(match.deadline).toISOString().slice(0, 16)}
          />
          <textarea
            placeholder="Optional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="form-actions">
            <button onClick={handleProposeSchedule} disabled={loading || !proposedTime}>
              Propose
            </button>
            <button onClick={() => setShowScheduleForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchSchedulingCard;
```

---

## 📋 Implementation Roadmap

### **Week 1: Database & Backend Core**
- [ ] Day 1-2: Database migrations (tables + columns)
- [ ] Day 3-4: ChampionshipMatchSchedulingService
- [ ] Day 5: API routes and controllers
- [ ] Day 6-7: WebSocket events

### **Week 2: Frontend Components**
- [ ] Day 1-2: MatchSchedulingCard component
- [ ] Day 3: Schedule proposal/acceptance UI
- [ ] Day 4: Direct play integration
- [ ] Day 5-7: Notifications and real-time updates

### **Week 3: Draw Detection & Round Progression**
- [ ] Day 1-3: ChessDrawDetectionService
- [ ] Day 4-5: Integrate draw detection in game moves
- [ ] Day 6-7: Auto-round progression logic

### **Week 4: Championship Instructions & Polish**
- [ ] Day 1-2: Championship instructions system
- [ ] Day 3-4: Notification system refinement
- [ ] Day 5-7: Testing and bug fixes

---

## 🧪 Testing Scenarios

### Scenario 1: Scheduled Play
1. Admin creates round 1
2. Player A proposes time: "Tomorrow 3 PM"
3. Player B receives notification
4. Player B accepts
5. Both receive confirmation
6. Tomorrow at 3 PM, both receive reminder
7. Player A clicks "Start Game"
8. Game opens, waiting for Player B (10 min)
9. Player B joins within 10 min
10. Game starts normally

### Scenario 2: Direct Play
1. Player A sees Player B is online
2. Player A clicks "Play Now"
3. Player B receives instant notification
4. Player B accepts
5. Game creates immediately
6. Both navigate to game

### Scenario 3: Timeout
1. Scheduled time arrives
2. Player A initiates game
3. Player B doesn't join within 10 min
4. Player A wins by timeout
5. Result records, standings update

---

**Status:** Ready for implementation
**Next Step:** Create database migrations
