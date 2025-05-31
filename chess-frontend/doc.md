Project Documentation
Project Structure

chess-trainer/
└── src/
├── App.js
├── index.js
├── index.css
├── components/
│ ├── Countdown.js
│ ├── GameCompletionAnimation.js
│ ├── TrainingExercise.js
│ ├── TrainingHub.js
│ └── play/
│ ├── ChessBoard.js
│ ├── GameControls.js
│ ├── GameInfo.js
│ ├── PlayComputer.js
│ ├── ScoreDisplay.js
│ ├── TimerButton.js
│ └── TimerDisplay.js
├── services/
│ └── gameHistoryService.js
└── utils/
├── computerMoveUtils.js
├── evaluate.js
├── gameHistoryUtils.js // (Currently empty)
├── gameStateUtils.js
├── timerUtils.js
└── trainingExercises.js
File-by-File Functionality
src/App.js

Purpose: Acts as the root component that sets up routing (using React Router) and navigation.
Functionality: Renders links for “Play vs Computer” and “Training Exercises” and maps URL routes to the respective components.
src/index.js

Purpose: Application entry point.
Functionality: Renders the App component into the DOM.
src/index.css

Purpose: Global CSS styles.
Functionality: Provides styling for the layout, typography, buttons, board container, training cards, etc.
src/components/Countdown.js

Purpose: Displays a countdown overlay before a game or exercise begins.
Functionality: Uses React hooks to decrement a counter every second until it finishes.
src/components/GameCompletionAnimation.js

Purpose: Shows an animated overlay upon game completion.
Functionality: Displays a message (Victory, Draw, or Defeat) and score, with animations controlled via CSS keyframes.
src/components/TrainingExercise.js

Purpose: Provides an interactive chess puzzle/training exercise interface.
Functionality: Loads an exercise based on URL parameters, sets up a chessboard, handles move inputs and validations, and can reveal the correct solution.
src/components/TrainingHub.js

Purpose: Displays a list of available training exercises.
Functionality: Renders exercise cards for beginner and intermediate levels with navigation links.
src/components/play/ChessBoard.js

Purpose: Encapsulates the chessboard UI and move options.
Functionality: Renders a chessboard (using react-chessboard), handles square clicks/right-clicks to show legal moves, and applies custom square styles.
src/components/play/GameControls.js

Purpose: Renders various game control buttons.
Functionality: Provides buttons for “New Game”, “Switch Sides”, difficulty selection, pause/resume, replay controls, and loading saved games.
src/components/play/GameInfo.js

Purpose: Displays additional game information.
Functionality: Shows game status, whose turn it is, hints (if a move is complete), and replay progress information.
src/components/play/PlayComputer.js

Purpose: Main component for playing a game against the computer.
Functionality: Integrates the chess engine, move handling, timers, score evaluation, game history (with replay capability), and composes the UI using child components (ChessBoard, GameControls, GameInfo, etc.). It leverages custom hooks and utility functions for timing and move evaluation.
src/components/play/ScoreDisplay.js

Purpose: Displays the current score and last move evaluation.
Functionality: Shows the player’s score and details (e.g., “Good”, “Excellent”) for the last move.
src/components/play/TimerButton.js

Purpose: Provides a timer control button to end a turn.
Functionality: Its appearance (color, text, disabled state) reflects whether the move is complete and whose turn it is.
src/components/play/TimerDisplay.js

Purpose: Displays the countdown timers for the player and computer.
Functionality: Uses a helper function to format time and applies styling to indicate the active timer.
src/services/gameHistoryService.js

Purpose: Handles saving and retrieving game history.
Functionality: Uses localStorage to save, retrieve, delete, and clear saved game histories.
src/utils/computerMoveUtils.js

Purpose: Provides functions to generate computer moves based on difficulty level.
Functionality: Implements different strategies (random, intermediate with captures/checks, advanced with heuristics) and simulates “thinking” time.
src/utils/evaluate.js

Purpose: Contains chess move evaluation logic.
Functionality: Evaluates moves based on material, positional, tactical, king safety, development, time bonus, and risk/reward; includes helper functions such as game phase detection.
src/utils/gameHistoryUtils.js

Purpose: (Reserved for additional game history utilities)
Functionality: Currently empty.
src/utils/gameStateUtils.js

Purpose: Contains functions for updating game state and status.
Functionality: Provides functions like updateGameStatus (to check for checkmate, stalemate, etc.) and evaluateMove (to evaluate move quality and update score).
src/utils/timerUtils.js

Purpose: Provides a custom hook for managing the game timers.
Functionality: Manages player and computer time countdowns using setInterval and exposes methods to start/pause the timer and format time.
src/utils/trainingExercises.js

Purpose: Contains the data for training exercises.
Functionality: Exports an object with exercise details (FEN positions, solutions, messages) and a helper function to retrieve an exercise by level and id.
