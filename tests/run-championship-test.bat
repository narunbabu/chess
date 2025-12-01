@echo off
:: Championship Victory Test Runner
:: This script helps you run the championship victory test

echo.
echo ===================================
echo   Chess Championship Test Runner
echo ===================================
echo.
echo Choose an option:
echo 1. Start development server
echo 2. Create test route
echo 3. View integration instructions
echo 4. View sample test data
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting development server...
    echo.
    echo Navigate to chess-frontend directory and run:
    echo cd chess-frontend
    echo npm start
    echo.
    echo Then open your browser to http://localhost:3000
    echo.
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    echo Creating test route...
    echo.
    echo Add this to your App.js:
    echo.
    echo import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
    echo.
    echo # In your routes or render method:
    echo ^<Route path='/test/championship' element={^<ChampionshipVictoryTest /^>} /^>
    echo.
    echo Then navigate to: http://localhost:3000/test/championship
    echo.
    pause
    exit /b 0
)

if "%choice%"=="3" (
    echo.
    echo Integration Instructions
    echo ========================
    echo.
    echo Option A - Quick Test (Temporary):
    echo ----------------------------------
    echo Step 1. Open: chess-frontend/src/App.js
    echo Step 2. Add import:
    echo    import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
    echo Step 3. Replace your main component temporarily with:
    echo    ^<ChampionshipVictoryTest /^>
    echo Step 4. Run: npm start
    echo Step 5. Open browser to: http://localhost:3000
    echo.
    echo Option B - Add as Route (Recommended):
    echo --------------------------------------
    echo Step 1. Open: chess-frontend/src/App.js
    echo Step 2. Add import:
    echo    import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
    echo Step 3. Add route (if using React Router):
    echo    ^<Route path='/test/championship' element={^<ChampionshipVictoryTest /^>} /^>
    echo Step 4. Run: npm start
    echo Step 5. Navigate to: http://localhost:3000/test/championship
    echo.
    echo Option C - Standalone Test:
    echo ---------------------------
    echo Step 1. Create a new file: chess-frontend/src/TestApp.js
    echo Step 2. Copy this content:
    echo.
    echo    import React from 'react';
    echo    import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
    echo.
    echo    function TestApp() {
    echo      return ^<ChampionshipVictoryTest /^>;
    echo    }
    echo.
    echo    export default TestApp;
    echo.
    echo Step 3. Update index.js temporarily to use TestApp
    echo Step 4. Run: npm start
    echo.
    pause
    exit /b 0
)

if "%choice%"=="4" (
    echo.
    echo Sample Test Data
    echo ================
    echo.
    echo Championship Data:
    echo - Tournament: Spring Championship 2025
    echo - Round: 3
    echo - Standing: 5th of 32 players
    echo - Points: 21 points
    echo.
    echo Test Scenarios:
    echo - Victory: Defeat GrandMaster2024 (Rating: 2150)
    echo - Draw: Draw with ChessMaster99 (Rating: 2200)
    echo - Loss: Lose to ChessProdigy (Rating: 2300)
    echo.
    pause
    exit /b 0
)

if "%choice%"=="5" (
    echo.
    echo Goodbye!
    echo.
    exit /b 0
)

echo.
echo Invalid choice. Please enter 1-5.
echo.
pause
exit /b 1