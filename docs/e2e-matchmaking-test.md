# E2E Matchmaking Test Checklist

Manual test plan for verifying the matchmaking presence-detection fix and the new `/api/v1/status` endpoint.

## Prerequisites

Start all four services (three terminals):

```bash
# Terminal 1 — Backend (server + queue + vite)
cd chess-backend && composer dev

# Terminal 2 — Reverb WebSocket server
cd chess-backend && php artisan reverb:start

# Terminal 3 — Frontend dev server
cd chess-frontend && pnpm start
```

Confirm all services are up:

```bash
# Health check
curl http://localhost:8000/api/v1/health
# → {"status":"healthy", ...}

# Status page
curl http://localhost:8000/api/v1/status | jq .reverb.status
# → "connected"
```

Open the System Status page in a browser: **http://localhost:3000/system-status**

---

## Test 1: Status Page Loads and Auto-Refreshes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Navigate to `http://localhost:3000/system-status` | Page renders with title "System Status" |
| 1.2 | Check DB status card | Shows "healthy" in green |
| 1.3 | Check Reverb card | Shows "connected" in green with `0.0.0.0:8080` |
| 1.4 | Check Online Players metric | Shows `0` (no users logged in yet) |
| 1.5 | Check Active Games metric | Shows count with human/computer breakdown |
| 1.6 | Check Recent Smart Matches table | Shows last 5 match attempts with status |
| 1.7 | Wait 10 seconds | "Last:" timestamp updates automatically |

---

## Test 2: Presence Detection (Single User)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Open a new tab: `http://localhost:3000/login` | Login page appears |
| 2.2 | Log in as **User A** (e.g., test account) | Redirected to dashboard/home |
| 2.3 | Switch to the System Status tab | Online Players count increases to `1` |
| 2.4 | Check Online Players table | Shows User A's ID, status "online", Socket "Yes" |
| 2.5 | Wait 30 seconds | Last Activity time updates (heartbeat fires) |

---

## Test 3: Multi-User Presence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Open a **different browser** (or incognito) | Fresh session |
| 3.2 | Navigate to `http://localhost:3000/login` | Login page appears |
| 3.3 | Log in as **User B** | Redirected to dashboard |
| 3.4 | Check System Status page | Online Players now shows `2` |
| 3.5 | Both users visible in the details table | Two rows with "online" status |

---

## Test 4: Smart Match — Invitation Delivery

This is the critical test. Both users must be logged in.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | On User A's browser, go to `/lobby` | Lobby page loads |
| 4.2 | Click "Play Now" (or "Find Match") | Matchmaking options dialog appears |
| 4.3 | Select any time control, mode, color | Options selected |
| 4.4 | Click "Find Match" | Spinner shows "Looking for an opponent..." |
| 4.5 | **On User B's browser** | A match request dialog should pop up within 1-2 seconds |
| 4.6 | User B clicks "Accept" | Both users navigated to `/play/multiplayer/{gameId}` |
| 4.7 | Check System Status page | Recent Smart Matches shows a new entry with `status: accepted`, `targets_count: 1`, `accepted_targets: 1` |

### If Step 4.5 Fails (No Invitation Received)

Check the following:

```bash
# Check Laravel logs for presence breakdown
powershell.exe -Command "Get-Content 'C:\ArunApps\Chess-Web\chess-backend\storage\logs\laravel.log' -Tail 50 | Select-String 'MM:PRESENCE|MM:TRACE'"
```

Expected log output:
```
[MM:PRESENCE] Candidate pool breakdown {
  "requester_id": 1,
  "strongly_online": 1,     ← Should be >= 1 (User B)
  "recently_active": 0,
  "in_queue": 0,
  "busy_in_game": 0,
  "total_pool": 1
}
[MM:TRACE] broadcasting MatchRequestReceived to candidates {
  "candidate_count": 1,
  "candidate_ids": [2]      ← User B's ID
}
[MM:TRACE] broadcast sent OK {"target_user_id": 2}
```

