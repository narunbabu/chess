# Gemini Project Overview: Chess-Web

This is a full-stack web-based chess application that allows users to play chess, review games, and track their history.

## Architecture

The project follows a modern client-server architecture:

*   **`chess-frontend`**: A React-based single-page application that provides the main user interface.
*   **`chess-backend`**: A Laravel (PHP) application that serves as the backend API.
*   **`ChessNewLanding`**: A separate, newer landing page built with React and TypeScript.

## Backend (`chess-backend`)

*   **Framework**: Laravel (PHP)
*   **Database**: MySQL
*   **Core Responsibilities**:
    *   Provides a RESTful API for the frontend.
    *   Manages user authentication (including social logins) via Laravel Sanctum.
    *   Handles CRUD operations for user data and game histories.
    *   Calculates and serves user rankings and statistics.

## Frontend (`chess-frontend`)

*   **Framework**: React (JavaScript)
*   **Core Features**:
    *   Interactive chessboard for gameplay using `react-chessboard`.
    *   Complete chess logic and move validation powered by `chess.js`.
    *   AI opponent implemented using the **Stockfish** engine, which runs in a browser web worker for performance.
    *   Game history review and visualization.
    *   Ability to export completed games as animated GIFs.

## New Landing Page (`ChessNewLanding`)

*   A work-in-progress, modern landing page.
*   **Stack**: React, TypeScript, and Vite.
*   This suggests an ongoing effort to modernize the application's entry point.

## Instructions for new code

1. Keep in mind all the related logic and the stake holders of codeblocks before constructing them. The new code blocks should be consistent with existing related codes (imports and where exports happen)
2. While editing or implementing additional functionality or building additional elements care msut be taken. Disturbing already working functionality would be catastrophic and it results in unintended side effects and subogate some unseen functionality. So keep this in mind to not disturb already tested and working functionality.