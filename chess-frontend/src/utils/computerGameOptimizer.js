/**
 * Computer Game Optimization System
 * Optimizes local chess engine performance, move calculation, and memory usage
 */

import { performanceMonitor } from './performanceMonitor';

export class ComputerGameOptimizer {
  constructor(config = {}) {
    this.config = {
      // Engine optimization
      enableTranspositionTable: true,
      enableOpeningBook: true,
      enableQuiescenceSearch: true,
      enableNullMovePruning: true,
      enableLateMoveReductions: true,

      // Performance tuning
      maxSearchDepth: 20,
      minSearchDepth: 1,
      timeBufferMs: 100, // Safety buffer for time calculations

      // Memory management
      transpositionTableSize: 64 * 1024 * 1024, // 64MB
      maxMoveCacheSize: 10000,

      // Evaluation optimization
      lazyEvaluation: true,
      deltaPruning: true,
      futilityPruning: true,

      ...config
    };

    // Transposition table for caching positions
    this.transpositionTable = new Map();
    this.moveCache = new Map();
    this.openingBook = new Map();

    // Performance metrics
    this.metrics = {
      positionsSearched: 0,
      cacheHits: 0,
      cacheMisses: 0,
      searchCutoffs: 0,
      averageDepth: 0,
      totalSearches: 0
    };

    this.isInitialized = false;
    this.initializeOptimizations();
  }

  /**
   * Initialize optimization systems
   */
  initializeOptimizations() {
    if (this.isInitialized) return;

    console.log('🧠 Initializing Computer Game Optimizer');

    // Initialize transposition table with size limit
    if (this.config.enableTranspositionTable) {
      this.transpositionTable = new Map();
      console.log('✅ Transposition table enabled');
    }

    // Initialize opening book
    if (this.config.enableOpeningBook) {
      this.initializeOpeningBook();
      console.log('✅ Opening book enabled');
    }

    this.isInitialized = true;
    performanceMonitor.takeMemorySnapshot('computer_optimizer_init');
  }

  /**
   * Initialize basic opening book
   */
  initializeOpeningBook() {
    // Common opening moves
    const openings = [
      'e4', 'd4', 'Nf3', 'c4', // White first moves
      'e5', 'c5', 'e6', 'c6',  // Black responses
      'Nf6', 'd6', 'g6', 'Nc6'  // More black responses
    ];

    openings.forEach(move => {
      this.openingBook.set(move, {
        frequency: 1.0,
        evaluation: 0
      });
    });
  }

  /**
   * Optimize search parameters based on position and time
   */
  getOptimalSearchParameters(fen, timeLeftMs, incrementMs = 0) {
    const timePerMove = this.calculateOptimalTimePerMove(timeLeftMs, incrementMs);
    const suggestedDepth = this.calculateOptimalDepth(timePerMove);

    return {
      maxDepth: Math.min(suggestedDepth, this.config.maxSearchDepth),
      timeLimit: timePerMove - this.config.timeBufferMs,
      enableAdvancedPruning: timePerMove < 5000, // Enable aggressive pruning for fast moves
      useOpeningBook: this.isInOpeningPhase(fen)
    };
  }

  /**
   * Calculate optimal time to spend on a move
   */
  calculateOptimalTimePerMove(timeLeftMs, incrementMs = 0) {
    // Base calculation: allocate time proportionally
    const baseTimePerMove = timeLeftMs / 40; // Assume 40 moves left average

    // Add increment consideration
    const incrementBonus = incrementMs * 0.8; // Use 80% of increment

    // Scale based on remaining time (use more time when winning, less when losing)
    const timeScaling = timeLeftMs < 30000 ? 1.2 : 1.0; // More urgent with little time

    const optimalTime = (baseTimePerMove + incrementBonus) * timeScaling;

    // Ensure minimum and maximum bounds
    return Math.max(100, Math.min(optimalTime, timeLeftMs / 10));
  }

  /**
   * Calculate optimal search depth based on time available
   */
  calculateOptimalDepth(timePerMove) {
    // Approximate time needed per depth level
    const timePerDepth = 50; // ms per ply

    const maxAffordableDepth = Math.floor(timePerMove / timePerDepth);

    // Ensure minimum depth and reasonable maximum
    return Math.max(this.config.minSearchDepth,
                   Math.min(maxAffordableDepth, this.config.maxSearchDepth));
  }

  /**
   * Check if we're still in opening phase
   */
  isInOpeningPhase(fen) {
    // Simple heuristic: opening phase = first 10 moves
    const parts = fen.split(' ');
    const moveCount = parseInt(parts[5] || '0');
    return moveCount < 20; // 10 full moves (20 plies)
  }

