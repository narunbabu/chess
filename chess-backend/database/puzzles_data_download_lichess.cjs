// save as fetch-lichess-puzzles.js and run with: node fetch-lichess-puzzles.js
const fs = require('fs');
const https = require('https');
const readline = require('readline');

// Lichess puzzle database (CSV format)
const DB_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
// Note: You will need to download and extract the .csv file first as it is very large.
// Once extracted to 'lichess_db_puzzle.csv', run this script.

async function generateStage1Puzzles() {
  const puzzles = [];
  const fileStream = fs.createReadStream('lichess_db_puzzle.csv');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    // CSV Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const [id, fen, movesStr, ratingStr, , , , themesStr] = line.split(',');
    const rating = parseInt(ratingStr, 10);
    
    // Filter for Stage 1: 1600 - 1750 ELO
    if (rating >= 1600 && rating <= 1750) {
      const themes = themesStr.split(' ');
      
      // Filter for our specific themes
      const hasTargetTheme = themes.some(t => 
        ['pin', 'discoveredAttack', 'clearance', 'advantage', 'fork'].includes(t)
      );

      if (hasTargetTheme) {
        const moves = movesStr.split(' ');
        const playerColor = fen.includes(' w ') ? 'w' : 'b';
        
        // 70% medium (1600-1699), 30% hard (1700-1750)
        const difficulty = rating < 1700 ? 'medium' : 'hard';

        puzzles.push({
          id: `s1_lichess_${id}`,
          stage: 1,
          fen: fen,
          moves: moves, // Note: Lichess uses UCI format (e.g., e2e4). You may need to convert to SAN using chess.js if required by your board.
          themes: themes.slice(0, 3), // Take top 3 themes
          difficulty: difficulty,
          explanation: `Find the best move for ${playerColor === 'w' ? 'White' : 'Black'}. Rating: ${rating}`,
          playerColor: playerColor
        });

        if (puzzles.length >= 200) {
          break;
        }
      }
    }
  }

  fs.writeFileSync('stage1_200_puzzles.json', JSON.stringify(puzzles, null, 2));
  console.log('Successfully generated 200 Stage 1 puzzles!');
}

generateStage1Puzzles();