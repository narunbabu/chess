import {
  forgetRatingWindow,
  getModeAwareDefaultRatingWindow,
  getOpponentCenteredRatingWindow,
  getStoredOpponentRatingForMode,
  getStoredRatingWindow,
  hasStoredRatingWindow,
  rememberOpponentRatingForMode,
  rememberRatingWindow,
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
});

describe('ratingWindow manual Elo filter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('keeps the exact range the player picked, width included', () => {
    rememberRatingWindow({ minRating: 800, maxRating: 2400 });

    expect(getStoredRatingWindow()).toEqual({ minRating: 800, maxRating: 2400 });
    expect(getModeAwareDefaultRatingWindow(400, 'casual')).toEqual({
      minRating: 800,
      maxRating: 2400,
    });
  });

  test('accepts the string values the number inputs produce', () => {
    rememberRatingWindow({ minRating: '1600', maxRating: '2000' });

    expect(getStoredRatingWindow()).toEqual({ minRating: 1600, maxRating: 2000 });
  });

  test('playing a game does not move the range the player picked', () => {
    rememberRatingWindow({ minRating: 1600, maxRating: 2000 });

    // Finishing a game records the opponent's rating, but must leave the
    // player's own filter alone — in every mode, since playing rewrites the
    // preferred game mode too.
    expect(rememberOpponentRatingForMode('casual', 700)).toEqual({
      minRating: 1600,
      maxRating: 2000,
    });
    expect(rememberOpponentRatingForMode('rated', 2900)).toEqual({
      minRating: 1600,
      maxRating: 2000,
    });

    expect(getModeAwareDefaultRatingWindow(400, 'casual')).toEqual({
      minRating: 1600,
      maxRating: 2000,
    });
    expect(getModeAwareDefaultRatingWindow(400, 'rated')).toEqual({
      minRating: 1600,
      maxRating: 2000,
    });
  });

  test('points matchmaking at the middle of the chosen range', () => {
    rememberRatingWindow({ minRating: 1000, maxRating: 1400 });
    rememberOpponentRatingForMode('rated', 700);

    expect(getStoredOpponentRatingForMode('rated')).toBe(1200);
  });

  test('ignores a half-typed range instead of overwriting the stored one', () => {
    rememberRatingWindow({ minRating: 1600, maxRating: 2000 });

    expect(rememberRatingWindow({ minRating: '', maxRating: 2000 })).toBeNull();
    expect(getStoredRatingWindow()).toEqual({ minRating: 1600, maxRating: 2000 });
  });

  test('resetting restores the rating-based default and forgets opponents', () => {
    rememberRatingWindow({ minRating: 1600, maxRating: 2000 });
    rememberOpponentRatingForMode('casual', 700);
    expect(hasStoredRatingWindow()).toBe(true);

    forgetRatingWindow();

    expect(hasStoredRatingWindow()).toBe(false);
    expect(getStoredRatingWindow()).toBeNull();
    expect(getStoredOpponentRatingForMode('casual')).toBeNull();
    expect(getModeAwareDefaultRatingWindow(1500, 'casual')).toEqual({
      minRating: 1300,
      maxRating: 1850,
    });
  });

  test('falls back to opponent targets once the range is reset', () => {
    rememberRatingWindow({ minRating: 1600, maxRating: 2000 });
    forgetRatingWindow();

    expect(rememberOpponentRatingForMode('casual', 900)).toEqual({
      minRating: 700,
      maxRating: 1100,
    });
    expect(getModeAwareDefaultRatingWindow(400, 'casual')).toEqual({
      minRating: 700,
      maxRating: 1100,
    });
  });
});
