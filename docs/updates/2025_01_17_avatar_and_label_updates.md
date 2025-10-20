# Avatar and Label Updates - January 17, 2025

## Summary
Implemented avatar display and updated player labels in the multiplayer timer display.

## Changes Made

### 1. Frontend: GameContainer Label Update
**File**: `chess-frontend/src/components/play/GameContainer.js`

**Change**: Updated opponent label from full name to "Opnt"
- Line 274: Changed `{opponentName}` to `"Opnt"`
- Player label already shows "You" (no change needed)
- Avatar support already exists in the component (lines 257-267 for opponent, 312-322 for player)

### 2. Backend: Database Migration
**File**: `chess-backend/database/migrations/2025_01_17_000000_add_avatar_url_to_users_table.php`

**Created**: New migration to add `avatar_url` column to users table
- Adds nullable `avatar_url` string column after `provider_token`
- Includes rollback support via `down()` method

### 3. Backend: User Model Update
**File**: `chess-backend/app/Models/User.php`

**Change**: Added `avatar_url` to fillable fields
- Line 21: Added `'avatar_url'` to the $fillable array

### 4. Backend: OAuth Callback Update
**File**: `chess-backend/app/Http/Controllers/Auth/SocialAuthController.php`

**Changes**:
- Line 64: Changed `firstOrCreate` to `updateOrCreate` (updates avatar on subsequent logins)
- Line 70: Added `'avatar_url' => $socialUser->getAvatar()` to save Google profile picture

## Avatar Data Flow

### Google Sign-In:
1. User signs in with Google OAuth
2. Backend receives user data including avatar URL from Google
3. Avatar URL is saved to `users.avatar_url` column
4. Frontend receives user data with `avatar_url` field
5. GameContainer displays avatar if `playerData?.avatar_url` or `opponentData?.avatar_url` exists

### Manual Upload (Future):
- Currently not implemented
- When implemented, update the `avatar_url` column via user profile settings

## Display Logic

**GameContainer.js** (lines 257-327):
- If `avatar_url` exists: Shows circular avatar image (24px x 24px)
- If `avatar_url` is null: Shows default emoji icon (👤)
- Label shows "You" for player, "Opnt" for opponent
- Timer displays in monospace font with color coding (green for active, gray for inactive)

## Required Actions

### To Apply These Changes:

1. **Run the database migration**:
   ```bash
   cd chess-backend
   php artisan migrate
   # or with Sail:
   ./vendor/bin/sail artisan migrate
   ```

2. **Test with new Google sign-ins**:
   - New users: Avatar will be saved automatically on first login
   - Existing users: Avatar will be updated on next login (due to updateOrCreate)

3. **Verify avatar display**:
   - Start a multiplayer game
   - Check that avatars appear in timer display above the board
   - Verify "You" and "Opnt" labels are displayed correctly

## Expected UI

```
┌─────────────────────────────────────┐
│  [●] 👤 Opnt    09:09   VS   [●] 👤 You    09:24  │
│       (red)                     (green)            │
└─────────────────────────────────────┘
```

With avatars:
```
┌─────────────────────────────────────┐
│  [●] [avatar] Opnt  09:09  VS  [●] [avatar] You  09:24  │
│         (red)                          (green)           │
└─────────────────────────────────────┘
```

## Benefits

✅ Cleaner UI with shorter labels ("You" vs full name, "Opnt" vs opponent name)
✅ Visual identification with profile avatars
✅ Automatic avatar retrieval from Google OAuth
✅ Avatar updates on subsequent logins
✅ Graceful fallback to emoji icons when avatar unavailable
✅ Consistent display in both computer and multiplayer modes

## Notes

- Avatar images are 24x24 pixels, circular, with object-fit: cover
- Google provides avatar URLs that typically remain valid long-term
- If Google avatar URL becomes invalid, the emoji fallback will display
- Future enhancement: Add manual avatar upload feature in user settings
