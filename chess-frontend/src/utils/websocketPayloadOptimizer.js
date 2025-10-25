// src/utils/websocketPayloadOptimizer.js

/**
 * WebSocket payload optimization system
 * Implements binary encoding, compression, and intelligent field reduction
 */

// Move flag constants for efficient encoding
const MOVE_FLAGS = {
  CAPTURE: 1,      // c
  PAWN_PUSH: 2,    // b (double pawn push)
  EN_PASSANT: 4,    // e
  PROMOTION: 8,     // = (promotion)
  KSIDE_CASTLE: 16, // k (kingside castle)
  QSIDE_CASTLE: 32, // q (queenside castle)
  CHECK: 64,        // check flag
  CHECKMATE: 128     // checkmate flag
};

/**
 * Optimizes move payloads for WebSocket transmission
 */
export class WebSocketPayloadOptimizer {
  constructor(config = {}) {
    this.config = {
      enableCompression: true,
      enableBinaryEncoding: true,
      enableAdvancedFields: false, // Disabled until backend supports optimized fields
      enableFENOptimization: true, // Remove redundant FEN fields
      precision: 2,
      ...config
    };
  }

  /**
   * Encode move data into optimized binary format
   * @param {Object} moveData - Standard move data object
   * @returns {Object} Optimized payload
   */
  encodeMove(moveData) {
    // Safety check for move data
    if (!moveData || typeof moveData !== 'object') {
      throw new Error('Invalid move data: must be an object');
    }

    // Check required fields
    if (!moveData.from || !moveData.to) {
      throw new Error('Invalid move data: missing required from/to fields');
    }

    if (!this.config.enableBinaryEncoding) {
      return this.encodeCompact(moveData);
    }

    try {
      // Ensure we have a valid SAN for logging
      const san = moveData.san || moveData.from + moveData.to;

      // Start with all original fields to ensure backend compatibility
      let compressedData = {
        // Copy all original fields
        ...moveData,

        // Ensure required fields have proper defaults
        san: san,
        uci: moveData.uci || (moveData.from + moveData.to + (moveData.promotion || '')),
      };

      // Apply FEN optimization if enabled - REMOVE FEN fields completely
      if (this.config.enableFENOptimization && (compressedData.prev_fen || compressedData.next_fen)) {
        const originalSize = JSON.stringify(compressedData).length;

        // Store original FENs for logging before removing them
        const originalPrevFEN = compressedData.prev_fen;
        const originalNextFEN = compressedData.next_fen;

        // Remove prev_fen (redundant) but keep next_fen (needed for server update)
        delete compressedData.prev_fen;
        // Keep next_fen - server needs it to update database FEN

        const optimizedSize = JSON.stringify(compressedData).length;
        const savings = originalSize - optimizedSize;

        console.log(`🗑️  FEN Optimization: Removed prev_fen, kept next_fen for server update`);
        console.log(`  Size reduction: ${originalSize} → ${optimizedSize} bytes (${((savings/originalSize)*100).toFixed(1)}% reduction)`);
        console.log(`  Removed prev_fen: ${originalPrevFEN?.substring(0, 30)}... (${originalPrevFEN?.length} chars)`);
        console.log(`  Kept next_fen: ${originalNextFEN?.substring(0, 30)}... (${originalNextFEN?.length} chars)`);
        console.log(`  💡 Server uses next_fen to update database position`);
      }

      // Future optimization fields (commented out until backend supports them)
      // ...(this.config.enableAdvancedFields && {
      //   move: binaryMove,
      //   flag_bits: flags,
      //   mt: Math.round((moveData.move_time_ms || 0) / 10),
      //   wm: Math.round((moveData.white_player_score || 0) * 100),
      //   bm: Math.round((moveData.black_player_score || 0) * 100),
      //   f: moveData.prev_fen ? this.compressFen(moveData.prev_fen) : null
      // })

      console.log(`🔧 Move optimized: ${san} (size: ${JSON.stringify(compressedData).length} bytes)`);
      return compressedData;
    } catch (error) {
      console.error('❌ Error in encodeMove:', error);
      console.error('Move data that caused error:', moveData);
      throw new Error(`Move encoding failed: ${error.message}`);
    }
  }

