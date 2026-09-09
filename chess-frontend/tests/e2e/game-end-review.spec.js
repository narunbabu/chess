// @ts-check
import { test, expect } from '@playwright/test';

/**
 * E2E: Game-end review entry for single-player computer games (Feature A)
 *
 * Covers acceptance criteria 1-9 of
 * docs/specs/2026-09-02-karta/FEATURES-A-B.md (section A3).
 *
 * Self-contained: all backend API traffic is intercepted with page.route —
 * no Laravel/Reverb servers are required. Deterministic game endings are set
 * up via the app's own refresh-persistence key (chess99_active_computer_game)
 * seeded with a mate-in-1 position (Scholar's mate: 1.e4 e5 2.Qh5 Nc6 3.Bc4
 * Nf6 4.Qxf7#), so the Stockfish worker never decides the outcome.
 *
 * Criterion 5 (multiplayer regression) is covered by a source-level tripwire:
 * driving a real multiplayer end requires a live Reverb backend, and this
 * feature must not touch the multiplayer path at all — the tripwire asserts
 * the multiplayer wiring is unchanged.
 */

// Playwright transpiles this spec to CJS — native __dirname is available.
// (process.getBuiltinModule works in both CJS and ESM, unlike bare imports.)
const { readFileSync } = process.getBuiltinModule('fs');
const { join } = process.getBuiltinModule('path');
const dirname = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();

