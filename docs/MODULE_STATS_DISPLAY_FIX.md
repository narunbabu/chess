# Module Stats Display Fix - Missing XP and Duration

## Problem Report

User reported that the module card on TutorialHub was showing:
- ✅ Progress: 2/3 lessons (66.67%) - **Working correctly**
- ❌ Total XP: **0** - **Not displaying**
- ❌ Duration: **0m** - **Not displaying**
- ✅ Button: "🚀 Continue Learning" - **Working correctly**

The button was present and functional (navigates to `/tutorial/module/chess-basics`), but the stats were not being displayed.

## Root Cause

The `TutorialModule` model had accessors defined for `total_xp` and `formatted_duration` (lines 157-179 in TutorialModule.php):

```php
public function getTotalXpAttribute(): int
{
    return $this->activeLessons()->sum('xp_reward');
}

public function getFormattedDurationAttribute(): string
{
    $minutes = $this->estimated_duration_minutes;
    // ... formatting logic
}
```

However, these accessors were **not included in the `$appends` array**, which means they were not being serialized when the model was returned as JSON in API responses.

## Solution

Added the `$appends` property to `TutorialModule.php` to include the computed attributes in JSON responses:

```php
protected $appends = [
    'total_xp',
    'formatted_duration',
];
```

**File Modified**: `chess-backend/app/Models/TutorialModule.php`

## How It Works

### Before Fix
```json
{
  "id": 1,
  "name": "Chess Basics",
  "estimated_duration_minutes": 45,
  // ❌ total_xp: missing
  // ❌ formatted_duration: missing
}
```

### After Fix
```json
{
  "id": 1,
  "name": "Chess Basics",
  "estimated_duration_minutes": 45,
  "total_xp": 60,              // ✅ Sum of all lesson XP rewards
  "formatted_duration": "45min" // ✅ Human-readable duration
}
```

## Calculation Logic

**`total_xp`**:
- Sums the `xp_reward` of all active lessons in the module
- For Chess Basics: 15 (Lesson 1) + 20 (Lesson 2) + 25 (Lesson 3) = **60 XP**

**`formatted_duration`**:
- Uses the module's `estimated_duration_minutes` field
- Formats as:
  - `< 60 min`: "45min"
  - `>= 60 min`: "1h 30min"
  - `exact hours`: "2h"

## Expected Result After Fix

Module card will now display:
```
♟️ Chess Basics
Learn the fundamentals of chess from piece movement to board setup

Progress: 2/3 lessons
66.67%

✓ Done: 2    📚 Total: 3    ⭐ XP: 60

⏱️ 45min

[🚀 Continue Learning]
```

## Testing Steps

1. Refresh the `/tutorial` page
2. Verify module cards show correct XP totals
3. Verify duration displays properly
4. Confirm button still navigates to module detail page

## Related Files

- **Backend Model**: `chess-backend/app/Models/TutorialModule.php`
- **Frontend Component**: `chess-frontend/src/components/tutorial/TutorialHub.jsx` (lines 327-346)
- **API Endpoint**: `GET /api/tutorial/modules`

## Notes

- The button and navigation were already working correctly
- This fix only addresses the display of computed stats
- All other module card functionality remains unchanged
- Cache cleared to ensure changes take effect immediately