  /**
   * Encode move into compact binary string
   * @param {Object} moveData - Move data
   * @returns {string} Binary move representation
   */
  encodeMoveBinary(moveData) {
    // Use UCI format: from + to + promotion (4-5 chars)
    // e.g., e2e4, e7e8q for promotion
    const uci = moveData.uci || moveData.from + moveData.to + (moveData.promotion || '');
    return uci;
  }

  /**
   * Encode move flags into single byte
   * @param {Object} moveData - Move data
   * @returns {number} Flag bitmask
   */
  encodeMoveFlags(moveData) {
    let flags = 0;
    const moveFlags = moveData.flags || '';

    if (moveFlags.includes('c')) flags |= MOVE_FLAGS.CAPTURE;
    if (moveFlags.includes('b')) flags |= MOVE_FLAGS.PAWN_PUSH;
    if (moveFlags.includes('e')) flags |= MOVE_FLAGS.EN_PASSANT;
    if (moveFlags.includes('n') || moveData.promotion) flags |= MOVE_FLAGS.PROMOTION;
    if (moveFlags.includes('k')) flags |= MOVE_FLAGS.KSIDE_CASTLE;
    if (moveFlags.includes('q')) flags |= MOVE_FLAGS.QSIDE_CASTLE;
    if (moveData.is_check) flags |= MOVE_FLAGS.CHECK;
    if (moveData.is_mate_hint) flags |= MOVE_FLAGS.CHECKMATE;

    return flags;
  }

  /**
   * Encode move in compact JSON format (fallback)
   * @param {Object} moveData - Move data
   * @returns {Object} Compact move data
   */
  encodeCompact(moveData) {
    return {
      // Backend required fields - keep these for compatibility
      from: moveData.from,
      to: moveData.to,
      san: moveData.san,
      uci: moveData.uci || `${moveData.from}${moveData.to}${moveData.promotion || ''}`,
      promotion: moveData.promotion,
      piece: moveData.piece,
      color: moveData.color,
      captured: moveData.captured,
      flags: moveData.flags,
      prev_fen: moveData.prev_fen,

      // Optimized timing and scoring (rounded for efficiency)
      t: Math.round((moveData.move_time_ms || 0) / 100) * 100, // Round to 100ms
      ws: Math.round((moveData.white_player_score || 0) * 10) / 10, // Round to 0.1 points
      bs: Math.round((moveData.black_player_score || 0) * 10) / 10, // Round to 0.1 points

      // Essential flags (compressed to boolean)
      c: !!(moveData.flags && moveData.flags.includes('c')),
      k: !!(moveData.flags && (moveData.flags.includes('k') || moveData.flags.includes('q'))),
      x: moveData.is_check || false,
      m: moveData.is_mate_hint || false
    };
  }

  /**
   * Compress FEN string (basic compression)
   * @param {string} fen - FEN string
   * @returns {string} Compressed FEN
   */
  compressFen(fen) {
    // Basic FEN compression - replace common patterns with single chars
    return fen
      .replace(/8/g, 'h') // 8 empty squares
      .replace(/7/g, 'g') // 7 empty squares
      .replace(/6/g, 'f') // 6 empty squares
      .replace(/5/g, 'e') // 5 empty squares
      .replace(/4/g, 'd') // 4 empty squares
      .replace(/3/g, 'c') // 3 empty squares
      .replace(/2/g, 'b') // 2 empty squares
      .replace(/1/g, 'a'); // 1 empty square
  }

  /**
   * Decompress FEN string
   * @param {string} compressedFen - Compressed FEN
   * @returns {string} Original FEN
   */
  decompressFen(compressedFen) {
    return compressedFen
      .replace(/h/g, '8')
      .replace(/g/g, '7')
      .replace(/f/g, '6')
      .replace(/e/g, '5')
      .replace(/d/g, '4')
      .replace(/c/g, '3')
      .replace(/b/g, '2')
      .replace(/a/g, '1');
  }

  /**
   * Decode optimized move back to full format
   * @param {Object} optimizedData - Optimized move data
   * @returns {Object} Full move data
   */
  decodeMove(optimizedData) {
    if (optimizedData.move && optimizedData.flags !== undefined) {
      // Binary format
      return this.decodeBinaryMove(optimizedData);
    } else {
      // Compact format
      return this.decodeCompactMove(optimizedData);
    }
  }

