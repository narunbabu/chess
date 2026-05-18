import {
  getModeAwareDefaultRatingWindow,
  getOpponentCenteredRatingWindow,
  getStoredOpponentRatingForMode,
  rememberOpponentRatingForMode,
  rememberRatingWindowForMode,
} from '../ratingWindow';

describe('ratingWindow opponent targets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('centers the online opponent filter around the selected opponent rating', () => {
    expect(getOpponentCenteredRatingWindow(1200)).toEqual({
      minRating: 1000,
      maxRating: 1400,
    });
  });

  test('clamps opponent-centered windows to supported Elo bounds', () => {
    expect(getOpponentCenteredRatingWindow(250)).toEqual({
      minRating: 200,
      maxRating: 450,
    });

    expect(getOpponentCenteredRatingWindow(3150)).toEqual({
      minRating: 2950,
      maxRating: 3200,
    });
  });

  test('stores opponent targets independently for each game mode', () => {
    rememberOpponentRatingForMode('rated', 1200);
    rememberOpponentRatingForMode('casual', 800);

    expect(getStoredOpponentRatingForMode('rated')).toBe(1200);
    expect(getModeAwareDefaultRatingWindow(1500, 'rated')).toEqual({
      minRating: 1000,
      maxRating: 1400,
    });

    expect(getStoredOpponentRatingForMode('casual')).toBe(800);
    expect(getModeAwareDefaultRatingWindow(1500, 'casual')).toEqual({
      minRating: 600,
      maxRating: 1000,
    });

    expect(getStoredOpponentRatingForMode('learning')).toBeNull();
    expect(getModeAwareDefaultRatingWindow(1500, 'learning')).toEqual({
      minRating: 1300,
      maxRating: 1850,
    });
  });

  test('manual Elo filters persist by midpoint for the active mode', () => {
    rememberRatingWindowForMode('rated', { minRating: 1000, maxRating: 1400 });

    expect(getStoredOpponentRatingForMode('rated')).toBe(1200);
    expect(getModeAwareDefaultRatingWindow(400, 'rated')).toEqual({
      minRating: 1000,
      maxRating: 1400,
    });
  });
});
