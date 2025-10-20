# Rating System Implementation - Complete Guide

**Date**: 2025-01-17
**Status**: ✅ Core implementation complete, integration pending
**Impact**: Game-wide scoring consistency, personalized difficulty scaling

---

## 🎯 Overview

Implemented a comprehensive Elo-based rating system with:
- Skill assessment for new users
- Opponent-based difficulty scaling
- Provisional rating period (first 20 games)
- Consistent scoring across computer and multiplayer games

---

## 📊 Problem Solved

### Before
- **Computer games**: Hardcoded DEFAULT_RATING (1200), difficulty scaling by computer level (1-16)
- **Multiplayer games**: Real user rating, no difficulty scaling (hardcoded level 1)
- **Result**: 2.2x scoring discrepancy between game modes

### After
- **Both modes**: Use real user ratings for skill-appropriate multipliers
- **Computer games**: Keep difficulty scaling based on computer level
- **Multiplayer games**: NEW - Difficulty scaling based on opponent rating
- **Result**: Fair, consistent scoring aligned with opponent strength

---

## 🗄️ Database Changes

### Migration: `2025_01_17_100000_add_rating_system_to_users_table.php`

**New Fields**:
```php
'rating' => integer, default 1200      // Current Elo rating
'is_provisional' => boolean, default true  // First 20 games
'games_played' => integer, default 0   // Game counter
'peak_rating' => integer, default 1200 // Highest rating achieved
'rating_last_updated' => timestamp, nullable  // Last update time
```

**Indexes Added**:
- `rating` (for leaderboard queries)
- `peak_rating` (for historical rankings)

**Rollback Support**: Complete down() migration provided

---

## 🔧 Backend Implementation

### User Model Updates (`app/Models/User.php`)

**New Fillable Fields**:
```php
'rating', 'is_provisional', 'games_played', 'peak_rating', 'rating_last_updated'
```

**New Methods**:

1. **`getKFactorAttribute()`** - Calculate K-factor dynamically
   - Provisional (< 20 games): K=64 (fast convergence)
   - Active (< 2000 rating): K=32
   - Strong (2000-2399): K=16
   - Expert (2400+): K=10

2. **`updateRating($opponentRating, $actualScore)`** - Elo calculation
   - Calculates expected score
   - Updates rating, peak_rating, games_played
   - Exits provisional period after 20 games
   - Returns detailed update info

### RatingController (`app/Http/Controllers/RatingController.php`)

**Endpoints**:

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/rating/initial` | Set initial rating from skill assessment |
| POST | `/api/rating/update` | Update rating after a game |
| GET | `/api/rating` | Get current user's rating info |
| GET | `/api/rating/leaderboard` | Top 100 rated players |
| GET | `/api/rating/history` | Rating history (placeholder) |

**Usage Example**:
```javascript
// Set initial rating after skill assessment
await axios.post('/api/rating/initial', { rating: 1600 });

// Update rating after game
const result = await axios.post('/api/rating/update', {
  opponent_rating: 1450,
  result: 'win' // 'win', 'draw', or 'loss'
});
// Returns: { old_rating, new_rating, rating_change, expected_score, k_factor }
```

---

## 🎨 Frontend Implementation

### SkillAssessment Component

**Location**: `chess-frontend/src/components/auth/SkillAssessment.js`

**3-Question Assessment**:

1. **Experience Level** (base rating 800-2200)
   - Complete beginner → 800
   - Casual player → 1100
   - Club player → 1500
   - Tournament player → 1800
   - Expert/Master → 2200

2. **Rated Experience** (bonus +0 to +200)
   - Never played rated → +0
   - Online rated → +100
   - FIDE/USCF rated → +200

3. **Known Rating** (adjustment -200 to +300)
   - Don't know → +0
   - Under 1000 → -200
   - 1000-1499 → -50
   - 1500-1999 → +100
   - 2000+ → +300

**Features**:
- Progress bar
- Skip option (defaults to 1200)
- Result display with category label
- Provisional period notice
- Responsive design

### Rating Utilities (`utils/ratingUtils.js`)

**Key Functions**:

```javascript
// Convert opponent rating to engine difficulty (1-16)
calculateEngineLevelFromRating(rating)
// 1000→1, 1600→7, 2400+→16

