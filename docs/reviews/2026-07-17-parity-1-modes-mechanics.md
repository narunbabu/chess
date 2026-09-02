# Web ↔ Android Parity Review — Cluster 1: Game Modes + Core Mechanics

Date: 2026-07-17
Scope (READ-ONLY): casual/learning/rated modes, undo, rating/ELO, clocks, backend move+FEN persistence.
Platforms: Web (`chess-frontend/` React + `chess-backend/` Laravel) vs Android (`chess99-android/` Kotlin/Compose).

**Headline:** The Android **PlayComputer (vs-computer) flow is essentially a local, offline game** — it does not create a backend game, does not persist moves/FEN, does not call `completeGame`, and therefore **never records the game or applies ELO** (except in the narrow "persona real-game" path, which then hands off to multiplayer). Web PlayComputer, by contrast, creates a backend game, persists final FEN+moves, and applies server-side ELO for rated bot games. Multiplayer is closer to parity but Android omits per-move clock persistence and rating-change display.

---

## 1. Three game modes: casual / learning / rated

| Aspect | Web behavior | Android behavior | Gap | Key files |
|---|---|---|---|---|
| Mode selector (vs computer) | `GameModeSelector.jsx` offers 4 modes: **Rated, Casual, Learning, Companion**. `ratedMode` state ∈ `casual`/`rated`/`learning`. Backend game created with `game_mode` + `learning_mode` + `learning_help_limit`. | `PlayComputerScreen.kt` has only a binary **"Rated Game" Switch** (`isRated`) plus a persona chip row. No Casual/Learning/Companion mode concept in the vs-computer UI. `setupGame(color, difficulty, isRated)`. | **ANDROID-MISSING: Learning mode** (and the explicit Casual/Companion mode selector) is absent from Android vs-computer. Android is casual-by-default with an isRated toggle. | web: `components/game/GameModeSelector.jsx`, `play/PlayComputer.js` (`ratedMode`, L250); android: `game/PlayComputerScreen.kt` (L195, 275-284), `game/PlayComputerViewModel.kt` (`setupGame` L55) |
| What each mode changes (help/undo/review) | Casual: undos + "Best" button + optional auto-review (`reviewEnabled`) + CCT. Learning: limited "help pool" (`learningHelpLimit` 1/3/5/7), CCT stays, review markers persisted. Rated: 0 undos, no Best button (`handleBestButtonUse` returns unless casual), review force-disabled, navigation-guard + auto-resign on unload. | Undo only, gated by `isRated`. CCT hint arrows disabled when `isRated` (mirrors web). No learning help-pool, no "Best" button budget, no auto-review-report concept in the vs-computer VM. | **ANDROID-MISSING: learning help-pool, review-report, Best-button budget.** DIVERGENT help model. | web: `play/PlayComputer.js` (L378-483, L844-861); android: `game/PlayComputerViewModel.kt`, `game/CCTControls.kt` |
| Backend `games.learning_mode` | Set on create (`createComputerGame`) and re-affirmed on `completeGame`/`resign`; drives `applyLearnerElo` (separate learner rating). | Never sent (Android vs-computer never creates a backend game; persona path sends `game_mode:"casual"` only, no `learning_mode`). | **ANDROID-MISSING:** learning_mode never populated from Android. | backend: `GameController.php` (`createComputerGame` L84-153, `completeGame` L619-681, `applyLearnerElo`); android: `game/PlayComputerViewModel.kt` (`startPersonaGame` L152-159) |
| Multiplayer mode | `isRated` derived from `game_mode`; rated MP has navigation guard + rating change display. | `isRated = gameMode == "rated"` (VM L218). Rated MP recognized but no rating-change display (see §3). | Partial parity; see §3. | web: `play/PlayMultiplayer.js`; android: `game/PlayMultiplayerViewModel.kt` (L129, L218) |

---

## 2. Undo — per-mode limits

| Aspect | Web behavior | Android behavior | Gap | Key files |
|---|---|---|---|---|
| Undo counts by tier | `calculateUndoChances(depth, isRated)`: Easy(1-4)=**15**, Medium(5-8)=**9**, Hard(9-12)=**6**, Expert(13-16)=**3**, Rated=0. | `StockfishEngine.undoChances(depth,isRated)`: Easy=**5**, Medium=**3**, Hard=**2**, Expert=**1**, Rated=0. | **DIVERGENT: undo budgets differ ~3×.** Web is far more generous. (Android matches the older MEMORY.md numbers 5/3/2/1; web was bumped to 15/9/6/3.) | web: `play/PlayComputer.js` (L98-105); android: `engine/StockfishEngine.kt` (`undoChances` L58-66) |
| Undo mechanics | Consumes 1 chance; undoes player+computer plies; disabled in rated & after game over. Casual undo-uses tracked for review report (`recordUndoButtonUse`). | `undoMove()` (VM L343): blocked if rated / no chances / mid-computer-move / not player's turn / <2 plies; undoes 2 plies; decrements. No review tracking. | Mechanics equivalent; only the budget + review tracking differ. | web: `play/PlayComputer.js`; android: `game/PlayComputerViewModel.kt` (L343-363) |
| Multiplayer undo | Request/accept/decline flow over `websocket/games/{id}/undo/*`. | Same endpoints wired (`GameApi.requestUndo/acceptUndo/declineUndo`, `GameWebSocketService`). | Parity. | android: `data/api/GameApi.kt` (L84-92) |

