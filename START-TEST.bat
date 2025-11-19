@echo off
echo ===================================
echo   Chess Championship Test
echo ===================================
echo.
echo Quick Start Guide:
echo.
echo 1. Run this command to start the dev server:
echo    cd chess-frontend ^&^& npm start
echo.
echo 2. Open your browser to: http://localhost:3000
echo.
echo 3. To add the test, temporarily add this to App.js:
echo    import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
echo    function App() { return ^<ChampionshipVictoryTest /^>; }
echo.
echo 4. Test includes Victory, Draw, and Loss scenarios
echo.
echo Documentation:
echo - Full guide: docs\tests\championship-test-guide.md
echo - Quick start: TEST_QUICK_START.md
echo.
pause