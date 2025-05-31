// src/ustils/evaluate.js
/**
 * A comprehensive chess move evaluation system
 * Based on principles from modern chess engines and evaluation systems
 */

// Constants for scoring components
const PIECE_VALUES = {
  p: 1, // pawn
  n: 3, // knight
  b: 3.25, // bishop
  r: 5, // rook
  q: 9, // queen
  k: 0, // king (not typically assigned a material value)
};

// Positional bonuses for pieces (simplified version)
const POSITION_TABLES = {
  // Center control is valuable for pawns
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.1, 0.2, 0.3, 0.4, 0.4, 0.3, 0.2, 0.1],
    [0.05, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.05],
    [0, 0, 0, 0.2, 0.2, 0, 0, 0],
    [0.05, -0.05, -0.1, 0, 0, -0.1, -0.05, 0.05],
    [0.05, 0.1, 0.1, -0.2, -0.2, 0.1, 0.1, 0.05],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Knights benefit from central positions
  n: [
    [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5],
    [-0.4, -0.2, 0, 0, 0, 0, -0.2, -0.4],
    [-0.3, 0, 0.1, 0.15, 0.15, 0.1, 0, -0.3],
    [-0.3, 0.05, 0.15, 0.2, 0.2, 0.15, 0.05, -0.3],
    [-0.3, 0, 0.15, 0.2, 0.2, 0.15, 0, -0.3],
    [-0.3, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, -0.3],
    [-0.4, -0.2, 0, 0.05, 0.05, 0, -0.2, -0.4],
    [-0.5, -0.4, -0.3, -0.3, -0.3, -0.3, -0.4, -0.5],
  ],
  // Other piece position tables would follow a similar pattern
};

// Game phase scoring adjustments
const OPENING_PHASE = "opening";
const MIDDLEGAME_PHASE = "middlegame";
const ENDGAME_PHASE = "endgame";

/**
 * Main evaluation function for a player's chess move
 * @param {Object} move - The move object from a chess library (e.g., chess.js)
 * @param {Object} previousGameState - Game state before the move
 * @param {Object} newGameState - Game state after the move
 * @param {number} moveTime - Time taken for this move in seconds
 * @param {number} playerRating - Player's current rating
 * @returns {Object} Score breakdown and total score
 */
/**
 * @param {number} engineLevel   - 1 ‑ 10 difficulty of the bot (pass 1 for Human‑vs‑Human)
 */