// ─── Mate-in-1 fixture: position after 3...Nf6, White plays Qxf7# ───────────
const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// history entries follow the app convention: fen = state BEFORE the move
const MATE_HISTORY = [
  { moveNumber: 1, fen: START_FEN, move: { san: 'e4' }, playerColor: 'w', timeSpent: 2.1, evaluation: null },
  { moveNumber: 1, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', move: { san: 'e5' }, playerColor: 'b', timeSpent: 1.8, evaluation: null },
  { moveNumber: 2, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', move: { san: 'Qh5' }, playerColor: 'w', timeSpent: 3.0, evaluation: null },
  { moveNumber: 2, fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2', move: { san: 'Nc6' }, playerColor: 'b', timeSpent: 2.4, evaluation: null },
  { moveNumber: 3, fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3', move: { san: 'Bc4' }, playerColor: 'w', timeSpent: 2.6, evaluation: null },
  { moveNumber: 3, fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', move: { san: 'Nf6' }, playerColor: 'b', timeSpent: 1.9, evaluation: null },
];

const BACKEND_GAME_ID = 501;
const TEST_USER = { id: 42, name: 'E2E Tester', email: 'e2e@example.com', rating: 1200 };

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Intercept every /api/** call the SPA can make. Known endpoints get real
 * shapes; everything else gets an empty 200 so unrelated background calls
 * (history saves, rating, tactical sync, invitations…) never fail the run.
 */
async function mockBackend(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path.endsWith('/user') && method === 'GET') {
      return json(TEST_USER);
    }
    if (path.endsWith('/games/computer') && method === 'POST') {
      return json({ game: { id: BACKEND_GAME_ID, status: 'active', game_type: 'computer' } });
    }
    if ((path.endsWith('/complete') || path.endsWith('/resign')) && method === 'POST') {
      return json({ success: true });
    }
    if (path.endsWith('/rating/update') && method === 'POST') {
      return json({
        old_rating: 1200, new_rating: 1215, rating_change: 15, k_factor: 32,
        expected_score: 0.5, actual_score: 1, rating_type: 'blitz',
      });
    }
    return json({});
  });
}

/** Seed localStorage before the app boots. */
async function seedStorage(page, entries) {
  await page.addInitScript((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    }
  }, entries);
}

/** Seed the app's refresh-persistence key with a deterministic game. */
async function seedActiveGame(page, overrides = {}) {
  await page.addInitScript((state) => {
    localStorage.setItem('chess99_active_computer_game', JSON.stringify(state));
  }, {
    fen: MATE_FEN,
    gameStarted: true,
    playerColor: 'w',
    computerDepth: 3,
    ratedMode: 'casual',
    timeControlMin: 10,
    incrementSec: 0,
    moves: MATE_HISTORY,
    playerScore: 0,
    computerScore: 0,
    playerTime: 300,
    computerTime: 300,
    undoChancesRemaining: 5,
    currentGameId: null,
    backendGameId: null,
    syntheticOpponent: null,
    lastUpdated: Date.now(),
    ...overrides,
  });
}

async function clickSquare(page, square) {
  const sq = page.locator(`[data-square="${square}"]`);
  await sq.waitFor({ state: 'visible', timeout: 20000 });
  await sq.click({ force: true });
}

/** Deliver Qxf7# from the seeded position and wait for the end card. */
async function playMateInOne(page) {
  await page.locator('[data-square="h5"]').waitFor({ state: 'visible', timeout: 20000 });
  await clickSquare(page, 'h5');
  await page.waitForTimeout(400);
  await clickSquare(page, 'f7');
  // End card appears after checkmate is processed
  await page.locator('button:has-text("Review")').waitFor({ state: 'visible', timeout: 20000 });
}

/** Resign sits inside the "More ▾" action menu. */
async function resignViaMoreMenu(page) {
  await page.locator('button:has-text("More")').first().click();
  const resign = page.locator('button:has-text("Resign")').first();
  await resign.waitFor({ state: 'visible', timeout: 10000 });
  page.once('dialog', (d) => d.accept());
  // dispatchEvent bypasses pointer-actionability retries on the popover menu;
  // React's onClick → handleResign() still runs and the confirm is accepted.
  await resign.dispatchEvent('click');
}

/** Fresh anonymous session (no auth_token) — exercises the guest branch. */
async function guestPage(page) {
  await mockBackend(page);
  await seedStorage(page, {
    auth_token: null,
    user: null,
    chess99_active_computer_game: null,
    lastGameId: null,
  });
}

/** Fresh authenticated session — exercises the auth branch. */
async function authPage(page) {
  await mockBackend(page);
  await seedStorage(page, {
    auth_token: 'e2e-token',
    user: JSON.stringify(TEST_USER),
    chess99_active_computer_game: null,
    lastGameId: null,
    playerColor: 'w',
    computerDepth: '3',
    'chess99:casual_tour:v1:42': 'completed',
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Game-end review entry (single-player)', () => {

  // Criterion 1 (button + /play/review/<id> + move list + shareable URL) and
  // criterion 6 (end reason: resignation produces the same button).
  // The checkmate end reason is exercised in the guest test below.
  test('auth rated game: Review button lands on /play/review/:id with the full move list', async ({ page }) => {
    test.setTimeout(180000);
    await authPage(page);
    await page.goto('/play', { waitUntil: 'domcontentloaded' });

    // Wait for auth hydration (mode selector renders only for logged-in users)
    await page.waitForResponse((r) => r.url().includes('/api/user') && r.request().method() === 'GET', { timeout: 20000 });
    await page.locator('button:has-text("Rated")').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('button:has-text("Rated")').first().click();

    await page.locator('button.start-button:has-text("Play")').click();
    await page.locator('[data-square="e2"]').waitFor({ state: 'visible', timeout: 30000 });

    // Play 1. e4 and wait for the engine's reply to appear in the move list
    await clickSquare(page, 'e2');
    await page.waitForTimeout(400);
    await clickSquare(page, 'e4');
    await expect.poll(async () => page.locator('.gc-move-cell').count(), { timeout: 45000 }).toBeGreaterThanOrEqual(2);

    // End the game by resignation
    await resignViaMoreMenu(page);

    // End card shows the Review button
    const reviewBtn = page.locator('button:has-text("Review")').first();
    await expect(reviewBtn).toBeVisible({ timeout: 20000 });
    await reviewBtn.click();

    // Lands on /play/review/<backendGame.id> (shareable URL)
    await expect(page).toHaveURL(new RegExp(`/play/review/${BACKEND_GAME_ID}$`), { timeout: 20000 });

    // Full move list renders from navigation state, no loading error
    await page.locator('[data-move-index]').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('[data-move-index="1"]')).toHaveText(/e4/);
    await expect(page.locator('text=Failed to load game data')).toHaveCount(0);

    // Criterion 9: end card must NOT re-open inside GameReview
    await page.waitForTimeout(1500);
    await expect(page.locator('button:text-is("×")')).toHaveCount(0);
    const dismissed = await page.evaluate(
      (id) => sessionStorage.getItem(`endcard_dismissed_${id}`),
      String(BACKEND_GAME_ID),
    );
    expect(dismissed).toBeTruthy();
  });

  // Criteria 1 (checkmate), 2 (learning mode + lifeline markers), 4 (guest →
  // /game-review from state, no Stockfish card), 9 (no end-card re-show).
  test('guest learning game ends by checkmate: Review navigates to /game-review with lifeline markers', async ({ page }) => {
    test.setTimeout(120000);
    await guestPage(page);
    await seedActiveGame(page, {
      ratedMode: 'learning',
      learningHelpLimit: 5,
      moves: MATE_HISTORY.map((m, i) => (
        i === 0 ? { ...m, learningHelp: [{ type: 'help', usedBeforePly: 1, usedAt: '2026-09-02T00:00:00Z' }] } : m
      )),
    });
    await page.goto('/play', { waitUntil: 'domcontentloaded' });

    await playMateInOne(page);
    await page.locator('button:has-text("Review")').first().click();

    await expect(page).toHaveURL(/\/game-review$/, { timeout: 20000 });

    // Board + moves render from navigation state — no API, no login wall
    await page.locator('[data-move-index]').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('[data-move-index="1"]')).toHaveText(/e4/);
    // 6 seeded moves + the mating move = 7 rendered moves
    await expect(page.locator('[data-move-index]')).toHaveCount(7);
    await expect(page.locator('[data-move-index="7"]')).toHaveText(/Qxf7#/);

    // Learning lifeline markers ride in moves[].learningHelp
    await expect(page.locator('[data-move-index="1"] span[title^="Lifeline used"]')).toBeVisible();

    // Criterion 4: no route id → no Stockfish analysis card
    await expect(page.locator('text=/stockfish/i')).toHaveCount(0);
    await expect(page.locator('text=Failed to load game data')).toHaveCount(0);

    // Criterion 9: GameReview does not re-open the GameEndCard modal
    await page.waitForTimeout(1500);
    await expect(page.locator('button:text-is("×")')).toHaveCount(0);
  });

  // Criterion 8: guest loses navigation state (fresh entry / shared URL) —
  // review still loads from localStorage['lastGameHistory'].
  test('guest review survives state loss via lastGameHistory fallback', async ({ page }) => {
    test.setTimeout(120000);
    await guestPage(page);
    await seedActiveGame(page, { ratedMode: 'casual' });
    await page.goto('/play', { waitUntil: 'domcontentloaded' });

    await playMateInOne(page);
    await page.locator('button:has-text("Review")').first().click();
    await expect(page).toHaveURL(/\/game-review$/, { timeout: 20000 });
    await page.locator('[data-move-index]').first().waitFor({ state: 'visible', timeout: 20000 });

    // Fresh entry — history.state is empty, so only the fallback can supply data
    await page.goto('/game-review', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-move-index]').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('[data-move-index="1"]')).toHaveText(/e4/);
    await expect(page.locator('text=No game specified')).toHaveCount(0);
    await expect(page.locator('text=Failed to load game data')).toHaveCount(0);

    // The payload was actually persisted
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lastGameHistory') || 'null'));
    expect(stored).toBeTruthy();
    expect(Array.isArray(stored.moves)).toBeTruthy();
    expect(stored.moves[0].move.san).toBe('Start');
  });

  // Criteria 2 (casual mode button) + 3 (synthetic opponent identity).
  test('casual synthetic-opponent game: review shows the bot identity', async ({ page }) => {
    test.setTimeout(120000);
    await authPage(page);
    await seedActiveGame(page, {
      ratedMode: 'casual',
      syntheticOpponent: { id: 'bot-e2e', name: 'Coach Mira', rating: 1600, avatar_url: null, personality: 'tactical' },
    });
    await page.goto('/play', { waitUntil: 'domcontentloaded' });

    await playMateInOne(page);
    await page.locator('button:has-text("Review")').first().click();

    // No backend id in a restored session → state-only review page
    await expect(page).toHaveURL(/\/game-review$/, { timeout: 20000 });
    await page.locator('[data-move-index]').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('text=Coach Mira').first()).toBeVisible();
    await expect(page.locator('text=Failed to load game data')).toHaveCount(0);
  });

  // Criterion 7: zero-move game renders no Review button.
  test('zero-move game shows no Review button', async ({ page }) => {
    test.setTimeout(120000);
    await guestPage(page);
    await seedStorage(page, {
      'chess99:casual_tour:v1:guest': 'completed',
      computerDepth: '3',
    });
    await page.goto('/play', { waitUntil: 'domcontentloaded' });

    await page.locator('button.start-button:has-text("Play")').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('button.start-button:has-text("Play")').click();
    await page.locator('[data-square="e2"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);

    await resignViaMoreMenu(page);

    // End card appears but must not offer Review
    await page.locator('button:has-text("Play Again")').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('button:has-text("Review")')).toHaveCount(0);
  });

  // Criterion 5 (multiplayer regression — no code change expected) + the
  // A6 note: guests only reach /game-review while AUTH_GATES is false.
  // Full multiplayer E2E needs a live Reverb backend (see multiplayer-game.spec.js),
  // so this is a wiring tripwire on the untouched sources.
  test('multiplayer review wiring and guest route gate are unchanged (regression tripwire)', () => {
    const animationSrc = readFileSync(join(__dirname, '../../src/components/GameCompletionAnimation.js'), 'utf8');
    const multiplayerSrc = readFileSync(join(__dirname, '../../src/components/play/PlayMultiplayer.js'), 'utf8');
    const flagsSrc = readFileSync(join(__dirname, '../../src/contexts/FeatureFlagsContext.js'), 'utf8');

    // The multiplayer onPreview → 👁️ Review button still exists
    expect(multiplayerSrc).toMatch(/onPreview=\{/);
    // Three onPreview button blocks now exist: multiplayer + single-player auth + guest
    expect(animationSrc.match(/\{onPreview && \(/g) || []).toHaveLength(3);
    expect((animationSrc.match(/👁️ Review/g) || []).length).toBeGreaterThanOrEqual(3);
    // Guests can load /game-review only while AUTH_GATES is off (spec A6)
    expect(flagsSrc).toMatch(/AUTH_GATES:\s*false/);
  });
});
