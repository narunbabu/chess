# Chess Championship Test - Quick Start
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Chess Championship Test" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPTIONS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start development server:" -ForegroundColor White
Write-Host "   cd chess-frontend; npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Access the test:" -ForegroundColor White
Write-Host "   ✅ Route already configured: /test/championship" -ForegroundColor Green
Write-Host "   Or temporarily replace App.js:" -ForegroundColor Gray
Write-Host "   function App() { return <ChampionshipVictoryTest />; }" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "TEST SCENARIOS:" -ForegroundColor Yellow
Write-Host "- Victory: Defeat GrandMaster2024" -ForegroundColor Green
Write-Host "- Draw: Draw with ChessMaster99" -ForegroundColor Yellow
Write-Host "- Loss: Lose to ChessProdigy" -ForegroundColor Red
Write-Host ""
Write-Host "DOCS:" -ForegroundColor Yellow
Write-Host "- Full guide: docs/tests/championship-test-guide.md"
Write-Host "- Quick start: TEST_QUICK_START.md"
Write-Host ""