---

## 3. Rating counting / ELO

| Aspect | Web behavior | Android behavior | Gap | Key files |
|---|---|---|---|---|
| Rated **vs-computer** ELO | On game end, web calls `gameService.completeGame(gameId, {result, endReason, fen, moves, learningMode,...})`. Backend `completeGame` → for `synthetic_player_id` games with `game_mode==='rated'` calls `applyRatedSyntheticElo` → `RatingService::applyForPlayer` (server-authoritative, idempotent via `ratings_history`). Response returns `rating_change`. | Android vs-computer **never calls any completion endpoint** (no `completeGame` in `GameApi.kt`; `handleGameOver` sets only local `GameResultState`). So a rated local computer game **records nothing and changes no rating**. | **ANDROID-MISSING (high impact): rated vs-computer games do not affect rating and are not recorded.** The Android "Rated Game" toggle is effectively cosmetic in the local flow. | web: `play/PlayComputer.js` (`handleGameComplete` L783-1006, `completeGame` call L851); backend: `GameController.php` (`completeGame` L582-700, `applyRatedSyntheticElo` L760-801); android: `game/PlayComputerViewModel.kt` (`handleGameOver` L387-449 — no network) |
| Game recorded at all (vs computer) | Backend game created on start (`createComputerGame`, logged-in user) + `completeGame` on end → shows in history/dashboard. Guests save to localStorage. | Persona "real game" path creates a casual backend game and routes to multiplayer (recorded there). But the **plain slider/Custom computer game is local-only** — not in server history. | **ANDROID-MISSING:** plain computer games missing from server game history. | web: `play/PlayComputer.js` (L2304-2329); android: `game/PlayComputerViewModel.kt` (`startPersonaGame` vs local `startGame` L194) |
| Bot games affecting rating | Only **rated + real `synthetic_player_id`** bot games apply ELO. Casual/learning bot games do not change the main rating (learning has a separate `learner_rating`). | N/A locally (no ELO applied at all). | Consistent intent, but Android can't realize it. | backend: `GameController.php` (L662-681) |
| Rating change shown to user (vs computer) | `handleGameComplete` attaches `learner_rating_update`; for rated, `RatingChangeDisplay` / performance panel reads `getRatingChange`. | No rating-change UI in vs-computer completion. | ANDROID-MISSING. | web: `components/game/RatingChangeDisplay.jsx` |
| Rating change shown (multiplayer) | After MP game end, web fetches `getRatingChange(gameId)` (reads `ratings_history`) and renders `RatingChangeDisplay` (PlayMultiplayer.js L4464-4490). | `PlayMultiplayerScreen.kt` passes `ratingChange = 0` (hardcoded); `GameApi.getRatingChange` exists but is **not called** on game end in the MP VM. | **ANDROID-MISSING: multiplayer rating-change delta not displayed** (endpoint wired but unused). | web: `play/PlayMultiplayer.js` (L4464-4490); android: `game/PlayMultiplayerScreen.kt` (L106), `data/api/GameApi.kt` (`getRatingChange`) |

---

## 4. Clocks / timing

| Aspect | Web behavior | Android behavior | Gap | Key files |
|---|---|---|---|---|
| Countdown (vs computer) | `useGameTimer` counts down, applies increment, flags on 0 → `handleTimerFlag` → completes game (backend `completeGame` with `end_reason:'timeout'`). | Local coroutine timer (`startTimer` VM L453) decrements per second, ends game on 0 with `EndReason.TIMEOUT` — **local only**, no backend record. | Timeout works locally on both; Android timeout not persisted/recorded (ties to §3). | web: `utils/timerUtils` (`useGameTimer`); android: `game/PlayComputerViewModel.kt` (L453-500) |
| Countdown (multiplayer) | Local timer + increment; sends remaining times with each move (see §5). Timeout claim via dedicated endpoint. | Local coroutine timer with increment applied on own move (VM L461-468). Timeout handling via WebSocket events. | See §5 for persistence gap. | web: `play/PlayMultiplayer.js`; android: `game/PlayMultiplayerViewModel.kt` (L461-476) |
| Server-side remaining time persisted | **Yes.** Web MP move body includes `white_time_remaining_ms`/`black_time_remaining_ms` (PlayMultiplayer.js L4836-4837, L2415-2416); `broadcastMove` validates+stores them; pause endpoints persist `white/black_time_paused_ms`; `games` columns `white_time_remaining_ms`/`black_time_remaining_ms` exposed in room state (WebSocketController L963, GameController L484-485). | **No.** Android `GameWebSocketService.sendMove` sends only `{move:{from,to,promotion}, socket_id}` — **no clock fields** (GameWebSocketService L228-234). `pauseGame` sends `white_time`/`black_time` (seconds) but per-move clock is never persisted. | **ANDROID-MISSING: per-move clock persistence to backend.** On reconnect/refresh, Android's clocks are not server-corrected the way web's are; clock can drift or reset from server-side defaults. | web: `play/PlayMultiplayer.js` (L4836-4837, L2415-2416); backend: `WebSocketController.php` (`broadcastMove` L595-596), `GameController.php` (L484-485); android: `data/websocket/GameWebSocketService.kt` (L228-234, 264-271) |