function evaluatePlayerMove(
  move,
  previousGameState,
  newGameState,
  moveTime,
  playerRating = 1200,
  engineLevel = 1          // <‑‑  NEW
) {
  // Initialize score components
  const scoreComponents = {
    material: 0,
    positional: 0,
    tactical: 0,
    kingThreat: 0,
    development: 0,
    timeBonus: 0,
    risk: 0,
  };

  // Determine game phase
  const gamePhase = determineGamePhase(newGameState);

  // 1. Material evaluation
  if (move.captured) {
    // If player captured a piece, add positive score
    if (move.color === newGameState.turn()) {
      scoreComponents.material += PIECE_VALUES[move.captured.toLowerCase()];
    } else {
      // If player lost a piece, add negative score
      scoreComponents.material -= PIECE_VALUES[move.captured.toLowerCase()] * 1.2; // Penalize losing pieces more
    }

    // Context: piece trades have different values in different phases
    if (gamePhase === ENDGAME_PHASE) {
      // Material gains/losses are more significant in endgame
      scoreComponents.material *= 1.2;
    }
  }

  // 2. Positional assessment
  scoreComponents.positional += evaluatePositionalChange(
    previousGameState,
    newGameState,
    gamePhase
  );

  // 3. Tactical awareness
  scoreComponents.tactical += evaluateTacticalElements(move, newGameState);

  // 4. Check and checkmate evaluation
  if (newGameState.turn() !== move.color && newGameState.isCheck()) {
    scoreComponents.kingThreat += 1;

    // Higher points for checkmate
    if (newGameState.isCheckmate()) {
      scoreComponents.kingThreat += 10;
    }
  }

  // 5. Development in opening
  if (gamePhase === OPENING_PHASE) {
    scoreComponents.development += evaluateDevelopment(
      move,
      previousGameState,
      newGameState
    );
  }

  // 6. Time bonus calculation
  scoreComponents.timeBonus += calculateTimeBonus(moveTime, gamePhase);

  // 7. Risk-reward evaluation
  scoreComponents.risk += evaluateRiskReward(previousGameState, newGameState);

  // 8. Engine comparison
  const engineEvaluation = compareToEngineEvaluation(
    previousGameState,
    newGameState
  );

  // 9. Apply player skill adaptation
  const adaptedScore = adaptScoreToPlayerSkill(scoreComponents, playerRating);

  // Calculate total score
  let totalScore = Object.values(adaptedScore).reduce((s, v) => s + v, 0);

  // Difficulty scaling (see README §Scoring)
  const difficultyFactor = 1 + (Math.max(1, engineLevel) - 1) * 0.08;

  // Per‑move saturation
  const cap =
    ((move.captured
      ? PIECE_VALUES[move.captured.toLowerCase()] + 4
      : 4) *
      difficultyFactor);
  totalScore = Math.max(-cap, Math.min(cap, totalScore));

  // Adjust score based on game result
  if (newGameState.isGameOver()) {
    if (newGameState.isCheckmate()) {
      // If player is checkmated, apply large negative score
      const bonus = Math.min(
        Math.abs(totalScore) * 0.25,
        100 * difficultyFactor
      );
      if (newGameState.turn() === move.color) {
        totalScore -= bonus;
      } else {
        totalScore += bonus;
      }
    } else if (newGameState.isDraw()) {
      // Draw results in a small negative score
      totalScore -= 10;
    }
  }

  return {
    components: adaptedScore,
    total: Math.round(totalScore * 10) / 10,
    difficultyFactor,
    engineDifference: engineEvaluation,
    moveClassification: classifyMove(
      totalScore,
      engineEvaluation,
      playerRating
    ),
  };
}

/**
 * Determines the current phase of the game
 * @param {Object} gameState - Current game state
 * @returns {string} Game phase identifier
 */
function determineGamePhase(gameState) {
  const pieceCount = countPieces(gameState);
  const totalPieces = pieceCount.white + pieceCount.black;
  const moveNumber = Math.floor(gameState.history().length / 2) + 1;

  // Simple heuristic based on move number and piece count
  if (moveNumber <= 10 && totalPieces >= 28) {
    return OPENING_PHASE;
  } else if (totalPieces >= 16) {
    return MIDDLEGAME_PHASE;
  } else {
    return ENDGAME_PHASE;
  }
}

/**
 * Counts pieces on the board
 * @param {Object} gameState - Current game state
 * @returns {Object} Count of white and black pieces
 */
function countPieces(gameState) {
  const board = gameState.board();
  let white = 0;
  let black = 0;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        if (piece.color === "w") {
          white++;
        } else {
          black++;
        }
      }
    }
  }

  return { white, black };
}

/**
 * Evaluates positional changes from the move
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @param {string} gamePhase - Current game phase
 * @returns {number} Positional score change
 */
function evaluatePositionalChange(previousState, newState, gamePhase) {
  let score = 0;

  // 1. Center control evaluation
  score += evaluateCenterControl(previousState, newState);

  // 2. Piece mobility
  score += evaluatePieceMobility(previousState, newState);

  // 3. Pawn structure
  score += evaluatePawnStructure(previousState, newState, gamePhase);

  // 4. King safety (especially important in middlegame)
  if (gamePhase === MIDDLEGAME_PHASE) {
    score += evaluateKingSafety(previousState, newState) * 1.5;
  }

  return score;
}

/**
 * Evaluates center control
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} Center control score
 */
function evaluateCenterControl(previousState, newState) {
  const centerSquares = ["d4", "e4", "d5", "e5"];
  let prevControl = calculateCenterControl(previousState, centerSquares);
  let newControl = calculateCenterControl(newState, centerSquares);

  return (newControl - prevControl) * 0.3;
}

/**
 * Calculates control of center squares
 * @param {Object} gameState - Game state
 * @param {Array} centerSquares - List of center squares
 * @returns {number} Center control score
 */