// Calculate K-factor for Elo updates
calculateKFactor(user)

// Calculate expected score
calculateExpectedScore(playerRating, opponentRating)

// Calculate rating change
calculateRatingChange(currentRating, opponentRating, actualScore, kFactor)

// Get category label ('Beginner', 'Intermediate', etc.)
getRatingCategory(rating)

// Format rating with provisional indicator (1500 → "1500?")
formatRating(rating, isProvisional)
```

---

## 🎮 Game Integration Updates

### PlayComputer.js Changes

**Updated Lines 443, 581**:
```javascript
// OLD
evaluateMove(..., DEFAULT_RATING, ...)

// NEW
evaluateMove(..., user?.rating || DEFAULT_RATING, ...)
```

**Impact**: Expert players (2000+) now get expert scoring multipliers even in computer games

### PlayMultiplayer.js Changes

**Added Import**:
```javascript
import { calculateEngineLevelFromRating } from '../../utils/ratingUtils';
```

**Updated Player Move Evaluation (line ~1525)**:
```javascript
const opponentData = gameInfo.playerColor === 'white' ? gameData?.blackPlayer : gameData?.whitePlayer;
const opponentEngineLevel = calculateEngineLevelFromRating(opponentData?.rating || 1200);

evaluateMove(
  move, game, gameCopy, moveTime,
  user?.rating || 1200,  // Use real user rating
  setLastMoveEvaluation,
  setPlayerScore,  // Direct setter (removed redundant wrapper)
  opponentEngineLevel  // Difficulty based on opponent's rating
);
```

**Updated Opponent Move Evaluation (line ~859)**:
```javascript
const opponentPlayerData = gameInfo.playerColor === 'white' ? gameData?.blackPlayer : gameData?.whitePlayer;
const opponentEngineLevel = calculateEngineLevelFromRating(opponentPlayerData?.rating || 1200);

evaluateMove(
  opponentMove, previousState, newGame,
  (event.move.move_time_ms || 5000) / 1000,
  event.move.player_rating || 1200,
  setLastOpponentEvaluation,
  setOpponentScore,  // Direct setter
  opponentEngineLevel  // Difficulty based on opponent's rating
);
```

**Impact**:
- Playing against 1600-rated opponent awards ~56% more points than 1200-rated
- Playing against 2400-rated opponent awards ~120% more points (2.2x)
- Fair reward for playing stronger opponents

---

## 🔄 Rating → EngineLevel Mapping

| Opponent Rating | Engine Level | Difficulty Factor | Max Points/Move (Queen Capture) |
|----------------|--------------|-------------------|--------------------------------|
| 1000-1100 | 1-2 | 1.00-1.08 | 13.0-14.0 |
| 1200-1300 | 3-4 | 1.16-1.24 | 15.1-16.1 |
| 1600-1700 | 7-8 | 1.48-1.56 | 19.2-20.3 |
| 2000-2100 | 11-12 | 1.80-1.88 | 23.4-24.4 |
| 2400+ | 15-16 | 2.12-2.20 | 27.6-28.6 |

---

## 🚀 Integration Steps

### 1. Run Database Migration

```bash
cd chess-backend
php artisan migrate
```

**Verification**:
```sql
-- Check new columns
DESCRIBE users;

-- Verify indexes
SHOW INDEXES FROM users WHERE Column_name IN ('rating', 'peak_rating');
```

### 2. Integrate SkillAssessment into Registration Flow

**Option A: Post-Registration Redirect**
```javascript
// In RegisterController.php or frontend auth flow
if (user.rating === 1200 && user.games_played === 0) {
  navigate('/onboarding/skill-assessment');
}
```

**Option B: Modal After First Login**
```javascript
// In AuthContext or App.js
useEffect(() => {
  if (user && !user.rating_last_updated) {
    setShowSkillAssessmentModal(true);
  }
}, [user]);
```

**Implementation**:
```javascript
import SkillAssessment from './components/auth/SkillAssessment';