  /**
   * Decode binary move format
   * @param {Object} data - Binary move data
   * @returns {Object} Full move data
   */
  decodeBinaryMove(data) {
    const uci = data.move;
    const flags = data.flags;

    // Decode move from UCI
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : null;

    // Decode flags
    const moveFlags = [];
    if (flags & MOVE_FLAGS.CAPTURE) moveFlags.push('c');
    if (flags & MOVE_FLAGS.PAWN_PUSH) moveFlags.push('b');
    if (flags & MOVE_FLAGS.EN_PASSANT) moveFlags.push('e');
    if (flags & MOVE_FLAGS.PROMOTION) moveFlags.push('n');
    if (flags & MOVE_FLAGS.KSIDE_CASTLE) moveFlags.push('k');
    if (flags & MOVE_FLAGS.QSIDE_CASTLE) moveFlags.push('q');

    return {
      from,
      to,
      promotion,
      uci,
      flags: moveFlags.join('') || null,
      move_time_ms: data.mt * 10,
      white_player_score: data.wm / 100,
      black_player_score: data.bm / 100,
      is_check: !!(flags & MOVE_FLAGS.CHECK),
      is_mate_hint: !!(flags & MOVE_FLAGS.CHECKMATE)
    };
  }

  /**
   * Decode compact move format
   * @param {Object} data - Compact move data
   * @returns {Object} Full move data
   */
  decodeCompactMove(data) {
    const uci = data.m;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : null;

    const moveFlags = [];
    if (data.c) moveFlags.push('c');
    if (data.k) moveFlags.push('k'); // Note: can't distinguish k vs q castling

    return {
      from,
      to,
      promotion,
      uci,
      san: data.s,
      flags: moveFlags.join('') || null,
      move_time_ms: data.t || 0,
      white_player_score: data.ws || 0,
      black_player_score: data.bs || 0,
      is_check: data.x || false,
      is_mate_hint: data.m || false
    };
  }

  /**
   * Estimate payload size reduction
   * @param {Object} originalPayload - Original move data
   * @param {Object} optimizedPayload - Optimized move data
   * @returns {Object} Size comparison statistics
   */
  estimateSavings(originalPayload, optimizedPayload) {
    const originalSize = new Blob([JSON.stringify(originalPayload)]).size;
    const optimizedSize = new Blob([JSON.stringify(optimizedPayload)]).size;

    return {
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      savingsPercentage: ((originalSize - optimizedSize) / originalSize * 100).toFixed(1),
      compressionRatio: (originalSize / optimizedSize).toFixed(2)
    };
  }

  // FEN compression methods removed - we now eliminate FEN fields entirely
  // FEN strings can be reconstructed from move history on the server side
}

// Global optimizer instance
const globalOptimizer = new WebSocketPayloadOptimizer();

/**
 * Optimize a move payload for WebSocket transmission
 * @param {Object} moveData - Move data to optimize
 * @param {Object} options - Optimization options
 * @returns {Object} Optimized move data
 */
export function optimizeMovePayload(moveData, options = {}) {
  if (options.enabled === false) {
    return moveData; // No optimization if explicitly disabled
  }

  // Safety checks for move data
  if (!moveData || typeof moveData !== 'object') {
    console.warn('❌ Invalid move data provided to optimizer:', moveData);
    return moveData;
  }

  // Required fields for optimization
  const requiredFields = ['from', 'to'];
  const missingFields = requiredFields.filter(field => !moveData[field]);
  if (missingFields.length > 0) {
    console.warn(`❌ Missing required fields for optimization: ${missingFields.join(', ')}`, moveData);
    return moveData;
  }

  try {
    const result = globalOptimizer.encodeMove(moveData);
    console.log('✅ Move payload optimization successful');
    return result;
  } catch (error) {
    console.error('❌ Move payload optimization failed:', error);
    console.error('Move data that caused failure:', moveData);
    return moveData; // Return original data on failure
  }
}

/**
 * Decode optimized move payload back to full format
 * @param {Object} optimizedData - Optimized move data
 * @returns {Object} Full move data
 */
export function decodeMovePayload(optimizedData) {
  return globalOptimizer.decodeMove(optimizedData);
}

/**
 * Get payload optimization statistics
 * @param {Object} originalPayload - Original payload
 * @param {Object} optimizedPayload - Optimized payload
 * @returns {Object} Optimization statistics
 */
export function getPayloadOptimizationStats(originalPayload, optimizedPayload) {
  return globalOptimizer.estimateSavings(originalPayload, optimizedPayload);
}