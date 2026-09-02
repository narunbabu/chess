# Undo + Best-Move Parity Program — Android (2026-07-18)

Goal: close the undo / best-move-recommendation gap between web and Android.
Policy (owner): **rated = no undo, no best moves. Every other mode (casual,
learning, companion) must offer undo and best-move hints on request.**

## What the investigation found (why the parity cycles missed this)

The gap is NOT "Android has no undo and no best moves." Each half exists in
exactly one screen, and the parity cycles each saw the half that existed and
skipped the other:

| Capability | PlayComputer (vs engine) | PlayMultiplayer |
|---|---|---|
| Undo | ✅ Fully implemented (`PlayComputerViewModel.undoMove()`, budgets 15/9/6/3 by difficulty, learning pool, rated=0) | ⚠️ **Receive-only.** `acceptUndo()`/`declineUndo()` exist and `GameWebSocketService.requestUndo()` (line ~252) exists at the API layer, but **no `requestUndo()` in the ViewModel and no button in the UI**. Android users can only respond to a web opponent's request, never initiate. |
| Best moves / CCT | ❌ **Completely absent.** No `_cctState`, no `loadBestMoves()`, no CCT bottom sheet import. Learning-mode setup copy even promises "Best-move & undo help from a small pool" — the best-move half is a false promise today. | ✅ Fully implemented (CCT arrows + Stockfish top-3 gold/silver/bronze, `CCTControls.kt`, rated-gate) |

So the two concrete blockers were:
1. **Multiplayer undo request path was never wired** — the WebSocket API method
   was written (Cycle 3-era) but the ViewModel/UI call was never added, likely
   because the web takeback flow is request/accept and only the accept side got
   ported.
2. **CCT/best-move was built for multiplayer only** (2026-04-26 CCT port
   targeted `PlayMultiplayerViewModel`); PlayComputer was never retrofitted,
   even after Cycle 8 added the casual/learning/rated modes whose learning copy
   references best-move help.

Neither is an engine or backend gap: `StockfishEngine` is a `@Singleton`
already used by both ViewModels, and the backend undo endpoints
(`/websocket/games/{id}/undo/{request|accept|decline}`) are live and used by
web.

## Target gating matrix (web parity)

| Mode | Undo | CCT arrows | Best moves (top-3) |
|---|---|---|---|
| Casual (computer) | ✅ difficulty budget 15/9/6/3 | ✅ unlimited | ✅ unlimited |
| Casual (multiplayer) | ✅ request→accept flow, server-tracked counts | ✅ unlimited | ✅ unlimited |
| Learning (computer only) | ✅ shared helpline pool | ✅ unlimited | ✅ shared helpline pool (one deduction per position reveal) |
| Companion | same as casual | same as casual | same as casual |
| Rated (any) | ❌ | counts visible, **arrows off** | ❌ |

Notes: web multiplayer has no learning mode (casual/rated only) — keep that.
Web learning pool is user-selected 1/3/5/7 at game start; Android currently
hardcodes 5.

## Specs

| Spec | Scope | Priority |
|---|---|---|
| [S1-multiplayer-undo-request.md](S1-multiplayer-undo-request.md) | Wire the missing requestUndo flow + UI in PlayMultiplayer | P0 (smallest fix, biggest complaint) |
| [S2-playcomputer-cct-bestmoves.md](S2-playcomputer-cct-bestmoves.md) | Port CCT/Best panel into PlayComputer with mode gating | P0 |
| [S3-learning-helpline-parity.md](S3-learning-helpline-parity.md) | Helpline pool selector (1/3/5/7) + shared undo/best-move consumption + copy parity | P1 (depends on S2) |

## Quality gates

- `powershell.exe -Command "cd 'C:\\ArunApps\\Chess-Web\\chess99-android'; .\\gradlew assembleDebug"` green
- Manual verify on emulator: each cell of the gating matrix above
- No behavior change in rated games (regression risk: accidentally exposing
  hints/undo in rated)

## Web reference files (source of truth for behavior)

- `chess-frontend/src/components/play/PlayComputer.js` — `handleUndo()` (2608-2769), `calculateUndoChances()` (98-105), `consumeLearningHelp()` (2961-2980)
- `chess-frontend/src/components/play/PlayMultiplayer.js` — `handleUndo()` (2636-2697), `handleUndoAccepted()` (1726-1790), availability effect (2940-2970)
- `chess-frontend/src/services/WebSocketGameService.js` — undo REST calls (1559-1650), events (234-242)
- `chess-frontend/src/components/game/CCTPanel.jsx` — hint levels, rated gate, best-move budget (132-412)
- `chess-frontend/src/components/lobby/ChallengeModal.jsx` — mode descriptions (80-84)
