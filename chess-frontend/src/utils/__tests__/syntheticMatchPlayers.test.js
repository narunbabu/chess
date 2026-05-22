import { pickBeginnerSyntheticPlayer } from '../syntheticMatchPlayers';
import { isRatingInWindow } from '../ratingWindow';
import { getLevelFromRating } from '../eloUtils';

describe('synthetic match fallback players', () => {
  test('keeps no-window fallbacks beginner friendly', () => {
    const player = pickBeginnerSyntheticPlayer();

    expect(player.rating).toBeLessThanOrEqual(750);
    expect(player.computer_level).toBeLessThanOrEqual(3);
  });

  test('creates a rating-matched fallback when selected Elo is above beginner pool', () => {
    const ratingWindow = { minRating: 1800, maxRating: 2000 };
    const player = pickBeginnerSyntheticPlayer(ratingWindow);

    expect(isRatingInWindow(player.rating, ratingWindow)).toBe(true);
    expect(player.computer_level).toBe(getLevelFromRating(player.rating));
  });
});