const handleSkillAssessmentComplete = async (calculatedRating) => {
  try {
    await axios.post('/api/rating/initial', { rating: calculatedRating });
    // Refresh user data
    await refetchUser();
    // Navigate to game selection or dashboard
    navigate('/play');
  } catch (error) {
    console.error('Failed to set initial rating:', error);
  }
};

const handleSkillAssessmentSkip = async (defaultRating) => {
  // Same as complete, but with default 1200
  await handleSkillAssessmentComplete(defaultRating);
};

// In render
<SkillAssessment
  onComplete={handleSkillAssessmentComplete}
  onSkip={handleSkillAssessmentSkip}
/>
```

### 3. Add Rating Display to UI

**User Profile**:
```javascript
import { formatRating, getRatingCategory, getRatingColor } from '../utils/ratingUtils';

<div className="user-rating">
  <span className="rating-value" style={{ color: getRatingColor(user.rating) }}>
    {formatRating(user.rating, user.is_provisional)}
  </span>
  <span className="rating-category">{getRatingCategory(user.rating)}</span>
  {user.is_provisional && (
    <span className="provisional-badge">
      Provisional ({user.games_played}/20 games)
    </span>
  )}
</div>
```

**Leaderboard Component** (optional):
```javascript
const [leaderboard, setLeaderboard] = useState([]);

useEffect(() => {
  axios.get('/api/rating/leaderboard')
    .then(res => setLeaderboard(res.data.data));
}, []);

