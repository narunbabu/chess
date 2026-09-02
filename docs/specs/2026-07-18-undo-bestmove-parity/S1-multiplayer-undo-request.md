# S1 — Multiplayer undo: wire the missing request flow (P0, Android only)

## Problem

Android multiplayer players **cannot ask for an undo**. The accept/decline
half of the takeback flow is implemented (`PlayMultiplayerViewModel.
acceptUndo()` line ~633, `declineUndo()` line ~639, `UndoRequestBanner` in the
UI), and `GameWebSocketService.requestUndo()` (line ~252) already POSTs to
`/api/v1/websocket/games/{id}/undo/request` — but nothing in the ViewModel or
screen ever calls it. Web has had the full flow since the undo feature landed.

No backend work needed: web already exercises request/accept/decline endpoints
and the `undoRequest` / `undoAccepted` / `undoDeclined` events.

## Web behavior to replicate (PlayMultiplayer.js)

- Undo button visible only when `gameMode == casual` (multiplayer has no
  learning mode) AND game active AND ≥2 half-moves played.
- Enabled only when: player's undo count remaining > 0, no undo request
  already pending, game not over.
- On tap → `requestUndo()` → set `undoRequestPending = true`, show "Undo
  request sent — waiting for opponent" status.
- On `undoAccepted` event: apply server-authoritative `fen` + `history`,
  resync undo counts from `undo_white_remaining` / `undo_black_remaining`
  (requester's count decrements; **treat these as strings-or-numbers — recall
  the Laravel decimal→"0.00"-string bug class**, parse defensively).
- On `undoDeclined` event: clear pending flag, show a snackbar/toast
  ("Opponent declined the undo request").
- Initial counts come from the game-load payload (`undo_white_remaining`,
  `undo_black_remaining`); rated → force 0.

## Tasks

### T1 — ViewModel: `requestUndo()`

In `PlayMultiplayerViewModel`:
- Add `undoChancesRemaining`, `undoRequestPending` to `MultiplayerUiState`
  (check whether accept-side handling already tracks pieces of this — reuse,
  don't duplicate).
- `fun requestUndo()`: guard (casual, my data says count>0, !pending, game
  active) → `gameWebSocketService.requestUndo(gameId)` → set pending; on API
  error clear pending and surface message.
- Handle `undoAccepted`: existing accept-side state application likely covers
  board reset for the *responder*; make sure the *requester* path also applies
  `fen`/`history` and resyncs counts.
- Handle `undoDeclined`: clear pending + one-shot UI event.
- Parse counts with `(value as? String)?.toDoubleOrNull()?.toInt()`-style
  defensive coercion (shared helper if one exists from the tournament fix).

### T2 — UI: undo button

In `PlayMultiplayerScreen` control row (where resign/draw buttons live):
- `↩ Undo (N)` button, shown only in casual mode; disabled states per guards
  above; while pending show a small progress/`⏳` state.
- Keep the existing `UndoRequestBanner` for the responder side unchanged.

### T3 — Verification

- Emulator + web browser: Android requests → web accepts → board reverts on
  both, counts decrement only for requester.
- Android requests → web declines → snackbar, no state change.
- Rated multiplayer game: button absent.
- Web requests → Android accept path still works (regression).
