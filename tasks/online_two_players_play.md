# Online Multiplayer Implementation Plan

## 1. Overview

This document outlines the architecture and data flow for the **simulated online multiplayer chess functionality**. The implementation provides a realistic user experience of finding an opponent, sending an invitation, and playing a match, all handled entirely on the frontend without a dedicated backend server.

The core user flow is as follows:
1.  **Login**: User authenticates (simulated) and a session is created.
2.  **Lobby**: User sees a list of available online players.
3.  **Invite**: User invites another player and waits for a simulated acceptance.
4.  **Play**: The game starts, with turn management enforced for the logged-in user.

## 2. Core Components & Architecture

The system relies on three key React features: **Components**, **Context for State Management**, and **Router for Navigation and Data Passing**.

### `components/AuthContext.tsx`
This is the global state manager for the user's session.
-   **Purpose**: To hold the authenticated user's data and make it accessible throughout the application.
-   **State**: It stores a `user` object containing `{ name: string, avatar: string, rating: number }`.
-   **Functions**:
    -   `login(userData)`: Sets the user state upon successful authentication.
    -   `logout()`: Clears the user state and redirects to the login page.
-   **Usage**: It's used by the `ChessPage` to identify the current player and enforce turn-based rules. It's also used by the `Header` to display user info.

### `components/LoginPage.tsx`
This is the entry point for authenticated sessions.
-   **Purpose**: To simulate user login and initiate the session.
-   **Functionality**:
    1.  On form submission or "Sign in with Google", it simulates a successful API call.
    2.  It calls the `login()` function from `AuthContext` with static user data (`Player One`, `1200` rating).
    3.  It uses the `useNavigate` hook from `react-router-dom` to redirect the user to the `/lobby`.

### `components/LobbyPage.tsx`
This component serves as the matchmaking hub.
-   **Purpose**: To display available opponents and manage the game invitation process.
-   **Functionality**:
    1.  **User List**: It renders a static, hardcoded list of "online" players.
    2.  **Invitation Flow**:
        -   When the user clicks "Invite", a local state `inviteStatus` is set to `'sending'`.
        -   An `InvitationModal` is displayed, showing a loading state.
        -   A `setTimeout` simulates the opponent thinking. After a few seconds, the `inviteStatus` is changed to `'accepted'`.
    3.  **Starting the Game (Key Data Transfer)**:
        -   After the invitation is "accepted", another `setTimeout` gives the user a moment to read the confirmation.
        -   It then uses `navigate('/play', { state: { ... } })` to redirect to the `ChessPage`.
        -   **Crucially, it passes the game setup data via the router's `state` object.** This data includes `gameMode: 'online'`, `player1` (the logged-in user from `AuthContext`), and `player2` (the invited user).

### `components/ChessPage.tsx`
This is the main game board, enhanced to handle online matches.
-   **Purpose**: To render the chessboard and manage game logic for a two-player online match.
-   **Functionality**:
    1.  **Receiving Game State**: It uses the `useLocation` hook to access the `state` object passed from the `LobbyPage`.
    2.  **Game Setup**:
        -   An `useEffect` hook runs on component mount and checks for the presence of `location.state`.
        -   If online game data exists, it sets `isOnlineGame` to `true`.
        -   It **randomly assigns** 'White' and 'Black' roles to `player1` and `player2` to ensure fairness.
        -   The UI is updated to display the names of both players.
    3.  **Turn Management**:
        -   It fetches the current `user` from `AuthContext`.
        -   In the `handleSquareClick` function, it checks whose turn it is.
        -   It compares the active turn (`game.turn()`) with the logged-in user's assigned color (`players.white === user.name ? 'w' : 'b'`).
        -   This logic **prevents the user from moving their opponent's pieces**, effectively simulating a real online turn-based system.
    4.  **Game Over**: The end-of-game modal is updated to display the correct winner by name (`${winnerName} Wins!`).

## 3. Data Flow Summary

The data flow is designed to be unidirectional and easy to follow:

1.  **`LoginPage`**:
    -   **Action**: User logs in.
    -   **State Change**: `AuthContext` `user` state is set.
    -   **Result**: Navigate to `/lobby`.

2.  **`LobbyPage`**:
    -   **Action**: User invites an opponent.
    -   **State Change**: Local `inviteStatus` changes.
    -   **Result**: Navigate to `/play` and pass `{ player1, player2 }` in router state.

3.  **`ChessPage`**:
    -   **Action**: Component mounts.
    -   **State Change**: Reads `location.state` to configure the game board and player names.
    -   **Result**: An online match is set up.

4.  **`ChessPage` (During Gameplay)**:
    -   **Action**: User tries to make a move.
    -   **State Change**: `handleSquareClick` reads `user` from `AuthContext` to validate if it's their turn.
    -   **Result**: The move is either accepted or rejected, enforcing turn-based play.

## 4. Limitations & Future Work

This implementation is a **simulation**. To build a true real-time online system, the following would be necessary:

-   **Backend Server**: A server (e.g., Node.js with Express) is needed to manage user accounts, game states, and matchmaking.
-   **Real-Time Communication**: A WebSocket server (e.g., using `socket.io`) is required to broadcast moves between two connected clients instantly.
-   **Database**: A database (e.g., PostgreSQL or MongoDB) to persist user data, game history, and ratings.
-   **Presence Management**: The backend would need to track which users are currently online and available to play.