<table>
  <thead>
    <tr><th>Rank</th><th>Player</th><th>Rating</th><th>Games</th></tr>
  </thead>
  <tbody>
    {leaderboard.map((player, idx) => (
      <tr key={player.id}>
        <td>{idx + 1}</td>
        <td>{player.name}</td>
        <td>{player.rating}</td>
        <td>{player.games_played}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### 4. Update Rating After Games

**In Game Completion Handler** (both PlayComputer and PlayMultiplayer):

```javascript
const handleGameComplete = async (finalHistory, status) => {
  // Existing game completion logic...

  // Update rating after multiplayer game
  if (isMultiplayerGame && opponentRating) {
    const gameResult = status.outcome === 'win' ? 'win' :
                      status.outcome === 'draw' ? 'draw' : 'loss';

    try {
      const ratingUpdate = await axios.post('/api/rating/update', {
        opponent_rating: opponentRating,
        result: gameResult
      });

      console.log('Rating updated:', ratingUpdate.data);
      // Optionally show rating change to user
      showRatingChangeNotification(ratingUpdate.data);

      // Refresh user data
      await refetchUser();
    } catch (error) {
      console.error('Failed to update rating:', error);
    }
  }
};
```

---

## ✅ Testing Checklist

### Database Tests
- [ ] Migration runs successfully
- [ ] Rollback works without errors
- [ ] Indexes created properly
- [ ] Default values applied to existing users

### Backend Tests
- [ ] Set initial rating (valid range 600-2600)
- [ ] Reject initial rating after games played
- [ ] Update rating after win/draw/loss
- [ ] K-factor calculation (provisional vs established)
- [ ] Peak rating updates correctly
- [ ] Provisional period ends after 20 games
- [ ] Leaderboard returns top players
- [ ] Leaderboard excludes provisional players

### Frontend Tests
- [ ] Skill assessment displays correctly
- [ ] Progress bar updates
- [ ] Skip button works
- [ ] Rating calculation is accurate
- [ ] Results screen shows correct category
- [ ] API call succeeds on completion

### Game Integration Tests
- [ ] Computer game uses user's real rating
- [ ] Expert player (2000+) gets expert multipliers
- [ ] Beginner (< 1000) gets beginner multipliers
- [ ] Multiplayer scoring varies by opponent rating
- [ ] 1600-rated opponent awards more points than 1200-rated
- [ ] 2400-rated opponent awards ~2x points vs 1200-rated
- [ ] Score setters work without redundant wrappers

### Edge Cases
- [ ] Guest users (no rating) default to 1200
- [ ] Missing opponent data defaults safely
- [ ] Rating clamped to valid range (600-2600)
- [ ] Games_played counter increments properly
- [ ] Provisional flag clears at exactly 20 games

---

## 🎨 UI Enhancement Opportunities (Future)

1. **Rating Change Toast**
   ```javascript
   // After game completion
   if (ratingChange > 0) {
     toast.success(`Rating +${ratingChange}! Now ${newRating}`);
   } else {
     toast.info(`Rating ${ratingChange}. Now ${newRating}`);
   }
   ```

2. **Rating Graph** (requires rating_history table)
   - Line chart showing rating over time
   - Highlight peak rating
   - Mark provisional period end

3. **Matchmaking by Rating**
   - Filter opponents by rating range (±200 points)
   - Show opponent rating before accepting game
   - Suggest balanced matchups

4. **Achievement Badges**
   - "First Win"
   - "10 Game Streak"
   - "Rating Milestone" (1500, 2000, etc.)
   - "Giant Killer" (beat higher-rated opponent)

---

## 🔍 Known Limitations & Future Work

### Current Limitations
1. **No rating history tracking** - Only current rating stored
2. **No anti-sandbagging measures** - Users could intentionally lose games
3. **Static initial assessment** - Could use AI-played calibration games
4. **No rating decay** - Inactive players keep ratings indefinitely

### Recommended Future Enhancements

1. **Rating History Table**
   ```sql
   CREATE TABLE rating_history (
     id BIGINT PRIMARY KEY,
     user_id BIGINT NOT NULL,
     game_id BIGINT,
     old_rating INT,
     new_rating INT,
     rating_change INT,
     opponent_rating INT,
     result VARCHAR(10),
     k_factor INT,
     created_at TIMESTAMP
   );
   ```

2. **Anti-Sandbagging Detection**
   - Flag accounts with suspicious loss patterns
   - Require minimum rating after X games
   - Penalize intentional underperformance

3. **Rating Decay for Inactivity**
   ```php
   // After 90 days inactive
   if (days_since_last_game > 90) {
     $rating = $rating * 0.95; // 5% decay
     $is_provisional = true; // Mark as rusty
   }
   ```

4. **AI Calibration Games** (Advanced)
   - New users play 3-5 quick games vs AI
   - AI adjusts difficulty dynamically
   - More accurate than self-assessment

---

## 📝 Summary

### What Changed
- ✅ Database schema extended with rating fields
- ✅ User model enhanced with Elo calculation methods
- ✅ RatingController with 5 API endpoints
- ✅ SkillAssessment React component (3 questions)
- ✅ Rating utility functions for calculations
- ✅ PlayComputer.js uses real user ratings
- ✅ PlayMultiplayer.js scales difficulty by opponent rating
- ✅ Consistent scoring across all game modes

### Migration Impact
- **Backward Compatible**: Existing users get default 1200 rating
- **Zero Downtime**: Migration adds fields without breaking existing features
- **Rollback Safe**: Complete down() migration provided

### Next Steps
1. Run migration in development
2. Test skill assessment flow
3. Integrate into registration/onboarding
4. Add rating display to user profile
5. Test multiplayer games with various rating opponents
6. Monitor for edge cases and adjust

---

## 🆘 Troubleshooting

### Migration Fails
```bash
# Check migration status
php artisan migrate:status

# Rollback specific migration
php artisan migrate:rollback --step=1

# Fresh migration (CAREFUL - destroys data)
php artisan migrate:fresh
```

### Rating Not Updating
- Check auth token validity
- Verify user is authenticated
- Check RatingController logs
- Ensure games_played > 0 before allowing updates

### Skill Assessment Not Saving
- Check `/api/rating/initial` endpoint
- Verify user has games_played === 0
- Check browser console for errors
- Verify CORS settings for API calls

---

**Implementation Status**: ✅ Ready for integration and testing
**Breaking Changes**: None - fully backward compatible
**Required Actions**: Run migration, integrate SkillAssessment component