---

## 5. Backend move persistence + FEN saving

| Aspect | Web behavior | Android behavior | Gap | Key files |
|---|---|---|---|---|
| Multiplayer per-move persistence | `POST websocket/games/{id}/move` (`broadcastMove`) → `GameRoomService::broadcastMove` validates+applies move, recomputes FEN/turn server-side, stores. Web sends rich metadata (san/uci/scores/`move_time_ms`/`player_rating`/clock ms). | `POST websocket/games/{id}/move` with only `move.{from,to,promotion}`. Server recomputes FEN (metadata is optional/nullable in validation), so move+FEN **are** persisted server-side. | Parity on core FEN/move persistence; DIVERGENT metadata (Android omits scores, move_time_ms, clock ms, player_rating). | backend: `WebSocketController.php` (`broadcastMove` L543-640); android: `data/websocket/GameWebSocketService.kt` (L228-234) |
| Synthetic (bot) move persistence in MP | Web posts `websocket/games/{id}/synthetic-move` after computing bot's Stockfish move (PlayMultiplayer.js L4618). | Android multiplayer has a synthetic fallback (`sendMove(fallbackBody)` VM L920) for bot MP games. | Roughly parity in MP synthetic path. | web: `play/PlayMultiplayer.js` (L4618-4640); android: `game/PlayMultiplayerViewModel.kt` (L920) |
| **Vs-computer** move/FEN persistence | For logged-in users the vs-computer game is a backend game; final FEN + moves saved via `completeGame` (`updateData['fen']`, `['moves']`, GameController L652-653). (Intermediate moves for local computer games are kept client-side; final state persisted on completion.) | Android vs-computer **persists nothing** — no backend game, no move endpoint, no completeGame. Entire game is local. | **ANDROID-MISSING: vs-computer games not persisted at all** (no FEN, no moves, no completion) — root cause shared with §3. | web: `play/PlayComputer.js` (L851-861); backend: `GameController.php` (`completeGame` L642-660); android: `game/PlayComputerViewModel.kt` (whole VM — network only in persona-start path) |
| Final FEN on end (MP) | Server sets `fen_final` on game end broadcasts (WebSocketController L265, L1592). | Consumes server `GameEnded` event; relies on server FEN. | Parity (server-driven). | backend: `WebSocketController.php` (L265, L1592) |

---

## Summary of concrete gaps (most impactful first)

1. **ANDROID-MISSING — Rated vs-computer games change no rating & are not recorded.** Android's local `PlayComputerViewModel` never calls a completion endpoint (no `completeGame` in `GameApi`). The "Rated Game" switch produces a local-only game with no ELO and no server history. Web applies server-authoritative ELO via `completeGame` → `applyRatedSyntheticElo`.
2. **ANDROID-MISSING — Plain vs-computer games are entirely local (no backend game, no move/FEN persistence, absent from server game history).** Only the persona "real-game" path creates a backend record (and it's casual-only). Web creates a backend game on start and saves FEN+moves on completion for logged-in users.
3. **ANDROID-MISSING — Learning mode (and explicit Casual/Companion mode selector) absent in Android vs-computer.** Backend `games.learning_mode` / `learning_help_limit` / learner-rating flow is web-only. Android exposes just a binary rated toggle + personas.
4. **DIVERGENT — Undo budgets differ ~3×.** Web Easy/Med/Hard/Expert = 15/9/6/3; Android = 5/3/2/1 (rated=0 on both). Same difficulty gives very different undo allowances across platforms.
5. **ANDROID-MISSING — Multiplayer rating-change delta not shown.** Web calls `getRatingChange(gameId)` and renders `RatingChangeDisplay` after MP games; Android hardcodes `ratingChange = 0` and never calls the (already-wired) `getRatingChange` endpoint.
6. **ANDROID-MISSING — Per-move clock not persisted to backend in multiplayer.** Web sends `white/black_time_remaining_ms` on every move (`broadcastMove` stores them); Android `sendMove` sends only from/to/promotion. Server can't reconcile Android clocks per-move; higher drift/desync risk on reconnect.
7. **DIVERGENT — Move metadata on MP moves.** Android omits `move_time_ms`, per-player scores, and `player_rating` that web attaches. Core FEN/move persistence is intact (server recomputes), but analytics/scoring metadata is thinner from Android.
