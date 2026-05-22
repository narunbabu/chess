import { computePuzzleScore } from './tacticalStages';

describe('computePuzzleScore', () => {
  test('scores positions with no available CCTs as complete', () => {
    const score = computePuzzleScore({
      wrongCount: 0,
      cctUnavailable: true,
    });

    expect(score.cctAttempted).toBe(true);
    expect(score.cctUnavailable).toBe(true);
    expect(score.cctScore).toBe(100);
    expect(score.cctQuality).toBe(1);
    expect(score.combined).toBe(100);
  });

  test('keeps missing CCT metadata pending when CCTs were not marked unavailable', () => {
    const score = computePuzzleScore({
      wrongCount: 0,
    });

    expect(score.cctAttempted).toBe(false);
    expect(score.cctUnavailable).toBe(false);
    expect(score.cctScore).toBeNull();
    expect(score.combined).toBeNull();
  });
});
