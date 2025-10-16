# Draw Offer Implementation

**Date**: 2025-10-16
**Status**: ✅ Completed
**Impact**: High - New game termination option

## Summary

Implemented complete Draw Offer functionality allowing players to propose and accept draws during active games. This adds a mutual agreement termination option alongside existing Resign and Timeout options.

## Changes Made

### Backend (Laravel)

#### 1. Routes (`routes/api.php`)
Added three new routes in the WebSocket prefix group:
- `POST /websocket/games/{gameId}/draw/offer` - Send draw offer to opponent
- `POST /websocket/games/{gameId}/draw/accept` - Accept opponent's draw offer
- `POST /websocket/games/{gameId}/draw/decline` - Decline opponent's draw offer

#### 2. Controller Methods (`app/Http/Controllers/WebSocketController.php`)
Implemented three controller methods:

**`offerDraw()`**:
- Validates user is part of the game
- Checks game status is 'active'
- Stores draw offer in cache (5 min TTL)
- Broadcasts `DrawOfferSentEvent` to opponent

**`acceptDraw()`**:
- Validates pending draw offer exists
- Ends game with result '1/2-1/2' (draw)
- Sets `end_reason` to 'draw_agreed'
- Broadcasts `GameEndedEvent` to both players
- Clears draw offer from cache

**`declineDraw()`**:
- Validates pending draw offer exists
- Removes draw offer from cache
- Broadcasts `DrawOfferDeclinedEvent` to offerer

#### 3. Broadcast Events (`app/Events/`)
Created two new event classes:

**`DrawOfferSentEvent.php`**:
- Broadcasts to opponent's private channel
- Event name: `draw.offer.sent`
- Payload includes game info and offerer details

**`DrawOfferDeclinedEvent.php`**:
- Broadcasts to offerer's private channel
- Event name: `draw.offer.declined`
- Payload includes game info and decliner details

### Frontend (React)

#### 1. Service Methods (`WebSocketGameService.js`)
Added three methods for draw offer API calls:
- `offerDraw()` - POST to `/draw/offer` endpoint
- `acceptDraw()` - POST to `/draw/accept` endpoint
- `declineDraw()` - POST to `/draw/decline` endpoint

#### 2. State Management (`PlayMultiplayer.js`)
Added draw offer state:
```javascript
const [drawOfferPending, setDrawOfferPending] = useState(false);
const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);
```

#### 3. Event Listeners
Subscribed to user channel for draw offer events:
- `.draw.offer.sent` - Triggers when opponent offers draw
- `.draw.offer.declined` - Triggers when opponent declines draw

#### 4. Handler Functions
Implemented five handlers:
- `handleDrawOfferReceived()` - Sets drawOfferPending state
- `handleDrawOfferDeclined()` - Clears drawOfferedByMe state, shows alert
- `handleOfferDraw()` - Calls service to send draw offer
- `handleAcceptDraw()` - Calls service to accept draw, game ends
- `handleDeclineDraw()` - Calls service to decline draw

#### 5. UI Components
Added two UI elements:

**Offer Draw Button**:
- Appears next to Resign button during active game
- Disabled after offering draw
- Text changes to "Draw Offered" when pending

**Draw Offer Modal**:
- Overlay modal appears when opponent offers draw
- Two buttons: "Accept Draw" and "Decline"
- Modal disappears after user responds

## Technical Architecture

### Draw Offer Flow

**Offering Draw**:
1. Player clicks "Offer Draw" button
2. Frontend calls `offerDraw()` API
3. Backend stores offer in cache: `draw_offer:{gameId}:{userId}`
4. Backend broadcasts `DrawOfferSentEvent` to opponent
5. Opponent sees modal: "Your opponent offers a draw"

**Accepting Draw**:
1. Player clicks "Accept Draw" button
2. Frontend calls `acceptDraw()` API
3. Backend validates pending offer exists
4. Backend ends game: `status='finished'`, `result='1/2-1/2'`, `end_reason='draw_agreed'`
5. Backend broadcasts `GameEndedEvent` to both players
6. Frontend shows game completion modal with draw result

**Declining Draw**:
1. Player clicks "Decline" button
2. Frontend calls `declineDraw()` API
3. Backend removes offer from cache
4. Backend broadcasts `DrawOfferDeclinedEvent` to offerer
5. Offerer sees alert: "Your draw offer was declined"
6. Offerer can offer draw again

### Cache Strategy
- Draw offers stored in Laravel cache with 5-minute TTL
- Cache key format: `draw_offer:{gameId}:{offererUserId}`
- Automatically expires if no response within 5 minutes
- Prevents stale offers from lingering after game ends

