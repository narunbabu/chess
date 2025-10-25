// src/utils/evaluationOptimizer.js

/**
 * Evaluation optimization system for computer chess games
 * Implements evaluation aggregation, compression, and intelligent storage
 */

// Configuration constants
const DEFAULT_CONFIG = {
  // Store every Nth evaluation (1 = store all, 5 = store every 5th)
  evaluationSampleRate: 3,

  // When to force store critical evaluations (check, capture, promotion, castling)
  criticalMoveTypes: ['c', 'k', 'p', 'b', 'q'], // capture, king move, promotion, castling

  // Batch size for evaluation processing
  batchSize: 10,

  // Maximum evaluations to store per game
  maxEvaluationsPerGame: 50,

  // Precision for storing evaluation values
  evaluationPrecision: 2
};

/**
 * Evaluation aggregator for computer mode games
 * Reduces evaluation storage while preserving critical insights
 */
export class EvaluationOptimizer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evaluationBuffer = [];
    this.moveCount = 0;
    this.criticalEvaluations = [];
    this.lastStoredEval = null;
  }

  /**
   * Process an evaluation and determine if it should be stored
   * @param {Object} evaluation - The evaluation object from evaluateMove
   * @param {Object} moveData - Move information (san, flags, etc.)
   * @returns {Object|null} Processed evaluation or null if should be skipped
   */
  processEvaluation(evaluation, moveData) {
    this.moveCount++;

    // Always store critical moves regardless of sample rate
    if (this.isCriticalMove(moveData)) {
      console.log(`🎯 Critical move detected: ${moveData.san}`);
      return this.createStoredEvaluation(evaluation, moveData, true);
    }

    // Sample rate for non-critical moves
    if (this.moveCount % this.config.evaluationSampleRate !== 0) {
      return null;
    }

    // Avoid storing duplicate evaluations (e.g., consecutive identical positions)
    if (this.lastStoredEval && this.isSimilarEvaluation(evaluation, this.lastStoredEval)) {
      return null;
    }

    const storedEval = this.createStoredEvaluation(evaluation, moveData, false);
    this.lastStoredEval = storedEval;
    return storedEval;
  }

  /**
   * Determine if a move is critical and should always be evaluated
   * @param {Object} moveData - Move information
   * @returns {boolean} Whether the move is critical
   */
  isCriticalMove(moveData) {
    if (!moveData || !moveData.flags) return false;

    const flags = moveData.flags;

    // Check for critical move types
    for (const criticalFlag of this.config.criticalMoveTypes) {
      if (flags.includes(criticalFlag)) {
        return true;
      }
    }

    // Also critical if evaluation shows significant change
    if (this.lastStoredEval && moveData.evaluation && this.isSignificantChange(moveData.evaluation, this.lastStoredEval)) {
      return true;
    }

    return false;
  }

  /**
   * Check if two evaluations are similar enough to skip one
   * @param {Object} eval1 - First evaluation
   * @param {Object} eval2 - Second evaluation
   * @returns {boolean} Whether evaluations are similar
   */
  isSimilarEvaluation(eval1, eval2) {
    if (!eval1 || !eval2) return false;

    const eval1Score = eval1.total || 0;
    const eval2Score = eval2.total || 0;

    // Consider similar if within 0.1 points
    return Math.abs(eval1Score - eval2Score) < 0.1;
  }

  /**
   * Check if evaluation shows significant change from previous
   * @param {Object} eval1 - Current evaluation
   * @param {Object} eval2 - Previous evaluation
   * @returns {boolean} Whether change is significant
   */
  isSignificantChange(eval1, eval2) {
    if (!eval1 || !eval2) return false;

    const eval1Score = eval1.total || 0;
    const eval2Score = eval2.total || 0;

    // Significant if change is more than 0.5 points
    return Math.abs(eval1Score - eval2Score) > 0.5;
  }

  /**
   * Create a stored evaluation with optimized format
   * @param {Object} evaluation - Full evaluation object
   * @param {Object} moveData - Move information
   * @param {boolean} isCritical - Whether this is a critical move
   * @returns {Object} Optimized evaluation object
   */
  createStoredEvaluation(evaluation, moveData, isCritical) {
    return {
      // Core evaluation data (rounded for storage efficiency)
      total: parseFloat((evaluation.total || 0).toFixed(this.config.evaluationPrecision)),

      // Store only essential breakdown fields
      material: evaluation.material ? parseFloat(evaluation.material.toFixed(this.config.evaluationPrecision)) : 0,
      position: evaluation.position ? parseFloat(evaluation.position.toFixed(this.config.evaluationPrecision)) : 0,

      // Metadata
      isCritical,
      moveNumber: this.moveCount,
      timestamp: Date.now(),

      // Store move context for reconstruction
      moveSan: moveData.san,
      moveFlags: moveData.flags
    };
  }

  /**
   * Get evaluation statistics for optimization metrics
   * @returns {Object} Statistics about evaluation optimization
   */
  getOptimizationStats() {
    return {
      totalMoves: this.moveCount,
      storedEvaluations: this.evaluationBuffer.length + this.criticalEvaluations.length,
      criticalEvaluations: this.criticalEvaluations.length,
      sampleRate: this.config.evaluationSampleRate,
      storageRatio: this.moveCount > 0 ?
        ((this.evaluationBuffer.length + this.criticalEvaluations.length) / this.moveCount).toFixed(2) : 0
    };
  }

  /**
   * Reset the optimizer for a new game
   */
  reset() {
    this.evaluationBuffer = [];
    this.moveCount = 0;
    this.criticalEvaluations = [];
    this.lastStoredEval = null;
  }

  /**
   * Compress stored evaluations for network transmission
   * @param {Array} evaluations - Array of stored evaluations
   * @returns {string} Compressed evaluation string
   */
  static compressEvaluations(evaluations) {
    if (!evaluations || evaluations.length === 0) return '';

    // Format: moveNumber:total:material:position;moveNumber:total:material:position;...
    return evaluations.map(evaluation =>
      `${evaluation.moveNumber}:${evaluation.total}:${evaluation.material || 0}:${evaluation.position || 0}`
    ).join(';');
  }

  /**
   * Decompress evaluation string back to array
   * @param {string} compressedEval - Compressed evaluation string
   * @returns {Array} Decompressed evaluations
   */
  static decompressEvaluations(compressedEval) {
    if (!compressedEval || compressedEval === '') return [];

    const evaluations = [];
    const parts = compressedEval.split(';');

    parts.forEach(part => {
      const segments = part.split(':');
      if (segments.length >= 4) {
        evaluations.push({
          moveNumber: parseInt(segments[0]),
          total: parseFloat(segments[1]),
          material: parseFloat(segments[2]),
          position: parseFloat(segments[3])
        });
      }
    });

    return evaluations;
  }

  /**
   * Estimate storage savings from evaluation optimization
   * @param {Array} fullEvaluations - Full evaluation array
   * @param {Array} optimizedEvaluations - Optimized evaluation array
   * @returns {Object} Savings statistics
   */
  static estimateSavings(fullEvaluations, optimizedEvaluations) {
    const fullSize = new Blob([JSON.stringify(fullEvaluations)]).size;
    const optimizedSize = new Blob([JSON.stringify(optimizedEvaluations)]).size;
    const compressedSize = new Blob([this.compressEvaluations(optimizedEvaluations)]).size;

    return {
      originalSize: fullSize,
      optimizedSize: optimizedSize,
      compressedSize: compressedSize,
      savings: fullSize - compressedSize,
      savingsPercentage: ((fullSize - compressedSize) / fullSize * 100).toFixed(1),
      compressionRatio: (fullSize / compressedSize).toFixed(2),
      evalCountReduced: fullEvaluations.length - optimizedEvaluations.length,
      evalCountReducedPercentage: ((fullEvaluations.length - optimizedEvaluations.length) / fullEvaluations.length * 100).toFixed(1)
    };
  }
}

/**
 * Create a game optimizer with computer-mode specific settings
 * @param {Object} config - Configuration overrides
 * @returns {EvaluationOptimizer} Configured optimizer
 */
export function createComputerGameOptimizer(config = {}) {
  return new EvaluationOptimizer({
    ...config,
    evaluationSampleRate: 2, // Store every 2nd evaluation for computer games
    criticalMoveTypes: ['c', 'k', 'p'], // Focus on captures, checks, promotions
    maxEvaluationsPerGame: 30 // Conservative limit for computer games
  });
}

/**
 * Create a game optimizer with multiplayer-specific settings
 * @param {Object} config - Configuration overrides
 * @returns {EvaluationOptimizer} Configured optimizer
 */
export function createMultiplayerGameOptimizer(config = {}) {
  return new EvaluationOptimizer({
    ...config,
    evaluationSampleRate: 1, // Store all evaluations for multiplayer (competitive)
    criticalMoveTypes: ['c', 'k', 'p', 'b', 'q'], // All critical move types
    maxEvaluationsPerGame: 100 // Higher limit for multiplayer games
  });
}