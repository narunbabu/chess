# E006 — Takeback (undo) end-to-end fix: implementation spec

**Target tree:** `D:\ArunApps\Chess-Web`
**Verified at:** branch `chore/unfreeze-working-tree-2026-09-02`, commit `3fa4c61e757ae4b0a867d8d200ce63a9decfd67b`
(working tree clean apart from ` M STATUS.md`, which this engagement did not touch)
**Inputs:** `D:\ArunApps\Karta\engagements\E003-takeback-rootcause.md`
**Status:** read-only investigation. No code was changed. This file is the only write.

Every claim below carries a file path and a line number at that commit. Where a fact
could not be established from source it is written as **could not determine**, with
what was looked at.

---

## 0. One-paragraph summary for the build agent

All four findings in E003 hold at HEAD, unmodified. Verification also turned up
**two further defects on the accept path that will bite the moment the event names are
fixed** — `GameRoomService::acceptUndo` reads a `next_fen` key that the two move-writing
paths explicitly `unset()` before storing, and its zero-moves fallback FEN contains a
typo that puts a black queen on b7. So the current accept path either writes `fen = NULL`
into a `NOT NULL` column (throwing, rolling back the transaction, returning 400) or, in the
exactly-two-moves case, writes a corrupt position. Fixing only the event names would turn
a silent no-op into a visible 400. The delta below therefore has **five** layers, not four,
plus a self-echo guard the name fix newly exposes.

---

## A. Verification in the tree

### A.1 — Finding 1: web binds the wrong undo event names. **HOLDS.**

| What | Where | Value |
|---|---|---|
| Backend wire name (request) | `chess-backend/app/Events/UndoRequestedEvent.php:57` | `return 'game.undo.request';` |
| Backend wire name (accepted) | `chess-backend/app/Events/UndoAcceptedEvent.php:64` | `return 'game.undo.accepted';` |
| Backend wire name (declined) | `chess-backend/app/Events/UndoDeclinedEvent.php:54` | `return 'game.undo.declined';` |
| Web listener (request) | `chess-frontend/src/services/WebSocketGameService.js:232` | `.listen('.undo.request', …)` |
| Web listener (accepted) | `chess-frontend/src/services/WebSocketGameService.js:236` | `.listen('.undo.accepted', …)` |
| Web listener (declined) | `chess-frontend/src/services/WebSocketGameService.js:240` | `.listen('.undo.declined', …)` |

Echo's dot-stripping is confirmed against the installed package, not from memory:
`chess-frontend/node_modules/laravel-echo/src/util/event-formatter.ts:15-23` —

```ts
format(event: string): string {
    if ([".", "\\"].includes(event.charAt(0))) {
        return event.substring(1);
    } else if (this.namespace) {
        event = this.namespace + "." + event;
    }
    return event.replace(/\./g, "\\");
}
```

laravel-echo version `2.2.4` (`node_modules/laravel-echo/package.json`). The default
namespace is `"App.Events"` (`node_modules/laravel-echo/src/connector/connector.ts:47`),
and `chess-frontend/src/services/echoSingleton.js:40-58` passes **no** `namespace` option,
so the default is in force.

Therefore `.listen('.undo.request')` binds the literal wire name `undo.request`, which
never equals `game.undo.request`. The control case proves the convention rather than
assuming it: `.listen('.game.move')` (`WebSocketGameService.js:200`) binds `game.move`,
which equals `GameMoveEvent::broadcastAs()` (`app/Events/GameMoveEvent.php:65`) — and moves
demonstrably work in production.

Both sides subscribe to the **same** channel, so the channel is not the fault:
`UndoRequestedEvent::broadcastOn()` returns `new PrivateChannel('game.'.$id)`
(`UndoRequestedEvent.php:47`); the web joins `game.{id}` as private
(`WebSocketGameService.js:174`); Android subscribes `"game.$gameId"` as private
(`chess99-android/app/src/main/java/com/chess99/data/websocket/GameWebSocketService.kt:84`).
Channel authorization exists and admits both players (`chess-backend/routes/channels.php:12-23`).

### A.2 — Finding 2: Android binds the same wrong names, and `draw.offered` is wrong too. **HOLDS.**

`chess99-android/app/src/main/java/com/chess99/data/websocket/GameWebSocketService.kt`:

```
:115  channel.bind("game.move", listener)        → matches game.move
:116  channel.bind("game.timer", listener)       → NO SUCH BACKEND EVENT
:117  channel.bind("game.ended", listener)       → matches game.ended
:118  channel.bind("game.paused", listener)      → matches game.paused
:119  channel.bind("game.resumed", listener)     → matches game.resumed
:120  channel.bind("game.activated", listener)   → matches game.activated
:121  channel.bind("game.chat", listener)        → matches game.chat
:122  channel.bind("game.resigned", listener)    → NO SUCH BACKEND EVENT
:123  channel.bind("draw.offered", listener)     → backend emits draw.offer.sent
:124  channel.bind("draw.accepted", listener)    → NO SUCH BACKEND EVENT
:125  channel.bind("draw.declined", listener)    → backend emits draw.offer.declined
:126  channel.bind("undo.request", listener)     → backend emits game.undo.request
:127  channel.bind("undo.accepted", listener)    → backend emits game.undo.accepted
:128  channel.bind("undo.declined", listener)    → backend emits game.undo.declined
:129  channel.bind("opponent.pinged", listener)  → matches opponent.pinged
:130  channel.bind("GameConnectionEvent", …)     → backend emits game.connection
:131  channel.bind("GameEndedEvent", …)          → backend emits game.ended (class form dead)
```

`DrawOfferSentEvent::broadcastAs()` = `'draw.offer.sent'` (`app/Events/DrawOfferSentEvent.php:53`);
`DrawOfferDeclinedEvent::broadcastAs()` = `'draw.offer.declined'` (`app/Events/DrawOfferDeclinedEvent.php:65`).
A grep of `chess-backend/app`, `routes` and `config` for `game.timer`, `game.resigned`,
`draw.accepted`, `draw.declined` and `draw.offered` returns **nothing**. Pusher channel binds
are exact-match, so all six of those binds are dead.
**Draw offers are dead on Android**, exactly as E003 states.

Note for the fix: the dispatcher at `GameWebSocketService.kt:133-204` matches with
`eventName.contains(...)`, so `"game.undo.request".contains("undo.request")` is still
`true` after the binds are corrected — but `"draw.offer.declined".contains("draw.declined")`
is `false`, so branch `:181` must move with the bind. See §C.

### A.3 — Finding 3: no responder for a bot, and the Undo button is not hidden. **HOLDS.**

*No responder exists, anywhere.*
`GameRoomService::requestUndo` (`app/Services/GameRoomService.php:2605-2679`) validates and
then does one thing — `broadcast(new \App\Events\UndoRequestedEvent(...))` at `:2667` — and
returns. The only emitters of `UndoAcceptedEvent` / `UndoDeclinedEvent` are
`GameRoomService::acceptUndo` (`:2761`) and `::declineUndo` (`:2799`), reachable only via
`POST …/undo/accept|decline` (`routes/api.php:287-288`, `routes/api_v1.php:272-273`) inside
the `auth:sanctum` group (`routes/api.php:71`, `routes/api_v1.php:75`).

