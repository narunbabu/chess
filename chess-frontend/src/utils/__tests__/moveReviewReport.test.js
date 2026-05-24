import {
  buildMoveReviewRecord,
  createMoveReviewReport,
  getDefaultReviewEnabled,
  shouldShowBestUseNudge,
  summarizeMoveReviewReport,
} from '../moveReviewReport';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveReviewReport', () => {
  test('detects the played move rank from ranked engine moves', () => {
    const record = buildMoveReviewRecord({
      fenBefore: START_FEN,
      userMove: { from: 'e2', to: 'e4', san: 'e4' },
      topMoves: [
        { move: 'd2d4', cp: 34 },
        { move: 'e2e4', cp: 29 },
        { move: 'g1f3', cp: 22 },
      ],
      ply: 1,
      moveNumber: 1,
      color: 'w',
    });

    expect(record.userMoveRank).toBe(2);
    expect(record.isOutsideTopMoves).toBe(false);
    expect(record.topMoves[1]).toMatchObject({ rank: 2, san: 'e4', move: 'e2e4' });
  });

  test('marks a played move outside the requested top moves', () => {
    const record = buildMoveReviewRecord({
      fenBefore: START_FEN,
      userMove: 'b1c3',
      topMoves: [
        { move: 'd2d4', cp: 34 },
        { move: 'e2e4', cp: 29 },
      ],
      ply: 1,
      moveNumber: 1,
      color: 'w',
      topMoveLimit: 2,
    });

    expect(record.userMoveRank).toBeNull();
    expect(record.isOutsideTopMoves).toBe(true);
  });

  test('summarizes rank and assistance usage', () => {
    const moves = [
      buildMoveReviewRecord({
        fenBefore: START_FEN,
        userMove: 'd2d4',
        topMoves: [{ move: 'd2d4', cp: 34 }],
        ply: 1,
      }),
      buildMoveReviewRecord({
        fenBefore: START_FEN,
        userMove: 'e2e4',
        topMoves: [
          { move: 'd2d4', cp: 34 },
          { move: 'e2e4', cp: 29 },
        ],
        ply: 2,
      }),
      buildMoveReviewRecord({
        fenBefore: START_FEN,
        userMove: 'g1f3',
        topMoves: [
          { move: 'd2d4', cp: 34 },
          { move: 'e2e4', cp: 29 },
          { move: 'g1f3', cp: 22 },
        ],
        ply: 3,
      }),
      buildMoveReviewRecord({
        fenBefore: START_FEN,
        userMove: 'b1c3',
        topMoves: [{ move: 'd2d4', cp: 34 }],
        ply: 4,
      }),
    ];

    expect(summarizeMoveReviewReport({
      moves,
      bestButtonUses: 3,
      undoButtonUses: 2,
      reviewEnabledUsed: true,
    })).toMatchObject({
      analyzed_moves: 4,
      best_move_count: 1,
      top_1_count: 1,
      top_2_count: 1,
      top_3_count: 1,
      average_rank: 2,
      ranked_moves_count: 3,
      rank_sum: 6,
      outside_top_moves_count: 1,
      outside_top_5_count: 1,
      coins_earned: 6,
      best_button_uses: 3,
      undo_button_uses: 2,
      review_enabled_used: true,
    });
  });

  test('excludes Best-assisted moves from achievement counters', () => {
    const ownMove = buildMoveReviewRecord({
      fenBefore: START_FEN,
      userMove: 'd2d4',
      topMoves: [{ move: 'd2d4', cp: 34 }],
      ply: 1,
      source: 'review',
    });
    const bestAssistedTop1 = buildMoveReviewRecord({
      fenBefore: START_FEN,
      userMove: 'd2d4',
      topMoves: [{ move: 'd2d4', cp: 34 }],
      ply: 2,
      source: 'best',
    });

    const summary = summarizeMoveReviewReport({
      moves: [ownMove, bestAssistedTop1],
      bestButtonUses: 1,
    });

    expect(summary.analyzed_moves).toBe(1);
    expect(summary.ranked_moves_count).toBe(1);
    expect(summary.top_1_count).toBe(1);
    expect(summary.coins_earned).toBe(3);
    expect(summary.best_button_uses).toBe(1);
    expect(summary.undo_button_uses).toBe(0);
  });

  test('defaults review on for non-rated modes only', () => {
    expect(getDefaultReviewEnabled('casual')).toBe(true);
    expect(getDefaultReviewEnabled('learning')).toBe(true);
    expect(getDefaultReviewEnabled(undefined)).toBe(true);
    expect(getDefaultReviewEnabled('rated')).toBe(false);
  });

  test('shows the casual Best-use nudge after the fifth use', () => {
    expect(shouldShowBestUseNudge(5)).toBe(false);
    expect(shouldShowBestUseNudge(6)).toBe(true);
  });

  test('creates the persisted report shape with summary', () => {
    const moves = [
      buildMoveReviewRecord({
        fenBefore: START_FEN,
        userMove: 'd2d4',
        topMoves: [{ move: 'd2d4', cp: 34 }],
        ply: 1,
      }),
    ];

    const report = createMoveReviewReport({
      moves,
      bestButtonUses: 1,
      undoButtonUses: 1,
      reviewEnabledUsed: true,
      gameMode: 'computer',
    });

    expect(report).toMatchObject({
      version: 1,
      gameMode: 'computer',
      bestButtonUses: 1,
      undoButtonUses: 1,
      reviewEnabledUsed: true,
      summary: {
        analyzed_moves: 1,
        best_button_uses: 1,
        undo_button_uses: 1,
      },
    });
  });
});
