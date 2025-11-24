# Android Play Computer Implementation Plan

Based on the web implementation in `PlayComputer.js`, `ChessBoard.js`, and supporting components/utils (e.g., `useGameTimer`, `makeComputerMove`, `saveGameHistory`), the core logic uses Chess.js for game state/validation (moves, game over detection via `isGameOver()`, check via `inCheck()`), Stockfish integration for AI moves, audio playback for events, a custom timer hook for per-player countdowns, and an array-based move history (`gameHistory`) for backend saving. The Android app (likely React Native or Expo-based, given the web transformation) should mirror this structure but adapt for mobile (e.g., using `react-native-chessboard` or similar for board rendering, `expo-av` for sounds, and AsyncStorage/local DB for state).

The plan assumes access to the Android project files (e.g., via `list_files` on Android dirs if needed) and focuses on porting web logic while fixing glitches. Implement iteratively: test each feature in isolation (e.g., via Android emulator), then integrate. Use React Native best practices (e.g., hooks for state, Expo for media/network). Backend integration remains the same (Laravel API via `saveGameHistory`).

## 1. Setup and Project Structure Alignment
- **Goal**: Ensure Android mirrors web architecture for easy porting.
- **Steps**:
  - Create/update directories: `src/components/play/` (for `PlayComputer.js`, `ChessBoard.js`), `src/utils/` (for timers, AI, history), `src/services/` (for API saves), `assets/sounds/` (add MP3 files: `move.mp3`, `check.mp3`, `game-end.mp3` from web).
  - Install dependencies if missing: `npm install chess.js react-native-chessboard expo-av @react-native-async-storage/async-storage` (for board, sounds, local storage). For Stockfish, use `stockfish-native` or a JS wrapper like `stockfish.js` (web-compatible, runs in RN via WebView if needed).
  - Port key files:
    - `PlayComputer.js`: Main component with state (game, timers, history), effects for turns/AI, `onDrop` for moves.
    - `ChessBoard.js`: Board rendering with drag-drop, visual feedback (highlights, arrows).
    - Add `GameEndCard.js` (from web tabs): Modal for end screen (win/loss/draw, scores).
  - Handle mobile specifics: Use `Dimensions` API for responsive board sizing (like web's ResizeObserver). Add orientation listener (e.g., `useOrientation` hook) for landscape/portrait layouts.
  - Test: Run app, verify board renders starting position without crashes.

## 2. Fix Game Over Recognition and End Card Display
- **Issue**: After game over (checkmate/stalemate/draw), engine allows continued play; no end card shown.
- **Root Cause (from web)**: Game over checked via `game.isGameOver()` after each move in `onDrop` (player) and computer turn effect. If true, stop timers, set `gameOver=true`, show `GameCompletionAnimation` (or `GameEndCard`), save history. Likely missing in Android port.
- **Steps**:
  - In `PlayComputer.js` (or equivalent Android screen):
    - After player move (`onDrop`): Copy web logic – create `gameCopy.move(...)`, if successful, check `gameCopy.isGameOver()`. If true, set `gameOver=true`, stop timers (`clearInterval(timerRef)`), show end card, call `handleGameComplete` (saves history).
    - After AI move: In useEffect for computer turn, after `makeComputerMove`, check `newGame.isGameOver()`. If true, trigger end.
    - Add state: `const [gameOver, setGameOver] = useState(false); const [showEndCard, setShowEndCard] = useState(false);`.
    - Prevent further moves: In `onSquareClick`/`onDrop`, return early if `gameOver`.
  - Port `GameEndCard.js`: Modal with result text (e.g., "Checkmate! You win"), scores, replay/new game buttons. Use `Modal` from RN, overlay on board.
  - Handle resignation/draw: Add buttons in UI; on resign, force game over with opponent win.
  - Backend tie-in: On end, encode history (PGN via `game.pgn()` or custom `encodeGameHistory`), POST to `/api/games` (like web's `saveGameHistory`).
  - Test: Play to checkmate (e.g., Fool's Mate). Verify: moves stop, end card shows, history saves, no continued play. Use Android logs (`adb logcat`) for debugging.

## 3. Implement Full-Fledged Chess Engine (AI Opponent)
- **Issue**: Doubt about full engine; web uses Stockfish for realistic play.
- **Root Cause (from web)**: `makeComputerMove` integrates Stockfish (depth-based search, thinking time). Returns new game state after best move.
- **Steps**:
  - Install Stockfish for RN: Use `stockfish-native` (native module) or `stockfish.js` (JS port, runs in background thread via Worker if supported).
  - Port `makeComputerMove` to `utils/computerMoveUtils.js`:
    - Initialize engine: `const engine = new Stockfish(); engine.onmessage = handleResponse;`.
    - On computer turn: Set position (`engine.postMessage('position fen ' + game.fen())`), go to depth (`'go depth ' + computerDepth`), parse best move from response.
    - Add artificial delay: `MIN_PERCEIVED_COMPUTER_THINK_TIME = 1500ms` to simulate thinking (use `setTimeout`).
    - Fallback: If Stockfish fails, use simple random legal move from `game.moves()`.
  - Difficulty: Port `DifficultyMeter.js` – slider (1-16 depth), map to time (e.g., depth 2 = 1s, depth 8 = 5s).
  - Integrate in `PlayComputer.js`: useEffect triggers on computer turn (`game.turn() === computerColor && !computerMoveInProgress`). Set `computerMoveInProgress=true` during calc, play move sound/check sound.
  - Mobile optimizations: Run engine off-main-thread (WebView for JS version). Limit max depth to 8-10 for performance on mobile.
  - Test: Set low difficulty, verify AI makes valid moves (e.g., responds to e4 with e5). Increase depth, check longer "thinking". Profile CPU/battery usage.

## 4. Add Sound Effects
- **Issue**: No sounds attached.
- **Root Cause (from web)**: Audio objects (`new Audio(...)`) played on move (`moveSoundEffect.play()`), check (`checkSoundEffect`), end (`gameEndSoundEffect`).
- **Steps**:
  - Use Expo AV: `expo install expo-av`. Create `utils/soundUtils.js`:
    - `const playSound = async (soundFile) => { const { sound } = await Audio.Sound.createAsync(require(soundFile)); await sound.playAsync(); };`.
    - Preload: In component mount, preload all sounds for low latency.
  - Add files: Copy web sounds to `assets/sounds/`, require in code (e.g., `require('../../assets/sounds/move.mp3')`).
  - Triggers:
    - Player/AI move: Call `playSound(moveSound)` after successful `game.move()`.
    - Check: After move, if `game.isCheck()`, play `checkSound`.
    - Game end: In `handleGameComplete`, play `gameEndSound`.
  - Handle mobile: Request audio permissions if needed (iOS/Android). Mute option via settings (use `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })`).
  - Test: Make moves, verify sounds play (use device speakers). Test in silent mode/no headphones.

## 5. Implement Time Calculation and Timer Countdown
- **Issue**: No per-player timers/tracking.
- **Root Cause (from web)**: `useGameTimer` hook manages `playerTime`/`computerTime` (initial e.g., 10min), decrements active timer (`activeTimer`), switches on turns. Displays via `TimerDisplay.js`.
- **Steps**:
  - Port `useGameTimer` to `utils/timerUtils.js` (custom hook):
    - State: `const [playerTime, setPlayerTime] = useState(600);` (10min in seconds), similar for computer. `const [activeTimer, setActiveTimer] = useState('w'); const [isTimerRunning, setIsTimerRunning] = useState(false);`.
    - Interval: `useEffect` with `setInterval(() => { if (activeTimer === playerColor) setPlayerTime(prev => Math.max(0, prev - 1)); ... }, 1000);`.
    - Functions: `startTimerInterval()` (start interval if not running), `pauseTimer()` (clear), `switchTimer(color)` (switch active, pause current), `resetTimer()` (reset times).
    - Time up: If time <=0 on turn, force game over (opponent wins via resignation-like logic).
  - UI: Port `TimerDisplay.js` – two timers (player/computer), highlight active (green/red border, pulsing dot). Show in sidebar or above board.
  - Increment/decrement: Switch on move complete (player: after `onDrop`; AI: after move). Track per-move time (`moveStartTimeRef.current = Date.now();` on turn start, calc on end for history).
  - Initial time: Base on difficulty (e.g., easy=15min, hard=5min) or fixed (10min/side).
  - Mobile: Use `setInterval` carefully (clear on unmount). Persist time in AsyncStorage if app backgrounds.
  - Test: Start game, make moves – verify timers decrement/switch correctly. Time out one side, confirm game ends.

## 6. Track and Save Moves to Backend Database
- **Issue**: No move remembering/sending to backend.
- **Root Cause (from web)**: `gameHistory` array per move: `{ moveNumber, fen, move (chess.js obj), playerColor, timeSpent, evaluation }`. On end, encode (JSON/PGN), save via `saveGameHistory` (POST to API with user ID, date, moves, result, scores).
- **Steps**:
  - In `PlayComputer.js`: Initialize `const [gameHistory, setGameHistory] = useState([]);`. After each move (player/AI), add entry: `setGameHistory(prev => [...prev, { fen: previousState.fen(), move: moveResult, ... }]);`.
  - Evaluation: Optional – port `evaluateMove` (simple centipawn calc or Stockfish eval) for scores.
  - On end (`handleGameComplete`): Create payload `{ user_id: user.id, player_color, computer_depth, moves: JSON.stringify(gameHistory), result: { outcome: game.outcome(), reason: game.isGameOver() ? 'checkmate' : 'stalemate' }, final_score: playerScore, date: new Date().toISOString() }`. POST to backend `/api/games` (use `fetch` or Axios).
  - PGN export: Use `game.pgn()` for compact save, reconstruct via `new Chess().load_pgn(pgn)`.
  - Auth: Use `useAuth` context for user token in headers.
  - Replay: Port replay mode – load history, step through moves with timer.
  - Test: Play full game, check backend DB (e.g., `games` table) for saved entry with moves array/PGN, times, result. Verify reconstruction plays back correctly.

## 7. Integration, Testing, and Polish
- **Full Flow**: Pre-game (color/difficulty select), countdown (3s), turns (player/AI alternate), end (card + save).
- **UI/UX Mobile Fixes**: Full-screen background (`chess_playing_kids_crop.png` with gradient overlay via `ImageBackground`). Direct nav from Landing "Play Computer" button (use React Navigation). Buttons: Pause/Resume, Resign, New Game.
- **Edge Cases**: Draw offers (add button, accept via `game.draw()`), time flags (incremental time if needed), undo (last move if not AI turn).
- **Testing**:
  - Unit: Jest for utils (e.g., timer decrement, move validation).
  - E2E: Detox/Flipper for flows (start game → move → AI respond → end).
  - Devices: Emulator + physical (iOS/Android) for sounds/timers/performance.
  - Glitches: Log FEN on errors; ensure no infinite loops (e.g., clear intervals).
- **Deployment**: Build APK (`expo build:android`), test on device. If backend save fails, fallback to local (AsyncStorage).
- **Timeline Estimate**: 1-2 days per feature (total 1 week), assuming web code ports cleanly. Prioritize: Game over fix → Engine → Timers → Sounds/History.

This plan ensures the Android app matches web functionality while fixing glitches. Once implemented, verify via gameplay sessions.