*A synthetic opponent has no user to authenticate as.* A bot game stores `NULL` on the bot's
side: `'white_player_id' => $isUserWhite ? $user->id : null` /
`'black_player_id' => $isUserWhite ? null : $user->id`
(`app/Services/MatchmakingService.php:215-216`, and again at `:375-376`), with
`'synthetic_player_id' => $bot->id` (`:219`, `:379`).

*Neither auto-play loop touches undo.*
Web: `performSyntheticMove` (`chess-frontend/src/components/play/PlayMultiplayer.js:4567-4651`)
and its trigger effect (`:4656-4665`) only POST `…/synthetic-move`.
Android: `startSyntheticOpponentAutoPlay` (`PlayMultiplayerViewModel.kt:1239-1254`) and
`playSyntheticOpponentMove` (`:1256`) only compute and post a move.

*The button is not hidden.*
Web — the Undo button is gated **only** by `ratedMode === 'casual'`
(`PlayMultiplayer.js:5349-5366`), while Draw (`:5380`) and Nudge (`:5392`) are both wrapped
in `{!isSyntheticGame && (…)}`.
Android — the takeback button is gated by `if (!isRated)`
(`PlayMultiplayerScreen.kt:583-602`) and `state.canRequestUndo`
(`PlayMultiplayerViewModel.kt:1657-1663`), and `canRequestUndo` has **no** `isSyntheticGame`
term. `GameControlsRow` is rendered for every `PLAYING` game
(`PlayMultiplayerScreen.kt:466-478`) with no synthetic gate.

**Extra, same class:** Android's **Draw** button is also not gated on `isSyntheticGame`
(`PlayMultiplayerScreen.kt:548-562`), unlike web. It does not hang, because
`WebSocketController::offerDraw` dereferences `$opponent->id`
(`app/Http/Controllers/WebSocketController.php:1516-1525`) and the bot side is `NULL`, so the
call throws, is caught at `:1531`, returns 400, and Android surfaces an error instead of
setting `drawOfferedByMe` (`PlayMultiplayerViewModel.kt:680-690`). Cosmetic, not a hang.

### A.4 — Finding 4: no timeout anywhere. **HOLDS.**

*Backend.* `requestUndo` (`GameRoomService.php:2605-2679`) writes no row, sets no cache key
and queues no job. Compare `offerDraw`, which **does** persist a pending offer —
`Cache::put("draw_offer:{$gameId}:{$user->id}", true, 300)`
(`app/Http/Controllers/WebSocketController.php:1513`). Undo has no equivalent.

*Web.* `undoRequestPending` is set true at `PlayMultiplayer.js:2687` with no timer. Its only
clears are the three event handlers (`:1722`, `:1730`, `:1796`), the two local click handlers
(`:2712`, `:2733`) and a whole-game reset (`hooks/useGameState.js:172`). A grep for
`undoRequestPending|setUndoRequestPending` across `chess-frontend/src` returns exactly those
sites; none is a timer.

*Android.* `undoRequestPending` is set true at `PlayMultiplayerViewModel.kt:718`. Its only
clears are `GameEvent.UndoAccepted` (`:416`), `GameEvent.UndoDeclined` (`:425`) and an HTTP
failure of the request itself (`:722-727`). The 600 ms auto-play loop (`:1243-1252`) never
inspects it.

*It was designed and then dropped.* `docs/tasks/multiplayer_undo_implementation_guide.md:214-216`
specifies `undoRequestData = { requester, move, expires_at }` and an
`undoRequestCountdown`, and `:404-409` renders `Waiting for opponent's response... ({undoRequestCountdown}s)`.
None of it exists in the tree.

### A.5 — NEW, and louder than the rest: **the accept path is broken independently of the names.**

`GameRoomService::acceptUndo`, `app/Services/GameRoomService.php:2736-2742`:

```php
$moves = $game->moves;
array_pop($moves);
array_pop($moves);
$newFen = count($moves) > 0 ? end($moves)['next_fen'] : 'rnbqkbnr/pqpppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
```

Two defects on one line.

**A.5.a — `next_fen` is never stored.** Both move-writing paths strip it before persisting:
`recordSyntheticMove` — `unset($optimizedMove['prev_fen'], $optimizedMove['next_fen']);`
(`GameRoomService.php:528`) — and the human move path — the same statement at `:609`.
(`:2485` strips it again on read.) `moves` is cast `'moves' => 'array'`
(`app/Models/Game.php:95`), so `end($moves)['next_fen']` is an undefined array key →
PHP 8 warning → `null`. `$game->fen = null` then hits a column declared
`$table->string('fen', 255)->default('rnbqkbnr/pppppppp/…')` — **not nullable** —
(`database/migrations/2025_09_27_124000_create_games_table.php:71`). Under MySQL strict mode
the `save()` at `:2754` throws inside the `DB::transaction` opened at `:2688`, the rollback
runs, and `WebSocketController::acceptUndo` returns 400 (`WebSocketController.php:1871-1880`).
**Every human-vs-human accept fails**, and it will fail visibly the day the names are fixed.