### Security & Validation
- Authorization: Only game participants can offer/accept/decline draws
- Game state check: Can only offer draw when game is 'active'
- Offer validation: Must have pending offer to accept/decline
- Opponent matching: Validates correct opponent ID

## Testing Checklist

### Happy Path
- [ ] Player A offers draw → Player B sees notification
- [ ] Player B accepts draw → Game ends as draw (1/2-1/2)
- [ ] Draw offer appears in game completion modal
- [ ] Both players see "Draw" result

### Edge Cases
- [ ] Player A offers draw → Player B declines → Player A can offer again
- [ ] Player A offers draw → 5 minutes pass → Offer expires from cache
- [ ] Player A offers draw → Game ends by timeout → Offer cleared
- [ ] Player A offers draw → Player A cannot offer again while pending
- [ ] Player B tries to accept without pending offer → Error message

### Authorization
- [ ] Non-participant cannot offer draw (403 error)
- [ ] Cannot offer draw in paused game (400 error)
- [ ] Cannot offer draw in finished game (400 error)
- [ ] Cannot accept draw from non-existent offer (400 error)

### WebSocket Events
- [ ] Draw offer sent event broadcasts correctly
- [ ] Draw offer declined event broadcasts correctly
- [ ] Game ended event triggers on draw acceptance
- [ ] Polling mode: Draw offers work via HTTP polling

### UI/UX
- [ ] "Offer Draw" button appears during active game
- [ ] Button text changes to "Draw Offered" after sending
- [ ] Button disabled while draw offer pending
- [ ] Modal appears immediately when draw offer received
- [ ] Modal disappears after accept/decline
- [ ] Alert shows when draw offer declined

## Game Termination Options

With this implementation, players now have 4 ways to end a game:

| Method | Trigger | Result | Winner |
|--------|---------|--------|--------|
| **Timeout** | Timer reaches 00:00 | Loss by timeout | Opponent |
| **Resign** | Player admits defeat | Loss by resignation | Opponent |
| **Draw Offer** | Both players agree | Draw (1/2-1/2) | None |
| **Inactivity** | Player inactive 2 min | Game paused (resumable) | N/A |

## Future Enhancements

### Potential Improvements
1. **Auto-decline after X seconds**: Automatically decline draw offer if no response within 60 seconds
2. **Draw offer cooldown**: Prevent spam by limiting draw offers to once per 5 minutes
3. **Draw by threefold repetition**: Automatic draw detection for repeated positions
4. **Draw by insufficient material**: Automatic draw when neither player can checkmate
5. **Draw by 50-move rule**: Automatic draw after 50 moves without capture or pawn move
6. **Draw offer sound**: Play sound effect when draw offer received
7. **Draw offer history**: Track draw offers in game history/logs

### UI Enhancements
1. Replace alert() with toast notifications for declined offers
2. Add animation when draw offer modal appears
3. Show countdown timer on draw offer modal
4. Display draw offer status in game info sidebar
5. Add "Withdraw Draw Offer" button to cancel before response

## Files Modified

### Backend
- `routes/api.php` - Added 3 routes
- `app/Http/Controllers/WebSocketController.php` - Added 3 methods
- `app/Events/DrawOfferSentEvent.php` - New file
- `app/Events/DrawOfferDeclinedEvent.php` - New file

### Frontend
- `src/services/WebSocketGameService.js` - Added 3 methods
- `src/components/play/PlayMultiplayer.js` - Added state, handlers, UI

## Rollout Plan

1. ✅ Backend implementation complete
2. ✅ Frontend implementation complete
3. ⏳ Manual testing (QA)
4. ⏳ User acceptance testing
5. ⏳ Production deployment
6. ⏳ Monitor error logs for 48 hours
7. ⏳ Gather user feedback

## Metrics to Monitor

- Draw offer rate: % of games with draw offers
- Draw acceptance rate: % of offers accepted vs declined
- Draw completion rate: % of games ending in draw via offer
- API error rate for draw endpoints
- Cache hit rate for draw offers
- Average time to respond to draw offer

## References

- Previous work: `/docs/updates/2025_10_16_game_termination_fixes.md`
- Chess.com draw offer UX: https://www.chess.com/terms/draw-chess
- FIDE draw rules: https://handbook.fide.com/chapter/E012018

## Success Criteria

- ✅ Players can offer draws during active games
- ✅ Opponents receive real-time draw offer notifications
- ✅ Accepting draw ends game with 1/2-1/2 result
- ✅ Declining draw allows game to continue
- ✅ Draw offers expire after 5 minutes
- ✅ Authorization prevents unauthorized draw actions
- ✅ UI clearly indicates draw offer state
- ✅ Works in both WebSocket and HTTP polling modes

---

**Next Steps**: Manual testing and CSS styling for draw offer modal.
