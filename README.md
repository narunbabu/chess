# Chess Web Application

This project is a web-based chess application with a React frontend and a Laravel backend.

## Project Structure

- `chess-frontend/`: Contains the React frontend application.
- `chess-backend/`: Contains the Laravel backend application.

## Getting Started

Further instructions on setting up and running the frontend and backend will be added here.

ffplay -f lavfi -i testsrc=size=320x240:rate=15 -f flv rtmp://localhost:1935/live/test

rtmp://192.168.1.4:1935/live/mystreamarun123

 # 1. Run the new migration for game_connections table
  ./artisan migrate

  # 2. Clear and rebuild caches for the new routes and services
  ./artisan route:clear
  ./artisan config:clear
  ./artisan cache:clear

  # 3. Start Laravel Reverb WebSocket server (in a separate terminal)
  ./artisan reverb:start

  # 4. Start the Laravel development server (in another terminal)
  ./artisan serve

  # 5. Optional: Check if all routes are registered correctly
  ./artisan route:list | grep websocket

 # 1. Clear caches for new routes
  php artisan route:clear
  php artisan config:clear

  # 2. Check new routes are registered
  php artisan route:list | findstr websocket

  # 3. Run the comprehensive test suite
  php artisan test tests/Feature/WebSocketConnectionTest.php

  # 4. Run the simple flow test (optional)
  php test_websocket_flow.php

  # 5. Start servers for live testing
  # Terminal 1: Laravel Reverb WebSocket server
  php artisan reverb:start

  # Terminal 2: Laravel development server
  php artisan serve

  php artisan serve --port=8000 --host=127.0.0.1