**A.5.b — the zero-moves fallback FEN is a typo.** Rank 7 reads `pqpppppp`: a black **queen**
on b7 and no pawn there. The correct literal is used twice in the same file
(`GameRoomService.php:193`, `:468`) and in `MatchmakingService.php:227`, `:387`:
`rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. This branch is reachable by the
most ordinary case there is: `1.e4 e5`, White asks for a takeback, two moves pop, zero remain.

**Consequence for sequencing:** the event-name fix (§C, W-B1/W-C1) is *not* independently
shippable as "takeback now works". Without W-A1 it converts a silent hang into a 400 toast.
Both must land in the same release.

### A.6 — NEW: the request event has no self-exclusion, and web has no self-guard.

`broadcast(new UndoRequestedEvent(...))` at `GameRoomService.php:2667` is **not** `->toOthers()`
(contrast `offerDraw`, `WebSocketController.php:1519`, and `declineDraw`, `:1668`, which both
are). And `requestUndo` on the wire carries no body at all
(`chess-frontend/src/services/WebSocketGameService.js:1566-1572`; Retrofit `@POST` with no
`@Body`, `chess99-android/app/src/main/java/com/chess99/data/api/WebSocketApi.kt:104`), so
there is no `socket_id` / `X-Socket-ID` for `toOthers()` to key on even if it were added.

Android already guards client-side: `if (event.requestedBy != myUserId)`
(`PlayMultiplayerViewModel.kt:405`). **Web does not** — `handleUndoRequestReceived`
(`PlayMultiplayer.js:1714-1723`) unconditionally sets `undoRequestFrom` and, worse, clears
its own `undoRequestPending` at `:1722`. The moment the names match, the requester's own
browser will show "…wants to undo their last move" against itself and drop straight out of
the pending state. This is a *new* bug created by the name fix and must ship with it.

### A.7 — NEW: payload key mismatches on both clients.

| Backend key (source) | Web reads | Android reads | Effect |
|---|---|---|---|
| `requested_by_user_id`, `requested_by_user_name` (`UndoRequestedEvent.php:66-71`) | `event.from_user?.name \|\| event.from_player` (`PlayMultiplayer.js:1719`) | `data.get("requested_by")` (`GameWebSocketService.kt:184`) | Web always falls back to "Your opponent"; Android gets `0`, so its self-guard at `:405` can never suppress a self-echo |
| `moves`, `move_count` (`UndoAcceptedEvent.php:74-75`) | `event.history` (`PlayMultiplayer.js:1764-1767`) | reloads over HTTP (`:418`) | Web's "use backend state" branch is dead; it silently takes the local `slice(0,-2)` path |
| `offerer_id` (`DrawOfferSentEvent.php:42`) | `event.offerer_id` ✔ (`WebSocketGameService.js:250`) | `data.get("offered_by")` (`GameWebSocketService.kt:179`) | Android reads `0`; harmless only because the backend sends that one `->toOthers()` |

`accepted_by_user_id`, `undo_white_remaining`, `undo_black_remaining` and `fen` **do** match
what web reads at `PlayMultiplayer.js:1733`, `:1746-1750`, `:1763`.

### A.8 — Context the build agent needs and would otherwise waste time on

- `chess-frontend/src/components/play/hooks/useWebSocketEvents.js` is **imported**
  (`PlayMultiplayer.js:52`) but **never called** — a grep for `useWebSocketEvents(` in
  `PlayMultiplayer.js` returns nothing. It is exercised only by
  `src/__tests__/integration/PlayMultiplayerHooks.integration.test.js`. Do not "fix" it as
  part of this work; it changes no runtime behaviour.
- `chess-frontend/src/components/play/PlayMultiplayer.js.backup` is a stale copy that also
  matches these greps. **Do not edit it.**
- `chess99-ios/` has no realtime bindings at all — a grep for `bind(`/`listen(` across
  `**/*.swift` returns only two `game.undo()` calls in
  `chess99-ios/Chess99/Presentation/Game/PlayComputerViewModel.swift:182-183`, which are
  local chess-engine calls, not events. iOS is out of scope for this spec.
- **There is already a checked-in contract that both clients contradict:**
  `chess-backend/docs/api-contract/websocket-events.json` documents `.game.undo.request`
  (`:379`, `:384`), `.game.undo.accepted` (`:399`, `:404`) and `.game.undo.declined`
  (`:424`, `:429`) — i.e. the *correct*, Echo-form names — on channel
  `private-game.{gameId}` (`:132`). Nothing enforces it. §E turns it into a test.

---

## B. Every realtime event name, backend → web → Android

Method: `broadcastAs()` extracted from all 43 classes in `chess-backend/app/Events/`
(every one defines it — a loop over the directory found no class without it); channels from
`broadcastOn()`; web listeners from a `.listen(` grep over `chess-frontend/src`
(excluding `*.backup`); Android from `channel.bind(` over
`chess99-android/app/src/main/java` (only two files contain any).

Legend — **MATCHES** = a client will actually receive it; **MISMATCHES** = bound but the name
or channel is wrong; **NOT BOUND** = no client listens; **ORPHAN** = a client listens for
something no backend event emits.

### B.1 — Channel `private-game.{gameId}`

| # | Backend `broadcastAs` (class:line) | Web listener (file:line) | Web | Android bind (`GameWebSocketService.kt`) | Android |
|---|---|---|---|---|---|
| 1 | `game.move` (GameMoveEvent.php:65) | `.game.move` (WebSocketGameService.js:200) | MATCHES | `game.move` :115 | MATCHES |
| 2 | `game.ended` (GameEndedEvent.php:45) | `.game.ended` (WebSocketGameService.js:228) | MATCHES | `game.ended` :117 | MATCHES |
| 3 | `game.activated` (GameActivatedEvent.php:47) | `.game.activated` (WebSocketGameService.js:208) | MATCHES | `game.activated` :120 | MATCHES |
| 4 | `game.paused` (GamePausedEvent.php:68) | `.game.paused` (WebSocketGameService.js:216) | MATCHES | `game.paused` :118 | MATCHES |
| 5 | `game.resumed` (GameResumedEvent.php:57) | `.game.resumed` (WebSocketGameService.js:212) | MATCHES | `game.resumed` :119 | MATCHES |
| 6 | `game.chat` (GameChatMessageSent.php:33) | `.game.chat` (WebSocketGameService.js:244) | MATCHES | `game.chat` :121 | MATCHES |
| 7 | `opponent.pinged` (OpponentPingedEvent.php:54) | `.opponent.pinged` (WebSocketGameService.js:220) | MATCHES | `opponent.pinged` :129 | MATCHES |
| 8 | `game.connection` (GameConnectionEvent.php:62) | `GameConnectionEvent` → binds `App\Events\GameConnectionEvent` (WebSocketGameService.js:196) | **MISMATCHES** | `GameConnectionEvent` :130 | **MISMATCHES** |
| 9 | `draw.offer.sent` (DrawOfferSentEvent.php:53) | `.draw.offer.sent` on **game** ch. (WebSocketGameService.js:248) | MATCHES | `draw.offered` :123 | **MISMATCHES** |
| 10 | `draw.offer.declined` (DrawOfferDeclinedEvent.php:65) | `.draw.offer.declined` on **game** ch. (WebSocketGameService.js:254) | MATCHES | `draw.declined` :125 | **MISMATCHES** |
| 11 | **`game.undo.request`** (UndoRequestedEvent.php:57) | `.undo.request` → `undo.request` (WebSocketGameService.js:232) | **MISMATCHES** | `undo.request` :126 | **MISMATCHES** |
| 12 | **`game.undo.accepted`** (UndoAcceptedEvent.php:64) | `.undo.accepted` → `undo.accepted` (WebSocketGameService.js:236) | **MISMATCHES** | `undo.accepted` :127 | **MISMATCHES** |
| 13 | **`game.undo.declined`** (UndoDeclinedEvent.php:54) | `.undo.declined` → `undo.declined` (WebSocketGameService.js:240) | **MISMATCHES** | `undo.declined` :128 | **MISMATCHES** |
| 14 | `championship.game.created` (ChampionshipGameCreated.php:62) — also on user ch. | — | NOT BOUND | — | NOT BOUND |
| — | *(no such event)* | `GameStatusEvent` (WebSocketGameService.js:204) | **ORPHAN** | `game.timer` :116 | **ORPHAN** |
| — | *(no such event)* | `GameEndedEvent` class form (WebSocketGameService.js:224) | **ORPHAN** | `GameEndedEvent` :131 | **ORPHAN** |
| — | *(no such event)* | `.GameStatusChanged` on `private-private-game.{id}` (GlobalWebSocketManager.js:63-72) | **ORPHAN** + double `private-` prefix | `game.resigned` :122 | **ORPHAN** |
| — | *(no such event)* | — | — | `draw.accepted` :124 | **ORPHAN** |

`draw.offer.sent` is additionally listened for on the **user** channel at
`components/play/hooks/useWebSocketEvents.js:148` and `services/presenceService.js:171`, and
`draw.offer.declined` at `useWebSocketEvents.js:153`. The event only ever broadcasts on
`private-game.{id}` (`DrawOfferSentEvent.php:34`, `DrawOfferDeclinedEvent.php:33`), so those
three are **MISMATCHES (wrong channel)**. Two are dead code (§A.8); `presenceService.js:171`
is live and never fires. `chess-backend/docs/api-contract/websocket-events.json:447-466`
documents draw offers on the **user** channel — the contract is wrong here, not the backend.

### B.2 — Channel `private-App.Models.User.{userId}`

| # | Backend `broadcastAs` (class:line) | Web listener | Web | Android bind (`GlobalInvitationManager.kt`) | Android |
|---|---|---|---|---|---|
| 15 | `invitation.sent` (InvitationSent.php:39) | `.invitation.sent` (GlobalInvitationContext.js:150) | MATCHES | `"invitation.sent"` :91 | MATCHES |
| 16 | `invitation.accepted` (InvitationAccepted.php:43) | `.invitation.accepted` (GlobalInvitationContext.js:216) | MATCHES | :97 | MATCHES |
| 17 | `invitation.declined` (InvitationDeclined.php:41) | `.invitation.declined` (GlobalInvitationContext.js:238) | MATCHES | :97 | MATCHES |
| 18 | `invitation.cancelled` (InvitationCancelled.php:39) | `.invitation.cancelled` (GlobalInvitationContext.js:362) | MATCHES | :97 | MATCHES |
| 19 | `new_game.request` (NewGameRequestEvent.php:115) | `.new_game.request` (GlobalInvitationContext.js:165; PlayMultiplayer.js:1490; presenceService.js:162; useWebSocketEvents.js:158) | MATCHES | :92 | MATCHES |
| 20 | `match.request.received` (MatchRequestReceived.php:54) | `.match.request.received` (GlobalInvitationContext.js:373) | MATCHES | :94 | MATCHES |
| 21 | `match.request.accepted` (MatchRequestAccepted.php:57) | `.match.request.accepted` (GlobalInvitationContext.js:396) | MATCHES | — | NOT BOUND |
| 22 | `match.request.declined` (MatchRequestDeclined.php:41) | `.match.request.declined` (GlobalInvitationContext.js:412) | MATCHES | — | NOT BOUND |
| 23 | `match.request.cancelled` (MatchRequestCancelled.php:38) | `.match.request.cancelled` (GlobalInvitationContext.js:388) | MATCHES | :99 | MATCHES |
| 24 | `resume.request.sent` (ResumeRequestSent.php:66) | `.resume.request.sent` (GlobalInvitationContext.js:191; PlayMultiplayer.js:3393) | MATCHES | :93 | MATCHES |
| 25 | `resume.request.response` (ResumeRequestResponse.php:55) | `.resume.request.response` (GlobalInvitationContext.js:346; PlayMultiplayer.js:3427) | MATCHES | :98 | MATCHES |
| 26 | `resume.request.expired` (ResumeRequestExpired.php:72) | `.resume.request.expired` (GlobalInvitationContext.js:333; PlayMultiplayer.js:3498) | MATCHES | :98 | MATCHES |
| 27 | `championship.invitation.accepted` (ChampionshipMatchInvitationAccepted.php:73) | `.championship.invitation.accepted` (GlobalInvitationContext.js:249) | MATCHES | — | NOT BOUND |
| 28 | `championship.game.resume.request` (ChampionshipGameResumeRequestSent.php:66) | `.championship.game.resume.request` (GlobalInvitationContext.js:272) | MATCHES | :95 | MATCHES |
| 29 | `championship.game.resume.accepted` (ChampionshipGameResumeRequestAccepted.php:48) | `.championship.game.resume.accepted` (GlobalInvitationContext.js:296) | MATCHES | :100 | MATCHES |
| 30 | `championship.game.resume.declined` (ChampionshipGameResumeRequestDeclined.php:48) | `.championship.game.resume.declined` (GlobalInvitationContext.js:316) | MATCHES | :100 | MATCHES |
| 31 | `championship.invitation.sent` (ChampionshipMatchInvitationSent.php:50) | — | NOT BOUND | — | NOT BOUND |
| 32 | `championship.invitation.declined` (…Declined.php:55) | — | NOT BOUND | — | NOT BOUND |
| 33 | `championship.invitation.cancelled` (…Cancelled.php:56) | — | NOT BOUND | — | NOT BOUND |
| 34 | `championship.invitation.expired` (…Expired.php:51) | — | NOT BOUND | — | NOT BOUND |
| 35 | `championship.match.status_changed` (…StatusChanged.php:58) | — | NOT BOUND | — | NOT BOUND |
| 36 | `championship.game.start` (ChampionshipGameStartNotification.php:69) | — | NOT BOUND | — | NOT BOUND |
| — | *(no such event)* | `.InvitationSent` → binds `InvitationSent` (ActiveGameBanner.js:110) | **ORPHAN** | — | — |
| — | `game.activated` is on the **game** channel | `.game.activated` on user ch. (ActiveGameBanner.js:111) | **MISMATCHES (channel)** | — | — |
| — | *(no such event)* | `.game.created` (ActiveGameBanner.js:112) | **ORPHAN** | — | — |

Net effect: `ActiveGameBanner`'s realtime refresh is entirely dead — all three of its binds
miss — so the banner only ever updates on its own fetch cadence.

### B.3 — Channel `private-user.{id}` — **not authorizable**

`chess-backend/routes/channels.php` declares exactly five channels: `App.Models.User.{id}`
(`:7`), `game.{gameId}` (`:12`), `presence.online` (`:26`), `presence.lobby` (`:37`),
`presence.game.{gameId}` (`:49`). There is **no** `user.{id}` rule, so any private
subscription to `user.{id}` is rejected at auth. These events broadcast there anyway:

| # | Backend `broadcastAs` | Channel (class:line) | Web | Android |
|---|---|---|---|---|
| 37 | `championship.match.scheduled` (ChampionshipMatchScheduled.php:56) | `user.{p1}`, `user.{p2}` (:41,:45) | `championship.match.scheduled` **without a leading dot** → binds `App\Events\championship\match\scheduled`, on `App.Models.User.{id}` (ChampionshipInvitationContext.jsx:196) | NOT BOUND |
| 38 | `championship.schedule.updated` (ChampionshipScheduleProposalUpdated.php:61) | `user.{p1}`, `user.{p2}` (:46,:50) | same defect (ChampionshipInvitationContext.jsx:151) | NOT BOUND |
| 39 | `championship.timeout.warning` (ChampionshipTimeoutWarning.php:60) | `user.{p1}`, `user.{p2}` (:45,:49) | same defect (ChampionshipInvitationContext.jsx:248) | NOT BOUND |
| 40 | `championship.round.completed` (ChampionshipRoundCompleted.php:60) | `championship.{id}` + `user.{uid}` (:44,:49) | same defect (ChampionshipInvitationContext.jsx:290) | NOT BOUND |
| 14b | `championship.game.created` (ChampionshipGameCreated.php:62) | `user.{w}`, `user.{b}`, `game.{id}` (:44-52) | same defect (ChampionshipInvitationContext.jsx:221) | NOT BOUND |
| 41 | `championship.match.forfeited` (ChampionshipMatchForfeited.php:54) | public `championship.{id}` + `user.{p1/p2}` (:35-43) | NOT BOUND | NOT BOUND |
| 42 | `championship.round.generated` (ChampionshipRoundGenerated.php:64) | `championship.{id}.participants` / `.organizers` (:34,:36) | NOT BOUND | NOT BOUND |

All five `ChampionshipInvitationContext.jsx` listeners are **double**-broken: wrong channel
*and* no leading dot, so Echo namespaces them to `App\Events\championship\…`
(`event-formatter.ts:15-23` — the `else` branch, then `.replace(/\./g, "\\")`).
Out of scope for this engagement; recorded so it is a decision, not an oversight.

### B.4 — Public channels

| # | Backend `broadcastAs` | Channel | Web | Android |
|---|---|---|---|---|
| 2b | `game.ended` (GameEndedEvent.php:45) | `lobby` (`:36`) | `.game.ended` on `echo.channel('lobby')` (LobbyPage.js:279-280; LeaderboardPage.js:361-366) — MATCHES | NOT BOUND |
| 43 | `presence.updated` (UserPresenceUpdated.php:60) | public `presence` + `user.{id}` (`:37-38`) | `.presence.updated` on `presence-presence.online` (presenceService.js:127,151) — **MISMATCHES (channel)** | NOT BOUND |

### B.5 — Roll-up

- **13 MATCHES** on the game channel + **16 MATCHES** on the user channel + **1** on `lobby`.
- **8 MISMATCHES** that a user would notice: undo request/accepted/declined × 2 platforms (6),
  Android `draw.offered` (1), Android `draw.declined` (1). Plus `game.connection` on both,
  `presence.updated`, and the three `ActiveGameBanner` binds.
- **7 ORPHAN listeners** binding names no backend event emits.
- **13 backend events with no listener at all**, almost all championship.

Only the **bolded rows 9-13 of §B.1** are in scope for this fix. Everything else is recorded
so the next sweep starts from a list rather than a search.

---

## C. The delta

Layers: **L1** event names · **L2** bot responder · **L3** timeout/expiry ·
**L4** accept-path correctness (§A.5) · **L5** self-echo + payload keys (§A.6, §A.7).

**Writer letters are exclusive: no file appears under two writers.**

### Workstream A — backend (writer **A**)

| # | File | Change | Layers |
|---|---|---|---|
| A1 | `chess-backend/app/Services/GameRoomService.php` | (a) **`acceptUndo` :2736-2745** — delete the `end($moves)['next_fen']` read and the typo'd fallback FEN; replace with a new private helper `rebuildPositionFromMoves(array $moves): array` that replays the remaining moves from `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` using the primitives already in this file — `FenToBoardFactory::create()` (imported at `:13`, used at `:2834`), `$board->playLan($color, $from.$to.$promotion)` (`:2854`), `normalizeCastlingRightsAfterMove()` (`:2892`), `roleToChessColor()` (`:2984`) / `chessColorToRole()` (`:2989`). Stored moves carry `from`/`to`/`promotion` on every write path (web `PlayMultiplayer.js:4813-4816`; Android `PlayMultiplayerViewModel.kt:548-550`, `:1156-1158`, `:1177-1179`, `:1317-1319`), so a replay is sufficient — do **not** reintroduce `next_fen` storage. Keep `$newTurn = $requesterColor` (`:2745`) but log a warning if it disagrees with the replayed board's turn. (b) **`requestUndo` :2667** — before broadcasting, `Cache::put("undo_request:{$gameId}:{$userId}", $requesterColor, 35)`, mirroring the existing draw-offer pattern at `WebSocketController.php:1513`; return `expires_at` (ISO-8601, now+30 s) in the success array at `:2676-2680`. (c) **`requestUndo`, synthetic branch** — when `$game->synthetic_player_id` is set, skip the `UndoRequestedEvent` broadcast and instead run the same rollback + `UndoAcceptedEvent` path with a null accepter (extract the body of `acceptUndo` `:2724-2762` into `private function applyUndo(Game $game, string $requesterColor, ?User $accepter, ?string $accepterName)` and call it from both). (d) **`acceptUndo`** — require and consume the cache key; return 400 `'This takeback request has expired'` when absent. (e) **`declineUndo` :2783** — `Cache::forget()` the key. | L2, L3, L4 |
| A2 | `chess-backend/app/Events/UndoAcceptedEvent.php` | Constructor `(Game $game, ?User $acceptedByUser, ?string $syntheticName = null)`. `broadcastWith()` (`:70-82`): `accepted_by_user_id` becomes `int\|null`; `accepted_by_user_name` falls back to `$syntheticName`; add `'accepted_by_synthetic' => $acceptedByUser === null`. Everything else unchanged — `fen`, `moves`, `turn`, `move_count`, `undo_white_remaining`, `undo_black_remaining` already match what web reads. | L2 |
| A3 | `chess-backend/app/Events/UndoRequestedEvent.php` | Add `'expires_at'` to `broadcastWith()` (`:63-72`) so clients start their countdown from the server clock, not from their own POST. Leave `broadcastAs()` at `:57` **unchanged** — `game.undo.request` is the name the checked-in contract already specifies; the clients move, not the server. | L3 |
| A4 | `chess-backend/docs/api-contract/websocket-events.json` | `.game.undo.accepted` (`:399-421`): `accepted_by_user_id` → `["integer","null"]`, add `accepted_by_synthetic`. `.game.undo.request` (`:379-396`): add `expires_at`. Move `.draw.offer.sent` / `.draw.offer.declined` (`:462`, `:517`) from the `private-App.Models.User.{userId}` block to the `private-game.{gameId}` block — the backend has always broadcast them on the game channel (`DrawOfferSentEvent.php:34`), and §E's tests read this file as the source of truth. | L1 (contract) |
| A5 | `chess-backend/tests/Feature/BroadcastEventNameContractTest.php` *(new)* | §E.1 | test |
| A6 | `chess-backend/tests/Feature/UndoTakebackTest.php` *(new)* | §E.2 | test |

No migration. The pending-request state lives in the cache, matching the existing draw-offer
precedent, so **no schema change and no schema approval are required** — a deliberate choice
given `CLAUDE.md`'s "schema changes require human approval" gate.

`WebSocketController.php` needs **no change**: `requestUndo` (`:1823-1846`) and `acceptUndo`
(`:1851-1880`) return the service array verbatim, so `expires_at` and the synthetic
auto-accept result pass through untouched.

### Workstream B — web frontend (writer **B**)

| # | File | Change | Layers |
|---|---|---|---|
| B1 | `chess-frontend/src/services/WebSocketGameService.js` | `:232` `.undo.request` → `.game.undo.request`; `:236` `.undo.accepted` → `.game.undo.accepted`; `:240` `.undo.declined` → `.game.undo.declined`. Do **not** touch the `GameConnectionEvent` / `GameStatusEvent` / `GameEndedEvent` class-form binds at `:196`, `:204`, `:224` in this change — they are a separate (§B.1) defect and widening the diff widens the blast radius. | L1 |
| B2 | `chess-frontend/src/components/play/PlayMultiplayer.js` | (a) `handleUndoRequestReceived` `:1714-1723` — return early when `String(event.requested_by_user_id) === String(userIdRef.current)`; read the name from `event.requested_by_user_name` (the `from_user`/`from_player` keys at `:1719` do not exist). (b) `handleUndoAccepted` `:1762-1785` — replace `if (event.fen && event.history)` with `if (event.fen)`: always rebuild the board from the server FEN, and truncate `gameHistory` to `event.move_count` entries when that key is present, falling back to `slice(0, -2)`. Do **not** assign `event.moves` into `gameHistory` — the server's move objects are a different shape from the local history items consumed by `extractMoveStr` (`:2985-2995`), and that substitution is not in scope. (c) `:1737` — also call `recordUndoButtonUse()` when `event.accepted_by_synthetic === true`, so a bot acceptance still counts toward the best-use nudge. (d) `handleUndo` `:2686-2688` — after `setUndoRequestPending(true)`, start a 30 s timer (from `event.expires_at` once the request event round-trips, else `Date.now()+30000`); on fire, clear `undoRequestPending` and show "No response — takeback request expired." Clear the timer in all three event handlers and on unmount. (e) Leave the Undo button's `ratedMode === 'casual'` gate at `:5350` **as is** — see §D.3 for why the button stays visible in bot games. | L1, L3, L5 |
| B3 | `chess-frontend/src/__tests__/realtimeEventContract.test.js` *(new)* | §E.1 | test |
| B4 | `chess-frontend/tests/e2e/takeback.spec.js` *(new)* | §E.3 | test |

Explicitly **not** touched by writer B: `components/play/hooks/useWebSocketEvents.js` (dead,
§A.8), `PlayMultiplayer.js.backup` (stale copy), `services/GlobalWebSocketManager.js`,
`contexts/ChampionshipInvitationContext.jsx`, `components/layout/ActiveGameBanner.js`,
`services/presenceService.js` — all broken per §B, none on the takeback path.

### Workstream C — Android (writer **C**)

| # | File | Change | Layers |
|---|---|---|---|
| C1 | `chess99-android/app/src/main/java/com/chess99/data/websocket/GameWebSocketService.kt` | Binds: `:123` `draw.offered` → `draw.offer.sent`; `:125` `draw.declined` → `draw.offer.declined`; `:126-128` `undo.request`/`undo.accepted`/`undo.declined` → `game.undo.request`/`game.undo.accepted`/`game.undo.declined`. Delete the four dead binds `:116` `game.timer`, `:122` `game.resigned`, `:124` `draw.accepted`, `:131` `GameEndedEvent` (resign and draw-accept both already arrive as `game.ended` — `WebSocketController.php:1586` broadcasts `GameEndedEvent` on draw-accept, and `GameRoomService::forfeitGame` routes through `broadcastGameEnded` at `GameRoomService.php:1366`). `:130` `GameConnectionEvent` is also dead but is out of scope — leave it. Dispatcher `:133-204`: change every `eventName.contains(...)` to exact `==` on the full wire name — `contains` is what let `draw.declined` survive as a lookalike, and after the rename `"draw.offer.declined".contains("draw.declined")` is false, so branch `:181` **must** move or the snackbar silently disappears. Payload keys: `:179` `offered_by` → `offerer_id`; `:184` `requested_by` → `requested_by_user_id`. | L1, L5 |
| C2 | `chess99-android/app/src/main/java/com/chess99/presentation/game/PlayMultiplayerViewModel.kt` | `requestUndo()` `:714-729` — after `undoRequestPending = true` at `:718`, launch a 30 s job (cancel-on-clear) that resets `undoRequestPending = false` and sets `snackbarMessage = "No response — takeback request expired."`. Cancel it in the `UndoAccepted` (`:410`) and `UndoDeclined` (`:422`) branches and in `onCleared`. The existing self-guard at `:405` becomes effective for the first time once C1 fixes the payload key — no change needed there. `canRequestUndo` (`:1657-1663`) is **unchanged** (see §D.3). | L3 |
| C3 | `chess99-android/app/src/test/java/com/chess99/parity/RealtimeEventContractTest.kt` *(new)* | §E.1 | test |
| C4 | `chess99-android/app/src/test/java/com/chess99/presentation/game/UndoEligibilityTest.kt` | Add the timeout case: pending true → 30 s elapse → pending false. Existing 8 cases unchanged. | test |

Android's **Draw** button (`PlayMultiplayerScreen.kt:548-562`) is not gated on
`isSyntheticGame` unlike web (§A.3). It fails loudly rather than hanging, so it is **out of
scope** for this fix — recorded in §F.

### Ordering

WS-A, WS-B and WS-C touch disjoint files and can run in parallel. Two real constraints:

1. **WS-B1/WS-C1 must not ship without WS-A1(a).** On their own they turn a silent hang into
   a 400 (§A.5). Same release, or neither.
2. **A4 before B3/C3.** The contract JSON is the fixture both client tests read; A4 must be
   merged first or those tests fail on the draw-offer channel rows.

Everything else — A5/A6, B4, C4 — is independent.

---

## D. Acceptance criteria

Fixtures: two real accounts (`chess-frontend/tests/e2e/matchmaking-real-users.spec.js:28-29`
already defines `PLAYER_A` / `PLAYER_B`); a casual, unrated game; at least one full move pair
on the board. Prerequisites per that spec's header: `php artisan serve`,
`php artisan reverb:start`, `pnpm start`.

**D.1 — Undo delivered and accepted, human vs human, on web.**
*Given* A and B are both in the same active casual game with `1.e4 e5` played and it is A's turn,
*when* A clicks `↩ Undo (n)`,
*then* within 3 s B's page shows the incoming-request banner (`PlayMultiplayer.js:6240-6270`)
naming A, **and** A's own page does **not** show that banner and stays at `↩ Pending...`;
*and when* B clicks Accept,
*then* both boards return to the position after `1.e4`, both histories drop to 1 entry,
A's button reads `↩ Undo (n-1)` and B's undo count is unchanged, and no page logged a 400.

**D.2 — The same on Android.**
*Given* the same game with the Android app as player B,
*when* A requests a takeback from web,
*then* `UndoRequestBanner` (`PlayMultiplayerScreen.kt:458-463`) appears within 3 s;
*and when* B taps Accept, *then* both clients reach the identical FEN and B's button never
entered "Asked".
Mirror case: Android requests, web accepts, same assertions.

**D.3 — Undo against a bot: answered by a server-side responder. The button stays visible.**
*Given* a casual game with `synthetic_player_id` set and at least two moves played,
*when* the human requests a takeback,
*then* the HTTP call returns 200, a `game.undo.accepted` frame arrives on
`private-game.{id}` within 2 s carrying `accepted_by_user_id: null` and
`accepted_by_synthetic: true`, the board rolls back two plies, the requester's undo budget
drops by exactly 1, the opponent's is unchanged, and the button never displays
`↩ Pending...` / "Asked" for more than one render.

> **Recommendation, and why — responder, not hide.**
> 1. Takeback is a *learning* affordance and bot games are where beginners live. Casual games
>    are seeded with 9 chances (`Game::CASUAL_UNDO_CHANCES`, `app/Models/Game.php:14`;
>    `useGameState.js:71`). Hiding the button removes the feature precisely where it is most
>    used, which is a visible product regression against the build shipped on 2026-08-24
>    (`STATUS.md:10`).
> 2. A server-side responder keeps **one** rule set. The rollback, the per-colour budget
>    decrement and the broadcast all stay inside `GameRoomService`. The gap doc's client-side
>    alternative (`docs/android-web-parity-gap-analysis.md:172-174`) forks the rules across
>    three codebases and lets a client rewrite the server's authoritative position.
> 3. Hiding costs more than it looks. Web needs `!isSyntheticGame` added at
>    `PlayMultiplayer.js:5350`; Android needs an `isSyntheticGame` term in `canRequestUndo`
>    (`PlayMultiplayerViewModel.kt:1657`), which is pinned by 8 JVM tests in
>    `UndoEligibilityTest.kt`. That is comparable work for a worse outcome.
> 4. Hiding does not remove the hang. Human-vs-human still needs L3 either way, so the timeout
>    is not avoided by choosing "hide" — only the feature is lost.
>
> The responder is A1(c). It reuses the extracted `applyUndo` so a bot takeback and a human
> takeback produce byte-identical state transitions.

**D.4 — An unanswered request times out and the UI recovers.**
*Given* A has requested a takeback and B never responds,
*then* at ≤30 s A's button returns from `↩ Pending...` to `↩ Undo (n)` with A's budget
**undecremented**, and a non-blocking notice reads "No response — takeback request expired";
*and* a subsequent `POST …/undo/accept` from B at t ≥ 35 s returns 400
`This takeback request has expired` and broadcasts nothing.
Same on Android against `PlayMultiplayerViewModel.kt:718`.

**D.5 — Draw offers work on Android.**
*Given* an Android client and a web client in the same active game,
*when* the web player offers a draw,
*then* `DrawOfferBanner` (`PlayMultiplayerScreen.kt:449-455`) appears on Android within 3 s
and `GameEvent.DrawOffered.offeredBy` equals the web player's real user id (not `0`);
*and when* the Android player declines, *then* the web player sees the declined notice
(`PlayMultiplayer.js:1706-1712`);
*and when* the Android player accepts instead, *then* both clients end the game as a draw via
`game.ended`.

**D.6 — Regression: moves and web draw offers are untouched.**
*Given* the full fix is applied,
*then* `.game.move` still binds `game.move` and a move made on either client appears on the
other within 3 s; the web draw-offer flow (offer → banner → accept/decline) behaves exactly
as before on both `WebSocketGameService.js:248` and `:254`; game start, pause, resume, chat,
nudge and game-end all still fire. Concretely: `pnpm test:e2e` (8 suites) and
`php artisan test` are green, and `php artisan migrate --pretend` reports **no pending
migrations** — this change adds none.

**D.7 — Regression: the accept path writes a legal position.**
*Given* a game with exactly two moves (`1.e4 e5`),
*when* a takeback is accepted,
*then* `games.fen` equals `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` exactly —
in particular rank 7 is `pppppppp`, not `pqpppppp` — `moves` is `[]`, `move_count` is `0`,
and no `Undefined array key "next_fen"` warning appears in `storage/logs/laravel.log`.
This is the direct assertion for §A.5 and it must be in the suite, not just the checklist.

---

## E. The test that would have caught this

The 2026-08-24 check asserted an HTTP 200 and a label change
(`docs/android-web-parity-gap-analysis.md:157-160`). Both are true of a request nobody can
hear. **Nothing in the repo asserts the reply.** Confirmed: a grep for
`undo|takeback|Takeback` across `chess-frontend/tests/` returns nothing, and the one backend
file that tests broadcasting, `chess-backend/tests/Feature/WebSocketEventsTest.php`, calls
`$this->markTestSkipped(...)` in `setUp()` at `:31`, so all 13 of its cases are inert.

Three tests, at three altitudes. **E.1 is the one that would have caught this in seconds**,
years before a device was involved.

### E.1 — The wire-name contract (cheap, fast, catches the whole defect class)

`chess-backend/docs/api-contract/websocket-events.json` already carries the correct names
(§A.8) and is enforced by nothing. Make it load-bearing, from all three sides.

- **`chess-backend/tests/Feature/BroadcastEventNameContractTest.php`** *(writer A)* — glob
  `app/Events/*.php`, reflect each class, assert `broadcastAs()` returns a value present in
  the contract JSON under the channel its `broadcastOn()` names, and assert the reverse
  (every documented event maps to a class). Pure reflection, no DB, no Reverb; runs in the
  existing `php artisan test` gate.
- **`chess-frontend/src/__tests__/realtimeEventContract.test.js`** *(writer B)* — read
  `services/WebSocketGameService.js` and `contexts/GlobalInvitationContext.js` as text,
  extract every `.listen('…')` argument, apply the `EventFormatter` rule
  (`node_modules/laravel-echo/src/util/event-formatter.ts:15-23` — leading `.` → strip;
  otherwise `App.Events.` + the name with `.` → `\`), and assert each resulting wire name is
  in the contract. Fixture path
  `path.resolve(__dirname, '../../../chess-backend/docs/api-contract/websocket-events.json')`;
  assert the file exists first so a moved contract fails loudly instead of silently passing.
  Runs under `pnpm test`.
- **`chess99-android/app/src/test/java/com/chess99/parity/RealtimeEventContractTest.kt`**
  *(writer C)* — same idea, next to the existing `WebParityMatrixTest.kt`, which already
  establishes the "pin a cross-codebase contract in a JVM test" pattern
  (`WebParityMatrixTest.kt:16-27`). Read `GameWebSocketService.kt` and
  `GlobalInvitationManager.kt` as text, extract every `channel.bind("…")` literal, assert each
  is in the contract. Gradle's test working directory is the module dir, so the fixture is
  `File("../../chess-backend/docs/api-contract/websocket-events.json")`; assert `exists()`
  first. Runs in the existing JVM suite (204 tests as of `STATUS.md:10`).

Keep one explicit, commented allowlist per client for names deliberately bound but not
emitted, so removing a legitimate binding is a decision rather than silent drift. At HEAD
that allowlist would have to contain 7 entries (§B.5) — which is itself the finding.

**Fallback if a cross-module fixture read is blocked in CI:** hard-code the expected wire-name
list in each of the three tests and have E.1-backend assert its list is exhaustive against
`app/Events/`. Weaker (three lists can drift) but still catches a one-sided rename.

### E.2 — Backend behaviour: `chess-backend/tests/Feature/UndoTakebackTest.php` *(writer A)*

`RefreshDatabase`, `Event::fake()` where the payload is what matters, no `markTestSkipped`.

1. `requestUndo` dispatches `UndoRequestedEvent` with `broadcastAs() === 'game.undo.request'`,
   on `private-game.{id}`, with `requested_by_user_id` and `expires_at` present.
2. `acceptUndo` after `1.e4 e5` leaves `fen` **exactly** the standard start FEN, `moves === []`,
   `move_count === 0` — the direct §A.5 assertion, and the one that fails today.
3. `acceptUndo` after four plies leaves the position after ply 2, replayed rather than read
   from a stored `next_fen`.
4. Only the requester's `undo_{colour}_remaining` decrements.
5. `requestUndo` on a game with `synthetic_player_id` dispatches `UndoAcceptedEvent`
   (not `UndoRequestedEvent`) with `accepted_by_synthetic === true` and
   `accepted_by_user_id === null`.
6. `acceptUndo` more than 35 s after the request returns `success === false` and dispatches
   nothing (drive the clock with `$this->travel(40)->seconds()`).
7. `declineUndo` clears the cache key, so a following `acceptUndo` is rejected.

### E.3 — The end-to-end test that watches for the reply: `chess-frontend/tests/e2e/takeback.spec.js` *(writer B)*

Modelled on `chess-frontend/tests/e2e/matchmaking-real-users.spec.js`, which already has every
primitive needed: `apiLogin` (`:33`), `setupAuthPage` (`:42`), `captureConsole` (`:52`) and —
decisively — `captureWsFrames` (`:58-64`), which subscribes to `framereceived` and keeps the
raw payloads.

The assertion that matters, and the one no existing check makes:

```js
// Player A asks for a takeback…
await pageA.getByRole('button', { name: /Undo/ }).click();
// …and B's socket must actually receive it. Not a 200. Not a label.
await expect.poll(() => wsB.some(f => f.includes('game.undo.request')), { timeout: 10_000 })
  .toBe(true);
await expect(pageB.getByText(/wants to undo their last move/)).toBeVisible();
// A must NOT see its own request echoed back at it (§A.6).
await expect(pageA.getByText(/wants to undo their last move/)).toBeHidden();
// B accepts; A's socket must receive the acceptance and the board must move.
await pageB.getByRole('button', { name: /Accept/ }).click();
await expect.poll(() => wsA.some(f => f.includes('game.undo.accepted')), { timeout: 10_000 })
  .toBe(true);
await expect(pageA.getByRole('button', { name: /↩ Undo \(8\)/ })).toBeVisible();
```

Plus, in the same file: the bot case (single context, D.3) and the timeout case (A requests,
B never answers, A's button recovers inside 30 s — D.4).

**Why this is the test.** `wsB.some(f => f.includes('game.undo.request'))` fails today for the
right reason and would have failed on the day the names diverged. A 200-and-a-label check
cannot fail for that reason, ever. The rule worth writing into the suite: *for any realtime
feature, the assertion belongs on the receiving client, never on the sending client's HTTP
response.*

Android's equivalent (D.2/D.5) needs two live devices and is **could not determine** as an
automatable target here — the repo has one instrumented test in total
(`chess99-android/app/src/androidTest/java/com/chess99/engine/StockfishEngineInstrumentedTest.kt`)
and no two-device harness. E.1's `RealtimeEventContractTest.kt` is the automatable guard for
Android; D.2 and D.5 stay manual, on device, with the result recorded in `STATUS.md`.

---

## F. Risk

**Anything that depends on the current (wrong) names.** A repo-wide search for
`undo.request`, `undo.accepted`, `undo.declined` and `draw.offered` (excluding
`node_modules`, `build/`, `.git`) returns 11 files: the three `app/Events/Undo*.php` classes,
`chess-frontend/src/services/WebSocketGameService.js`,
`chess99-android/.../GameWebSocketService.kt`,
`chess-backend/docs/api-contract/websocket-events.json`, `STATUS.md` and four docs under
`docs/updates/` and `docs/tasks/`. **No consumer outside those two client files depends on the
wrong names** — no queue worker, no webhook, no third service. The blast radius of L1 is
exactly W-B1 and W-C1.

Ranked risks:

1. **Shipping L1 without L4 turns a silent failure into a loud one.** Today a takeback does
   nothing; after a names-only fix, B's Accept returns 400 and the board never moves (§A.5).
   Mitigation: gate the release on D.7 and E.2 case 2.
2. **The web self-echo (§A.6) is a bug the fix creates.** `UndoRequestedEvent` is broadcast
   without `->toOthers()` (`GameRoomService.php:2667`) and web has no self-guard
   (`PlayMultiplayer.js:1714-1723`). Without W-B2(a), the requester's own browser shows the
   banner against itself and clears its own pending flag at `:1722`. This never surfaced only
   because no undo event has ever been delivered. Mitigation: W-B2(a) and the
   `toBeHidden()` assertion in E.3.
3. **`->toOthers()` is not an alternative.** Neither client sends a `socket_id` or
   `X-Socket-ID` on the undo endpoints (`WebSocketGameService.js:1566-1572`;
   `WebSocketApi.kt:104`), so adding `->toOthers()` server-side would be a silent no-op. Guard
   client-side, or add the socket id first — do not assume the former.
4. **Android's `contains` dispatcher will silently drop the declined branch.** After
   `draw.declined` → `draw.offer.declined`, the branch at `GameWebSocketService.kt:181` no
   longer matches (`"draw.offer.declined".contains("draw.declined")` is false), so the "Draw
   offer declined" snackbar vanishes with no error. The undo branches survive by luck
   (`"game.undo.request".contains("undo.request")` is true) — which is exactly why W-C1
   converts the whole `when` to exact equality rather than trusting that luck.
5. **Removing the four dead Android binds** (`game.timer`, `game.resigned`, `draw.accepted`,
   `GameEndedEvent`) is safe only because resign and draw-accept both already arrive as
   `game.ended` (`WebSocketController.php:1586`; `GameRoomService.php:1366`) and `game.ended`
   stays bound at `:117`. If a future backend adds a real `game.timer`, E.1's contract test
   will flag the missing binding.
6. **The replay helper is new code on the authoritative position.** A bug there corrupts live
   games. Constrain it: it must use the same `FenToBoardFactory` / `playLan` /
   `normalizeCastlingRightsAfterMove` path as `validateAndApplyMove`
   (`GameRoomService.php:2833-2874`), must run inside the existing
   `DB::transaction`/`lockForUpdate` (`:2688-2689`), and must **throw rather than write**
   if any stored move fails to replay — a rejected takeback is recoverable, a corrupted
   position is not. E.2 cases 2-3 are the guard.
7. **Historical games with unreplayable move data.** `moves` is cast to `array`
   (`app/Models/Game.php:95`) and every current write path stores `from`/`to`/`promotion`, but
   long-lived rows predating that shape are **could not determine** — I read the two current
   write paths (`GameRoomService.php:516-539`, `:601-620`) and the model cast, not production
   data. Risk 6's throw-don't-write rule contains this: an unreplayable game refuses the
   takeback instead of corrupting.
8. **30 s is a judgement call, not a measurement.** The design guide specified a countdown but
   no duration (`docs/tasks/multiplayer_undo_implementation_guide.md:214-216`, `:404-409`) and
   the only precedent in the codebase is the draw offer's 300 s
   (`WebSocketController.php:1513`), which is a different interaction. 30 s client / 35 s
   server (the 5 s being clock-skew grace) is chosen so the button recovers within one move's
   thinking time. Cheap to retune — it is one constant on each of three sides.
9. **Budget double-decrement across the client timeout and a late server accept.** The
   requester's count is authoritative from the server
   (`undo_white_remaining` / `undo_black_remaining` in `UndoAcceptedEvent.php:80-81`, consumed
   at `PlayMultiplayer.js:1746-1757`), and the client timeout must **not** decrement locally.
   Stated explicitly in D.4.
10. **Out of scope, and staying broken after this fix** — recorded so nobody reports them as
    regressions: `game.connection` on both clients (§B.1); `ActiveGameBanner`'s three binds
    (§B.2); all five `ChampionshipInvitationContext.jsx` listeners and the unauthorizable
    `user.{id}` channel (§B.3); `presence.updated` (§B.4);
    `GlobalWebSocketManager.js:63` double-prefixing `private-private-game.{id}`; Android's
    ungated Draw button in bot games (§A.3); the 13 backend events with no listener (§B.5).
