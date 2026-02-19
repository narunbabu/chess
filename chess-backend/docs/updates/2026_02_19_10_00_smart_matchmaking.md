# Smart Real-User Matchmaking System

**Date**: 2026-02-19
**Type**: Feature
**Scope**: Backend + Frontend

## Context

The existing "Play Online" flow uses polling-based queue matchmaking (join → poll every 2s → match or timeout to synthetic opponent). This update adds a WebSocket-driven "find real players" flow that directly invites online users.

## Changes

### Backend (7 new files, 3 modified)

**New files:**
- `database/migrations/2026_02_19_100000_create_match_requests_table.php` — `match_requests` + `match_request_targets` tables
- `app/Models/MatchRequest.php` — Model with relationships, scopes, `isExpired()` helper
- `app/Models/MatchRequestTarget.php` — Model for individual target tracking
- `app/Events/MatchRequestReceived.php` — Broadcasts to target users via private channel
- `app/Events/MatchRequestAccepted.php` — Broadcasts to requester when target accepts
- `app/Events/MatchRequestCancelled.php` — Broadcasts to targets when cancelled/superseded
- `app/Events/MatchRequestDeclined.php` — Broadcasts to requester with remaining count

**Modified files:**
- `app/Services/MatchmakingService.php` — Added `findAndBroadcastPlayers()`, `acceptMatchRequest()`, `declineMatchRequest()`, `cancelMatchRequest()`; changed `createMultiplayerGame()` from `private` to `public`
- `app/Http/Controllers/MatchmakingController.php` — Added 4 endpoints: `findPlayers`, `acceptRequest`, `declineRequest`, `cancelFind`
- `routes/api_v1.php` — Added 4 routes in matchmaking prefix group

### Frontend (4 modified files)

- `src/services/matchmakingService.js` — Added `findPlayers()`, `acceptMatchRequest()`, `declineMatchRequest()`, `cancelFindPlayers()`
- `src/contexts/GlobalInvitationContext.js` — Added `pendingMatchRequest` state, 4 WebSocket listeners (`.match.request.*`), `acceptMatchRequest`/`declineMatchRequest` callbacks
- `src/components/invitations/GlobalInvitationDialog.jsx` — Added match request dialog with countdown timer, accept/decline buttons
- `src/components/lobby/MatchmakingQueue.jsx` — Added `findingPlayers` state; tries smart match first, falls back to queue on timeout/no-targets

### New API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/matchmaking/find-players` | Start smart matchmaking |
| POST | `/matchmaking/accept/{token}` | Target accepts match request |
| POST | `/matchmaking/decline/{token}` | Target declines match request |
| POST | `/matchmaking/cancel-find/{token}` | Requester cancels search |

## Data Flow

1. **Happy path**: Find Match → `POST find-players` → backend finds up to 3 online users, broadcasts `MatchRequestReceived` → target sees dialog, clicks Accept → game created, both navigate to multiplayer game
2. **Timeout path**: 15s expires → frontend cancels → falls back to existing queue → synthetic match
3. **No players online**: `findPlayers` returns `targets_count: 0` → immediately falls back to queue (no 15s wait)

## Risks

- **Race conditions**: Mitigated with `DB::transaction()` + `lockForUpdate()` on accept (proven pattern from existing `findHumanMatch()`)
- **Backward compatibility**: Existing queue flow completely untouched; new flow is fully additive

## Tests

- Migration runs successfully
- Frontend builds with no errors
- All 4 new routes registered correctly
- Manual test needed: 2 browser tabs, different users, Find Match flow
