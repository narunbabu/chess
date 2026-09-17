/**
 * Tests for the multiplayer Best-move budget accounting
 * (src/utils/multiplayerBestBudget.js).
 *
 * The casual/learning multiplayer Best toggle shares the takeback pool
 * (`undoChancesRemaining`), and each Best spend is persisted as a
 * `best-move` marker in the move's `learning_help` array. These tests cover
 * the spend counting from every persisted shape and the reload seeding.
 */

import {
  BEST_MOVE_MARKER,
  budgetedUndoChances,
  countBestMoveSpend,
} from '../multiplayerBestBudget';

describe('multiplayerBestBudget', () => {
  describe('countBestMoveSpend', () => {
    it('counts only my moves that carry a best-move marker', () => {
      const moves = [
        { san: 'e4', color: 'w', learning_help: ['best-move'] },
        { san: 'e5', color: 'b', learning_help: ['best-move'] },
        { san: 'Nf3', color: 'w', learning_help: ['review'] },
        { san: 'Nc6', color: 'b', learning_help: [] },
      ];

      expect(countBestMoveSpend(moves, 'w')).toBe(1);
      expect(countBestMoveSpend(moves, 'b')).toBe(1);
    });

    it('parses the compact string token shape', () => {
      const moves = [
        { san: 'e4', color: 'w', learning_help: 'review+best-move' },
        { san: 'e5', color: 'b', learning_help: 'best-move' },
      ];

      expect(countBestMoveSpend(moves, 'w')).toBe(1);
    });

    it('parses object markers and camelCase history entries', () => {
      const moves = [
        { san: 'e4', color: 'w', learningHelp: [{ type: 'best-move' }] },
        { san: 'e5', color: 'b', lifelines: [{ type: 'best-move' }, { type: 'review' }] },
      ];

      expect(countBestMoveSpend(moves, 'w')).toBe(1);
      expect(countBestMoveSpend(moves, 'b')).toBe(1);
    });

    it('falls back to counting every side when no colour is given', () => {
      const moves = [
        { san: 'e4', color: 'w', learning_help: ['best-move'] },
        { san: 'e5', color: 'b', learning_help: ['best-move'] },
        { san: 'Nf3', color: 'w' },
      ];

      expect(countBestMoveSpend(moves, null)).toBe(2);
    });

    it('is zero for empty, missing or marker-free histories', () => {
      expect(countBestMoveSpend([], 'w')).toBe(0);
      expect(countBestMoveSpend(null, 'w')).toBe(0);
      expect(countBestMoveSpend(undefined, 'b')).toBe(0);
      expect(countBestMoveSpend([{ san: 'e4', color: 'w' }], 'w')).toBe(0);
      expect(countBestMoveSpend([{ san: 'e4', color: 'w', learning_help: ['review'] }], 'w')).toBe(0);
    });

    it('skips broken entries without throwing', () => {
      const moves = [
        null,
        undefined,
        { san: 'e4', color: 'w', learning_help: ['best-move'] },
      ];

      expect(countBestMoveSpend(moves, 'w')).toBe(1);
    });

    it('exposes the shared marker name', () => {
      expect(BEST_MOVE_MARKER).toBe('best-move');
    });
  });

  describe('budgetedUndoChances', () => {
    it('subtracts the persisted Best spend from the server count', () => {
      const moves = [
        { san: 'e4', color: 'w', learning_help: ['best-move'] },
        { san: 'e5', color: 'b', learning_help: ['review'] },
        { san: 'Nf3', color: 'w', learning_help: ['best-move'] },
      ];

      expect(budgetedUndoChances({
        rated: false,
        serverRemaining: 9,
        fallback: 9,
        moves,
        myColor: 'w',
      })).toBe(7);
    });

    it('uses the fallback when the server predates the undo columns', () => {
      const moves = [{ san: 'e4', color: 'w', learning_help: ['best-move'] }];

      expect(budgetedUndoChances({
        rated: false,
        serverRemaining: null,
        fallback: 9,
        moves,
        myColor: 'w',
      })).toBe(8);
    });

    it('never drops below zero when the spend exceeds the server count', () => {
      const moves = Array.from({ length: 5 }, () => (
        { san: 'e4', color: 'w', learning_help: ['best-move'] }
      ));

      expect(budgetedUndoChances({
        rated: false,
        serverRemaining: 2,
        fallback: 9,
        moves,
        myColor: 'w',
      })).toBe(0);
    });

    it('gives rated games no pool at all', () => {
      const moves = [{ san: 'e4', color: 'w', learning_help: ['best-move'] }];

      expect(budgetedUndoChances({
        rated: true,
        serverRemaining: 9,
        fallback: 9,
        moves,
        myColor: 'w',
      })).toBe(0);
    });

    it('clamps a negative server count to zero', () => {
      expect(budgetedUndoChances({
        rated: false,
        serverRemaining: -3,
        fallback: 9,
        moves: [],
        myColor: 'w',
      })).toBe(0);
    });
  });
});