If `strongly_online: 0` and `recently_active: 0`:
- User B's presence record may not exist — check `user_presence` table
- Verify User B's browser has an active WebSocket connection (check browser DevTools Console for `[Presence] Service initialized successfully`)

If `candidate_count > 0` but User B didn't see the dialog:
- WebSocket delivery failed — check Reverb is running on port 8080
- Check browser console on User B for `[Presence] Subscribed to user channel: App.Models.User.{id}`
- Verify the `GlobalInvitationContext` is listening for `.match.request.received` events

---

## Test 5: Smart Match — Decline and Fallback

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | User A clicks "Find Match" | Matchmaking spinner appears |
| 5.2 | User B sees match request dialog | Dialog shows User A's name and rating |
| 5.3 | User B clicks "Decline" | Dialog closes |
| 5.4 | On User A's screen | Shows "Waiting for 0 players to respond..." then immediately falls back to queue |
| 5.5 | After ~15s total | User A matched with synthetic bot |
| 5.6 | Check Status page | Smart match shows `status: expired`, `declined_targets: 1` |
| 5.7 | Check queue matches | New entry with `match_type: synthetic` |

---

## Test 6: Queue-Based Matching (Both Users Search)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | User A clicks "Find Match" | Enters findingPlayers state |
| 6.2 | User B also clicks "Find Match" (within 5s) | User B also enters findingPlayers |
| 6.3 | Both should receive each other's invitations | OR one receives and accepts, creating a game |
| 6.4 | If neither accepts within 15s | Both fall back to queue, and `findHumanMatch()` matches them via polling |
| 6.5 | Verify | Both navigated to same `/play/multiplayer/{gameId}` |
| 6.6 | Check Status page | Queue match shows `match_type: human` |

---

## Test 7: Presence Expiry

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | Close User B's browser entirely | Tab closes |
| 7.2 | Wait 5+ minutes | Presence record should expire |
| 7.3 | Check Status page | Online Players drops to `1` |
| 7.4 | User A clicks "Find Match" | Should find 0 candidates (falls back to queue → synthetic) |
| 7.5 | Check [MM:PRESENCE] log | `strongly_online: 0`, `recently_active: 0` |

---

## Test 8: Reverb Disconnection Handling

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Stop the Reverb process (Ctrl+C in Terminal 2) | Reverb stops |
| 8.2 | Refresh System Status page | Reverb status shows "disconnected" in red |
| 8.3 | User A clicks "Find Match" | Match request created, but broadcast fails |
| 8.4 | Check Laravel logs | `[MM:TRACE] broadcast MatchRequestReceived FAILED` |
| 8.5 | Restart Reverb: `php artisan reverb:start` | Reverb back up |
| 8.6 | Refresh Status page | Shows "connected" again |

---

## Log Locations

| What | Command |
|------|---------|
| All matchmaking logs | `Select-String 'MM:' laravel.log` |
| Presence breakdown | `Select-String 'MM:PRESENCE' laravel.log` |
| Broadcast results | `Select-String 'MM:TRACE' laravel.log` |
| Synthetic fallback | `Select-String 'MM:SYNTHETIC' laravel.log` |
| Presence updates | `Select-String 'Presence' laravel.log` |

---

## Success Criteria

The matchmaking fix is confirmed working when:

- [ ] `/api/v1/status` returns all sections with valid data
- [ ] System Status page renders and auto-refreshes
- [ ] Two logged-in users both appear in Online Players
- [ ] "Find Match" by User A delivers an invitation to User B
- [ ] `[MM:PRESENCE]` log shows `strongly_online >= 1` or `recently_active >= 1`
- [ ] Accepting creates a game and navigates both users
- [ ] Recent Smart Matches table shows `status: accepted` with `targets_count > 0`
- [ ] No match ever shows `targets_count: 0` when 2+ users are online
