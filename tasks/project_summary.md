# Project Summary: Chess Web Application

## Objectives

The project is a web-based chess application that allows users to play chess against a computer. It includes features for training, game history, and user authentication.

## Technology

### Frontend
*   **React:** A JavaScript library for building user interfaces.
*   **react-router-dom:** For handling navigation between different pages.
*   **axios:** For making HTTP requests to the backend API.
*   **chess.js:** For chess game logic and move generation.
*   **react-chessboard:** A React component for displaying and interacting with a chessboard.
*   **date-fns:** For date formatting.
*   **gif.js & html2canvas:** For creating GIF animations of games.

### Backend
*   **Laravel:** A PHP framework for building web applications.
*   **Laravel Sanctum:** For API authentication.
*   **MySQL:** Database for storing game history and user data.
*   **Vite:** A build tool for frontend assets.

## Design

### Frontend
The frontend is built with React and uses a component-based architecture. Key components include:

*   **App:** The main application component that handles routing and authentication.
*   **PlayComputer:** Component for playing chess against the computer.
*   **TrainingHub:** Component for accessing training exercises.
*   **TrainingExercise:** Component for individual training exercises.
*   **GameHistory:** Component for viewing game history.
*   **GameReview:** Component for reviewing past games.
*   **Login:** Component for user login.
*   **Dashboard:** Component for displaying user information and game statistics.
*   **AuthCallback:** Component for handling authentication callbacks.
*   **LandingPage:** The main landing page.

The frontend uses React Router for navigation and Axios for making API requests to the backend. It also uses the chess.js library for handling chess game logic and react-chessboard for rendering the chessboard.

### Backend
The backend is built with Laravel and provides an API for the frontend to interact with. Key features include:

*   **API endpoints for:**
    *   User authentication (login, register, logout) using Laravel Sanctum.
    *   Social authentication (redirect, callback) using social providers.
    *   Storing game history.
    *   Retrieving game history (summary and full details).
    *   Retrieving user rankings.
*   **Controllers:**
    *   `AuthController`: Handles user authentication.
    *   `SocialAuthController`: Handles social authentication.
    *   `GameHistoryController`: Handles game history operations (store, index, show, rankings).
*   **Models:**
    *   `User`: Represents a user in the system.
    *   `GameHistory`: Represents a game history record.
*   **Database Migrations:**
    *   Migrations for creating the `users` and `game_histories` tables.

The backend uses Laravel Sanctum for API authentication and stores game history data in a MySQL database.

## Game Play Design

The `PlayComputer` component manages the game play. It uses the `chess.js` library to handle the game logic and the `react-chessboard` component to render the chessboard.

The game flow is as follows:

1.  The user selects a difficulty level and a color.
2.  The user starts the game.
3.  The computer makes a move based on the selected difficulty level.
4.  The user makes a move.
5.  The game continues until the game is over (checkmate, stalemate, etc.).

The `makeComputerMove` function in `chess-frontend/src/utils/computerMoveUtils.js` is responsible for generating the computer's moves. It uses the Stockfish engine to evaluate the board and select the best move.

## Game Saving

The `GameHistoryController` in `chess-backend/app/Http/Controllers/Api/GameHistoryController.php` handles the saving of game history. The `store` method receives the game data from the frontend, validates it, and saves it to the database.

The game data is stored in the `game_histories` table in the MySQL database. The `moves` column stores the game moves in a compressed string format, using the `encodeGameHistory` function in `chess-frontend/src/utils/gameHistoryStringUtils.js`.

## Game Reconstruction

The `GameReview` component in `chess-frontend/src/components/GameReview.js` handles the reconstruction of the game. It retrieves the game data from the database and uses the `reconstructGameFromHistory` function in `chess-frontend/src/utils/gameHistoryStringUtils.js` to reconstruct the game moves.

The `reconstructGameFromHistory` function decodes the compressed string of moves and uses the `chess.js` library to replay the moves and reconstruct the game state.

## Video Creation

The `GameCompletionAnimation` component in `chess-frontend/src/components/GameCompletionAnimation.js` handles the creation of the game video. It uses the `gif.js` library to create a GIF animation of the game.

The `exportAsGIF` function captures the frames of the chessboard and adds them to the GIF animation. The GIF animation is then downloaded to the user's computer.
