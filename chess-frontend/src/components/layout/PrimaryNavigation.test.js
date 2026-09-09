import { primarySection } from './PrimaryNavigation';

test.each([
  ['/lobby', 'play'], ['/play', 'play'], ['/play/multiplayer/42', 'play'],
  ['/learn', 'learn'], ['/tutorial/lesson/1', 'learn'], ['/daily-challenges', 'learn'],
  ['/championships/8', 'compete'], ['/leaderboard', 'compete'],
  ['/dashboard', 'you'], ['/profile', 'you'], ['/game-history', 'you'],
])('%s selects %s from the route, not local tab state', (path, expected) => {
  expect(primarySection(path)).toBe(expected);
});
