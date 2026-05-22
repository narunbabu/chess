import { getEffectiveDepthForRating } from '../computerMoveUtils';

describe('computer move strength helpers', () => {
  test('raises search depth when explicit opponent rating is stronger than stored level', () => {
    expect(getEffectiveDepthForRating(6, 2000)).toBe(9);
  });

  test('does not weaken an explicitly stronger computer level', () => {
    expect(getEffectiveDepthForRating(12, 1400)).toBe(12);
  });

  test('falls back to the provided level when rating is unavailable', () => {
    expect(getEffectiveDepthForRating(6, null)).toBe(6);
  });
});