  /**
   * Get position from transposition table
   */
  getTranspositionEntry(fen) {
    if (!this.config.enableTranspositionTable) return null;

    const entry = this.transpositionTable.get(fen);
    if (entry) {
      this.metrics.cacheHits++;
      return entry;
    }

    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Store position in transposition table
   */
  storeTranspositionEntry(fen, depth, score, flag, move) {
    if (!this.config.enableTranspositionTable) return;

    // Manage table size
    if (this.transpositionTable.size >= this.config.transpositionTableSize / 100) { // Rough estimate
      const firstKey = this.transpositionTable.keys().next().value;
      this.transpositionTable.delete(firstKey);
    }

    this.transpositionTable.set(fen, {
      depth,
      score,
      flag, // 'exact', 'lowerbound', 'upperbound'
      move,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached move for position
   */
  getCachedMove(fen) {
    return this.moveCache.get(fen);
  }

  /**
   * Cache move for position
   */
  cacheMove(fen, move, evaluation) {
    // Manage cache size
    if (this.moveCache.size >= this.config.maxMoveCacheSize) {
      const firstKey = this.moveCache.keys().next().value;
      this.moveCache.delete(firstKey);
    }

    this.moveCache.set(fen, {
      move,
      evaluation,
      timestamp: Date.now()
    });
  }

  /**
   * Get opening book move
   */
  getOpeningBookMove(fen) {
    if (!this.config.enableOpeningBook) return null;

    const parts = fen.split(' ');
    const moveCount = parseInt(parts[5] || '0');

    if (moveCount >= 20) return null; // Past opening phase

    // Return a random book move based on position
    const bookMoves = Array.from(this.openingBook.keys());
    if (bookMoves.length > 0) {
      const randomMove = bookMoves[Math.floor(Math.random() * bookMoves.length)];
      return this.openingBook.get(randomMove);
    }

    return null;
  }

  /**
   * Optimize evaluation function
   */
  optimizeEvaluation(evaluation, depth, alpha, beta) {
    // Lazy evaluation - skip detailed evaluation if clearly outside alpha-beta window
    if (this.config.lazyEvaluation && depth <= 3) {
      const margin = 100 * depth;
      if (evaluation > beta + margin) return beta + margin;
      if (evaluation < alpha - margin) return alpha - margin;
    }

    return evaluation;
  }

  /**
   * Check if position should be pruned (futility pruning)
   */
  shouldPruneFutility(depth, evaluation, beta) {
    if (!this.config.futilityPruning) return false;

    const futilityMargin = 50 * depth; // Tolerance increases with depth
    return evaluation + futilityMargin < beta;
  }

  /**
   * Check if move should be reduced (late move reduction)
   */
  shouldReduceMove(moveIndex, depth, isInCheck, isCapture) {
    if (!this.config.enableLateMoveReductions) return false;

    // Don't reduce important moves
    if (isInCheck || isCapture || moveIndex < 4) return false;

    // Reduce later moves at higher depths
    return depth >= 3 && moveIndex > 4;
  }

  /**
   * Get search statistics
   */
  getSearchStats() {
    const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(1)
      : 0;

    return {
      positionsSearched: this.metrics.positionsSearched,
      cacheHitRate: cacheHitRate + '%',
      searchCutoffs: this.metrics.searchCutoffs,
      averageDepth: this.metrics.totalSearches > 0
        ? (this.metrics.averageDepth / this.metrics.totalSearches).toFixed(1)
        : 0,
      transpositionTableSize: this.transpositionTable.size,
      moveCacheSize: this.moveCache.size
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      positionsSearched: 0,
      cacheHits: 0,
      cacheMisses: 0,
      searchCutoffs: 0,
      averageDepth: 0,
      totalSearches: 0
    };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const stats = this.getSearchStats();
    const recommendations = [];

    if (parseFloat(stats.cacheHitRate) < 30) {
      recommendations.push('Consider increasing transposition table size for better cache hit rate');
    }

    if (stats.positionsSearched > 100000 && stats.searchCutoffs < stats.positionsSearched * 0.5) {
      recommendations.push('Enable more aggressive pruning to reduce search tree');
    }

    if (parseFloat(stats.averageDepth) < 8) {
      recommendations.push('Consider increasing search depth for stronger play');
    }

    return recommendations;
  }

  /**
   * Cleanup old cache entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Clean transposition table
    for (const [key, entry] of this.transpositionTable.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.transpositionTable.delete(key);
      }
    }

    // Clean move cache
    for (const [key, entry] of this.moveCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.moveCache.delete(key);
      }
    }

    performanceMonitor.takeMemorySnapshot('computer_optimizer_cleanup');
  }
}

// Singleton instance
export const computerGameOptimizer = new ComputerGameOptimizer();

// Auto-cleanup every 5 minutes
setInterval(() => {
  computerGameOptimizer.cleanup();
}, 5 * 60 * 1000);