function calculateCenterControl(gameState, centerSquares) {
  // For simplicity, a square is considered controlled if
  // it's occupied by a friendly piece or attacked by a friendly piece
  let controlScore = 0;
  const currentTurn = gameState.turn();

  centerSquares.forEach((square) => {
    // If occupied by friendly piece
    const piece = gameState.get(square);
    if (piece && piece.color === currentTurn) {
      controlScore += 1;
    }

    // If attacked by friendly piece
    if (isSquareAttacked(gameState, square, currentTurn)) {
      controlScore += 0.5;
    }
  });

  return controlScore;
}

/**
 * Checks if a square is attacked by a player
 * @param {Object} gameState - Game state
 * @param {string} square - Square to check (e.g., 'e4')
 * @param {string} byColor - Color attacking ('w' or 'b')
 * @returns {boolean} True if square is attacked
 */
function isSquareAttacked(gameState, square, byColor) {
  // Safe implementation that works with chess.js
  try {
    // This is a simplification since chess.js doesn't directly expose this
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Evaluates piece mobility changes
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} Mobility score
 */
function evaluatePieceMobility(previousState, newState) {
  // Count legal moves for current player before and after the move
  const prevMoves = countLegalMoves(previousState);
  const newMoves = countLegalMoves(newState);

  // Mobility advantage is valuable but not as much as material
  return (newMoves - prevMoves) * 0.05;
}

/**
 * Counts legal moves for the current player
 * @param {Object} gameState - Game state
 * @returns {number} Number of legal moves
 */
function countLegalMoves(gameState) {
  return gameState.moves().length;
}

/**
 * Evaluates pawn structure changes
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @param {string} gamePhase - Current game phase
 * @returns {number} Pawn structure score
 */
function evaluatePawnStructure(previousState, newState, gamePhase) {
  let score = 0;

  // Check for isolated pawns (simplified)
  const prevIsolatedPawns = countIsolatedPawns(previousState);
  const newIsolatedPawns = countIsolatedPawns(newState);
  score -= (newIsolatedPawns - prevIsolatedPawns) * 0.3;

  // Check for passed pawns (more valuable in endgame)
  const prevPassedPawns = countPassedPawns(previousState);
  const newPassedPawns = countPassedPawns(newState);
  const passedPawnMultiplier = gamePhase === ENDGAME_PHASE ? 0.7 : 0.3;
  score += (newPassedPawns - prevPassedPawns) * passedPawnMultiplier;

  return score;
}

/**
 * Counts isolated pawns for the current player
 * @param {Object} gameState - Game state
 * @returns {number} Number of isolated pawns
 */
function countIsolatedPawns(gameState) {
  // This is a placeholder - actual implementation would depend on chess library
  return 0;
}

/**
 * Counts passed pawns for the current player
 * @param {Object} gameState - Game state
 * @returns {number} Number of passed pawns
 */
function countPassedPawns(gameState) {
  // This is a placeholder - actual implementation would depend on chess library
  return 0;
}

/**
 * Evaluates king safety
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} King safety score
 */
function evaluateKingSafety(previousState, newState) {
  // This is a simplification - real implementation would be more complex
  const prevKingSafety = calculateKingSafety(previousState);
  const newKingSafety = calculateKingSafety(newState);

  return (newKingSafety - prevKingSafety) * 0.5;
}

/**
 * Calculates king safety score
 * @param {Object} gameState - Game state
 * @returns {number} King safety score
 */
function calculateKingSafety(gameState) {
  // Factors to consider:
  // 1. Pawn shield intact
  // 2. Attackers near king
  // 3. Open lines toward king
  // This is a placeholder
  return 0;
}

/**
 * Evaluates tactical elements of a move
 * @param {Object} move - Move object
 * @param {Object} gameState - Current game state
 * @returns {number} Tactical score
 */
function evaluateTacticalElements(move, gameState) {
  let score = 0;

  // Check for forks (one piece attacking multiple pieces)
  if (isFork(move, gameState)) {
    score += 1.5;
  }

  // Check for pins or skewers
  if (isPinOrSkewer(move, gameState)) {
    score += 1.2;
  }

  // Check for discovered attacks
  if (isDiscoveredAttack(move, gameState)) {
    score += 1.3;
  }

  return score;
}

/**
 * Checks if a move creates a fork
 * @param {Object} move - Move object
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if move creates a fork
 */
function isFork(move, gameState) {
  // Placeholder - implementation depends on chess library
  return false;
}

/**
 * Checks if a move creates a pin or skewer
 * @param {Object} move - Move object
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if move creates a pin/skewer
 */
function isPinOrSkewer(move, gameState) {
  // Placeholder - implementation depends on chess library
  return false;
}

/**
 * Checks if a move creates a discovered attack
 * @param {Object} move - Move object
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if move creates a discovered attack
 */
function isDiscoveredAttack(move, gameState) {
  // Placeholder - implementation depends on chess library
  return false;
}

/**
 * Evaluates piece development in opening
 * @param {Object} move - Move object
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} Development score
 */
function evaluateDevelopment(move, previousState, newState) {
  let score = 0;
  // Ensure flags is defined to avoid undefined.includes
  const flags = move.flags || '';
  // Developing minor pieces (knights and bishops)
  if (
    move.piece &&
    (move.piece.toLowerCase() === "n" || move.piece.toLowerCase() === "b")
  ) {
    // Check if the piece moved from its starting square
    const fromRank = move.from.charAt(1);
    if (
      (move.color === "w" && fromRank === "1") ||
      (move.color === "b" && fromRank === "8")
    ) {
      score += 0.5;
    }
  }

  // Castling is good for development and king safety
  if (flags.includes("k") || flags.includes("q")) {
    score += 1.5;
  }

  // Moving the same piece twice in the opening is generally not optimal
  if (isRepeatedPieceMove(move, previousState)) {
    score -= 0.3;
  }

  return score;
}

/**
 * Checks if the move involves moving a piece that was already moved in the opening
 * @param {Object} move - Move object
 * @param {Object} gameState - Game state
 * @returns {boolean} True if piece was already moved
 */
function isRepeatedPieceMove(move, gameState) {
  // This would require tracking piece movement history
  // Placeholder implementation
  return false;
}

/**
 * Calculates time bonus for quick, accurate moves
 * @param {number} moveTime - Time taken for move in seconds
 * @param {string} gamePhase - Current game phase
 * @returns {number} Time bonus score
 */
function calculateTimeBonus(moveTime, gamePhase) {
  // Different time thresholds based on game phase
  let timeBonusThreshold;
  switch (gamePhase) {
    case OPENING_PHASE:
      timeBonusThreshold = 5; // Faster expected in openings
      break;
    case MIDDLEGAME_PHASE:
      timeBonusThreshold = 10; // More thinking in complex middlegames
      break;
    case ENDGAME_PHASE:
      timeBonusThreshold = 8; // Precise calculation in endgames
      break;
    default:
      timeBonusThreshold = 7;
  }

  // Diminishing returns for very fast moves
  if (moveTime <= timeBonusThreshold / 4) {
    return 0.5; // Small bonus for extremely fast moves
  } else if (moveTime <= timeBonusThreshold) {
    return 1; // Full bonus for good speed
  } else if (moveTime <= timeBonusThreshold * 2) {
    return 0.5; // Half bonus for moderate speed
  } else {
    return 0; // No bonus for slow moves
  }
}

/**
 * Evaluates risk-reward balance of a move
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} Risk-reward score
 */
function evaluateRiskReward(previousState, newState) {
  // Compare material before and after
  const prevMaterial = calculateMaterialBalance(previousState);
  const newMaterial = calculateMaterialBalance(newState);
  const materialDifference = newMaterial - prevMaterial;

  // If material was sacrificed, check if position improved significantly
  if (materialDifference < -1) {
    // Sacrificed more than a pawn
    const prevEvaluation = evaluatePosition(previousState);
    const newEvaluation = evaluatePosition(newState);

    // If position improved despite material sacrifice, it might be a good sacrifice
    if (newEvaluation - prevEvaluation > Math.abs(materialDifference)) {
      return 2; // Reward for good sacrifice
    }
  }

  return 0;
}

/**
 * Calculates material balance for the current player
 * @param {Object} gameState - Game state
 * @returns {number} Material balance
 */
function calculateMaterialBalance(gameState) {
  // This is a placeholder - real implementation would sum piece values
  return 0;
}

/**
 * Simplified position evaluation
 * @param {Object} gameState - Game state
 * @returns {number} Position evaluation score
 */
function evaluatePosition(gameState) {
  // This is a placeholder - real implementation would be complex
  return 0;
}

/**
 * Compares player's move to engine's suggested move
 * @param {Object} previousState - Game state before move
 * @param {Object} newState - Game state after move
 * @returns {number} Engine comparison score (-1 to 1 scale)
 */
function compareToEngineEvaluation(previousState, newState) {
  // This would require an actual chess engine integration
  // Placeholder returning a neutral evaluation
  return 0;
}

/**
 * Adapts scoring based on player's skill level
 * @param {Object} rawScores - Raw score components
 * @param {number} playerRating - Player's rating
 * @returns {Object} Adapted score components
 */
function adaptScoreToPlayerSkill(rawScores, playerRating) {
  const adaptedScores = {};

  // Define rating thresholds for different skill levels
  const BEGINNER = 1000;
  const INTERMEDIATE = 1500;
  const ADVANCED = 2000;

  // Multipliers for different skill levels
  let multipliers = {};

  if (playerRating < BEGINNER) {
    // For beginners: emphasize material, development, and checks
    multipliers = {
      material: 1.5,
      positional: 0.7,
      tactical: 1.2,
      kingThreat: 1.3,
      development: 1.5,
      timeBonus: 1.0,
      risk: 0.5,
    };
  } else if (playerRating < INTERMEDIATE) {
    // For intermediate: balanced approach
    multipliers = {
      material: 1.2,
      positional: 1.0,
      tactical: 1.2,
      kingThreat: 1.0,
      development: 1.2,
      timeBonus: 1.0,
      risk: 0.8,
    };
  } else if (playerRating < ADVANCED) {
    // For advanced: emphasis on positional and tactical
    multipliers = {
      material: 1.0,
      positional: 1.3,
      tactical: 1.3,
      kingThreat: 0.9,
      development: 1.0,
      timeBonus: 1.0,
      risk: 1.0,
    };
  } else {
    // For experts: high value on subtleties and risk-taking
    multipliers = {
      material: 0.9,
      positional: 1.5,
      tactical: 1.4,
      kingThreat: 0.8,
      development: 0.9,
      timeBonus: 1.0,
      risk: 1.2,
    };
  }

  // Apply multipliers to each score component
  Object.keys(rawScores).forEach((key) => {
    adaptedScores[key] = rawScores[key] * (multipliers[key] || 1.0);
  });

  return adaptedScores;
}

/**
 * Classifies a move based on score and engine evaluation
 * @param {number} score - Total move score
 * @param {number} engineDifference - Difference from engine evaluation
 * @param {number} playerRating - Player's rating
 * @returns {string} Move classification
 */
function classifyMove(score, engineDifference, playerRating) {
  // Classification thresholds vary by player rating
  const ratingFactor = Math.max(0.7, Math.min(1.3, playerRating / 1500));

  // Excellent moves need higher scores for stronger players
  const brilliantThreshold = 8 * ratingFactor;
  const excellentThreshold = 5 * ratingFactor;
  const goodThreshold = 3 * ratingFactor;
  const inaccuracyThreshold = 1 * ratingFactor;
  const mistakeThreshold = -1 * ratingFactor;
  const blunderThreshold = -4 * ratingFactor;

  if (score >= brilliantThreshold && engineDifference >= 0.8) {
    return "Brilliant";
  } else if (score >= excellentThreshold) {
    return "Excellent";
  } else if (score >= goodThreshold) {
    return "Good";
  } else if (score >= inaccuracyThreshold) {
    return "Inaccuracy";
  } else if (score >= mistakeThreshold) {
    return "Mistake";
  } else if (score >= blunderThreshold) {
    return "Error";
  } else {
    return "Blunder";
  }
}

// Export the main evaluation function
module.exports = {
  evaluatePlayerMove,
  PIECE_VALUES,
  determineGamePhase,
};
