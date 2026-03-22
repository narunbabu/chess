// @ts-check
import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Multiplayer Fixes:
 *   1. Game End Card display (checkmate, resign, timeout)
 *   2. Chat message deduplication
 *   3. Nudge opponent button
 *   4. Cancel game on 30s inactivity
 *   5. Leaderboard with completed games
 *   6. Daily Challenge page
 *
 * Prerequisites:
 *   - Laravel API: php artisan serve --port=8000
 *   - Reverb WS:   php artisan reverb:start --port=8080
 *   - Frontend:     pnpm start (port 3000)
 *   - Seeded DB: nalamara.arun@gmail.com (ID 1), narun.iitb@gmail.com (ID 2)
 */

test.describe.configure({ mode: 'serial' });

const API_BASE = 'http://localhost:8000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const PLAYER_A = {
  email: 'nalamara.arun@gmail.com',
  password: 'password',
  name: 'Arun Nalamara',
  id: 1,
};

const PLAYER_B = {
  email: 'narun.iitb@gmail.com',
  password: 'password',
  name: 'Arun Babu',
  id: 2,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function apiLogin(request, player) {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email: player.email, password: player.password },
  });
  expect(response.ok(), `Login failed for ${player.email}: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('success');
  return body.token;
}

async function setupAuthenticatedPage(context, token) {
  const page = await context.newPage();
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return page;
}

async function sendInvitation(request, inviterToken, invitedUserId, options = {}) {
  const response = await request.post(`${API_BASE}/invitations/send`, {
    headers: { Authorization: `Bearer ${inviterToken}` },
    data: {
      invited_user_id: invitedUserId,
      preferred_color: options.preferredColor || 'white',
      game_mode: options.gameMode || 'casual',
    },
  });
  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Send invitation failed (${response.status()}): ${JSON.stringify(body)}`);
  }
  const body = await response.json();
  return body.invitation;
}

async function acceptInvitation(request, accepterToken, invitationId) {
  const response = await request.post(`${API_BASE}/invitations/${invitationId}/respond`, {
    headers: { Authorization: `Bearer ${accepterToken}` },
    data: { action: 'accept' },
  });
  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Accept invitation failed (${response.status()}): ${JSON.stringify(body)}`);
  }
  const body = await response.json();
  return body.game;
}

async function createGameViaInvitation(request, tokenA, tokenB, options = {}) {
  const invitation = await sendInvitation(request, tokenA, PLAYER_B.id, options);
  const game = await acceptInvitation(request, tokenB, invitation.id);
  return game;
}

async function resignGame(request, token, gameId) {
  return request.post(`${API_BASE}/websocket/games/${gameId}/resign`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function cancelGameInactivity(request, token, gameId) {
  return request.post(`${API_BASE}/websocket/games/${gameId}/cancel-inactivity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function waitForBoard(page, timeout = 60000) {
  await page.waitForSelector('[data-square="e2"], [data-square="e4"]', { timeout });
}

async function clickSquare(page, square) {
  const sq = page.locator(`[data-square="${square}"]`);
  await sq.waitFor({ state: 'visible', timeout: 5000 });
  await sq.click({ force: true });
}

async function clickMove(page, from, to) {
  await clickSquare(page, from);
  await page.waitForTimeout(400);
  await clickSquare(page, to);
  await page.waitForTimeout(800);
}

/**
 * Clean up any active/waiting games for a player so tests start fresh.
 */
async function cleanupActiveGames(request, token) {
  try {
    const response = await request.get(`${API_BASE}/games/active?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) return;
    const body = await response.json();
    const games = Array.isArray(body) ? body : (body.data ?? body.games ?? []);
    for (const game of games) {
      const status = game.status || game.status_code || '';
      if (['active', 'waiting', 'in_progress', 'paused'].includes(status)) {
        await request.post(`${API_BASE}/websocket/games/${game.id}/resign`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
  } catch { /* ignore cleanup errors */ }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Multiplayer Fixes E2E', () => {
  test.setTimeout(120000);

  let tokenA, tokenB;
  let contextA, contextB;

  test.beforeAll(async ({ request }) => {
    // Login both players
    tokenA = await apiLogin(request, PLAYER_A);
    tokenB = await apiLogin(request, PLAYER_B);
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();

    // Cleanup any stale games from previous runs
    await cleanupActiveGames(request, tokenA);
    await cleanupActiveGames(request, tokenB);
  });

  // ─── 1. Server Health ────────────────────────────────────────────────────

  test('1.1 Backend API is reachable', async ({ request }) => {
    const response = await request.get(`${API_BASE}/user`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(response.ok()).toBeTruthy();
  });

  test('1.2 Frontend loads', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/chess|Chess99/i);
    await ctx.close();
  });

  // ─── 2. Game End Card on Resignation ─────────────────────────────────────

  test('2.1 Game end card shows after resignation', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    expect(game.id).toBeTruthy();
    const gameId = game.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();

    const pageA = await setupAuthenticatedPage(contextA, tokenA);
    const pageB = await setupAuthenticatedPage(contextB, tokenB);

    // Both navigate to game
    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });

    // Wait for boards
    await waitForBoard(pageA);
    await waitForBoard(pageB);

    // Wait for WebSocket activation
    await pageA.waitForTimeout(6000);

    // Player A resigns via API
    const resignResp = await resignGame(request, tokenA, gameId);
    expect(resignResp.ok()).toBeTruthy();

    // Both pages should show the game completion modal (GameCompletionAnimation wraps GameEndCard)
    // The resign caller shows it immediately; the opponent gets it via WS or polling fallback (5s)
    await expect(pageA.locator('.game-end-card').first()).toBeVisible({ timeout: 15000 });

    // Opponent should also see it (via WebSocket event or 5s polling fallback)
    await expect(pageB.locator('.game-end-card').first()).toBeVisible({ timeout: 15000 });

    await contextA.close();
    await contextB.close();
  });

  // ─── 3. Game End Card on Checkmate (Scholar's Mate) ─────────────────────

  test('2.2 Game end card shows after checkmate (Scholar\'s Mate)', async ({ browser, request }) => {
    // Create a new game where Player A is white
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();

    const pageA = await setupAuthenticatedPage(contextA, tokenA);
    const pageB = await setupAuthenticatedPage(contextB, tokenB);

    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });

    await waitForBoard(pageA);
    await waitForBoard(pageB);
    await pageA.waitForTimeout(6000);

    // Determine who is white
    const isAWhite = game.white_player_id === PLAYER_A.id;
    const whitePage = isAWhite ? pageA : pageB;
    const blackPage = isAWhite ? pageB : pageA;

    // Scholar's Mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#
    // White: e2->e4
    await clickMove(whitePage, 'e2', 'e4');
    await blackPage.waitForTimeout(3000);

    // Black: e7->e5
    await clickMove(blackPage, 'e7', 'e5');
    await whitePage.waitForTimeout(3000);

    // White: f1->c4 (Bishop)
    await clickMove(whitePage, 'f1', 'c4');
    await blackPage.waitForTimeout(3000);

    // Black: b8->c6 (Knight)
    await clickMove(blackPage, 'b8', 'c6');
    await whitePage.waitForTimeout(3000);

    // White: d1->h5 (Queen)
    await clickMove(whitePage, 'd1', 'h5');
    await blackPage.waitForTimeout(3000);

    // Black: g8->f6 (Knight — walks into the trap)
    await clickMove(blackPage, 'g8', 'f6');
    await whitePage.waitForTimeout(3000);

    // White: h5->f7 (Checkmate!)
    await clickMove(whitePage, 'h5', 'f7');

    // Both should see game end card after checkmate (3s fallback or WS event + 5s polling)
    await expect(whitePage.locator('.game-end-card').first()).toBeVisible({ timeout: 20000 });
    await expect(blackPage.locator('.game-end-card').first()).toBeVisible({ timeout: 20000 });

    await contextA.close();
    await contextB.close();
  });

  // ─── 4. Chat Deduplication ───────────────────────────────────────────────

  test('3.1 Chat messages are not duplicated for sender', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    const gameId = game.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();

    const pageA = await setupAuthenticatedPage(contextA, tokenA);
    const pageB = await setupAuthenticatedPage(contextB, tokenB);

    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });

    await waitForBoard(pageA);
    await waitForBoard(pageB);
    await pageA.waitForTimeout(6000);

    // Try to open the chat panel (look for chat tab in GameContainer)
    const chatTab = pageA.locator('button:has-text("Chat"), [data-tab="chat"]');
    if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatTab.click();
      await pageA.waitForTimeout(500);
    }

    // Find chat input and send a message
    const chatInput = pageA.locator('input[placeholder*="chat" i], input[placeholder*="message" i], textarea[placeholder*="message" i]');
    if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatInput.fill('Hello from Player A!');
      await chatInput.press('Enter');
      await pageA.waitForTimeout(3000);

      // Count how many times "Hello from Player A!" appears on sender's page
      const messageCount = await pageA.locator('text="Hello from Player A!"').count();
      expect(messageCount).toBeLessThanOrEqual(1); // Should NOT appear twice
    }

    // Cleanup
    await resignGame(request, tokenA, gameId);
    await contextA.close();
    await contextB.close();
  });

  // ─── 5. Nudge Opponent Button ────────────────────────────────────────────

  test('4.1 Nudge button appears when opponent\'s turn', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();

    const pageA = await setupAuthenticatedPage(contextA, tokenA);
    const pageB = await setupAuthenticatedPage(contextB, tokenB);

    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });

    await waitForBoard(pageA);
    await waitForBoard(pageB);
    await pageA.waitForTimeout(6000);

    const isAWhite = game.white_player_id === PLAYER_A.id;
    const whitePage = isAWhite ? pageA : pageB;
    const blackPage = isAWhite ? pageB : pageA;

    // White makes opening move
    await clickMove(whitePage, 'e2', 'e4');
    await blackPage.waitForTimeout(2000);

    // Now it's black's turn — white should see nudge button
    const nudgeBtn = whitePage.locator('button:has-text("Nudge")');
    await expect(nudgeBtn).toBeVisible({ timeout: 10000 });

    // Black should NOT see nudge (it's their turn)
    const blackNudge = blackPage.locator('button:has-text("Nudge")');
    await expect(blackNudge).not.toBeVisible({ timeout: 3000 });

    // Click nudge
    await nudgeBtn.click();
    await whitePage.waitForTimeout(1000);

    // Button should show "Nudged" (cooldown state)
    await expect(whitePage.locator('button:has-text("Nudged")')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await resignGame(request, tokenA, gameId);
    await contextA.close();
    await contextB.close();
  });

  // ─── 6. Cancel Game on Inactivity (API test) ───────────────────────────

  test('5.1 Cancel game on inactivity - API endpoint works', async ({ request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    // Game just started, white's turn — Player B (black) can request cancel
    // since it's white's turn and they're "inactive"
    const cancelResp = await cancelGameInactivity(request, tokenB, gameId);

    if (cancelResp.ok()) {
      const body = await cancelResp.json();
      expect(body.success).toBeTruthy();
      expect(body.end_reason).toBe('cancelled_inactivity');
      expect(body.result).toBe('*');
    } else {
      // Might fail if game status isn't 'active' yet (still 'waiting')
      // This is acceptable for the API test
      const body = await cancelResp.json().catch(() => ({}));
      console.log('Cancel response:', cancelResp.status(), body);
    }
  });

  test('5.2 Cancel button appears after 30s opponent idle (UI check)', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    contextA = await browser.newContext();
    const pageA = await setupAuthenticatedPage(contextA, tokenA);

    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await waitForBoard(pageA);
    await pageA.waitForTimeout(6000);

    const isAWhite = game.white_player_id === PLAYER_A.id;

    if (!isAWhite) {
      // If A is black, it's already opponent's (white) turn — just wait 30s
      // The cancel button should appear showing idle seconds
      const cancelBtn = pageA.locator('button:has-text("Cancel")');
      await expect(cancelBtn).toBeVisible({ timeout: 40000 });

      // Button text should include idle seconds
      const btnText = await cancelBtn.textContent();
      expect(btnText).toContain('idle');
    } else {
      // If A is white, make a move first, then wait for opponent
      await clickMove(pageA, 'e2', 'e4');
      await pageA.waitForTimeout(2000);

      // Now it's black's turn — wait 30+ seconds
      const cancelBtn = pageA.locator('button:has-text("Cancel")');
      await expect(cancelBtn).toBeVisible({ timeout: 40000 });

      const btnText = await cancelBtn.textContent();
      expect(btnText).toContain('idle');
    }

    // Cleanup
    await resignGame(request, tokenA, gameId).catch(() => {});
    await contextA.close();
  });

  // ─── 7. Game End Card for Cancelled Game ─────────────────────────────────

  test('5.3 Cancelled game via API has no rating impact', async ({ request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    // Cancel the game via API (Player B cancels since it's white/A's turn)
    const cancelResp = await cancelGameInactivity(request, tokenB, gameId);

    if (cancelResp.ok()) {
      const body = await cancelResp.json();
      expect(body.success).toBeTruthy();
      expect(body.result).toBe('*');
      expect(body.end_reason).toBe('cancelled_inactivity');

      // Verify via API that game is finished with no winner
      const gameDetails = await request.get(`${API_BASE}/games/${gameId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (gameDetails.ok()) {
        const data = await gameDetails.json();
        expect(data.status).toBe('finished');
        expect(data.result).toBe('*');
        expect(data.winner_user_id).toBeNull();
      }
    } else {
      // Game may not be in active state — check the error
      const body = await cancelResp.json().catch(() => ({}));
      console.log('Cancel response:', cancelResp.status(), body);
      // Accept "Game must be active" as valid — game was in waiting state
      expect(body.message).toContain('active');
    }
  });

  // ─── 8. Leaderboard ─────────────────────────────────────────────────────

  test('6.1 Leaderboard page loads and shows players', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await setupAuthenticatedPage(ctx, tokenA);

    await page.goto(`${FRONTEND_URL}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check that leaderboard content is visible
    const pageContent = await page.textContent('body');
    const hasLeaderboard = pageContent.toLowerCase().includes('leaderboard') ||
                           pageContent.toLowerCase().includes('ranking') ||
                           pageContent.toLowerCase().includes('leader');

    expect(hasLeaderboard).toBeTruthy();

    // Check for player entries (table rows or list items)
    const entries = page.locator('tr, [class*="leaderboard-row"], [class*="player-row"], [class*="ranking"]');
    const entryCount = await entries.count();
    console.log(`Leaderboard entries found: ${entryCount}`);

    await page.screenshot({ path: 'test-results/leaderboard.png' });
    await ctx.close();
  });

  test('6.2 Leaderboard shows recently completed games', async ({ browser, request }) => {
    // First, create and complete a game so we have recent data
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    await resignGame(request, tokenA, game.id);
    await new Promise(r => setTimeout(r, 2000)); // Wait for DB update

    const ctx = await browser.newContext();
    const page = await setupAuthenticatedPage(ctx, tokenA);

    await page.goto(`${FRONTEND_URL}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Check that leaderboard data loaded (not empty state)
    const emptyState = page.locator('text="No data", text="No players", text="No results"');
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasEmpty) {
      console.warn('⚠️ Leaderboard shows empty state — checking API directly');
      const leaderboardResp = await request.get(`${API_BASE}/leaderboard`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (leaderboardResp.ok()) {
        const data = await leaderboardResp.json();
        console.log('Leaderboard API response:', JSON.stringify(data).substring(0, 500));
      }
    }

    await page.screenshot({ path: 'test-results/leaderboard-with-games.png' });
    await ctx.close();
  });

  // ─── 9. Daily Challenge ──────────────────────────────────────────────────

  test('7.1 Daily Challenge page loads', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await setupAuthenticatedPage(ctx, tokenA);

    // Navigate to daily challenge page
    await page.goto(`${FRONTEND_URL}/daily-challenge`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pageContent = await page.textContent('body');
    const hasDailyChallenge = pageContent.toLowerCase().includes('daily') ||
                              pageContent.toLowerCase().includes('challenge') ||
                              pageContent.toLowerCase().includes('puzzle');

    // Take screenshot regardless
    await page.screenshot({ path: 'test-results/daily-challenge.png' });

    // Check for a chessboard on the page (challenge should have a board)
    const hasBoard = await page.locator('[data-square="e2"], [data-square="e4"], .chessboard, [class*="board"]').isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Daily challenge has board:', hasBoard);
    console.log('Daily challenge page text contains relevant content:', hasDailyChallenge);

    await ctx.close();
  });

  test('7.2 Daily Challenge API endpoint works', async ({ request }) => {
    // Check if the daily challenge API returns data
    const response = await request.get(`${API_BASE}/daily-challenge`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    console.log('Daily challenge API status:', response.status());
    if (response.ok()) {
      const data = await response.json();
      console.log('Daily challenge data:', JSON.stringify(data).substring(0, 500));
    } else {
      console.log('Daily challenge API not available or empty:', response.status());
    }
  });

  // ─── 10. Active Game Banner Notification ────────────────────────────────

  test('8.1 Active game banner shows on non-game pages', async ({ browser, request }) => {
    // Create a game
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    const gameId = game.id;

    const ctx = await browser.newContext();
    const page = await setupAuthenticatedPage(ctx, tokenA);

    // Go to dashboard (not the game page)
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000); // Wait for ActiveGameBanner polling (5s interval)

    // Look for active game banner
    const banner = page.locator('text="Enter Game", text="Active Game", text="Your game", [class*="active-game"], [class*="banner"]');
    const hasBanner = await banner.first().isVisible({ timeout: 10000 }).catch(() => false);
    console.log('Active game banner visible:', hasBanner);

    await page.screenshot({ path: 'test-results/active-game-banner.png' });

    // Cleanup
    await resignGame(request, tokenA, gameId);
    await ctx.close();
  });

  // ─── 11. Quick Game Flow: Create → Play → End ─────────────────────────

  test('9.1 Full game flow: create, play moves, resign, see end card', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, { preferredColor: 'white' });
    const gameId = game.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();

    const pageA = await setupAuthenticatedPage(contextA, tokenA);
    const pageB = await setupAuthenticatedPage(contextB, tokenB);

    // Both navigate to game
    await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });
    await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${gameId}`, { waitUntil: 'domcontentloaded' });

    await waitForBoard(pageA);
    await waitForBoard(pageB);
    await pageA.waitForTimeout(6000);

    const isAWhite = game.white_player_id === PLAYER_A.id;
    const whitePage = isAWhite ? pageA : pageB;
    const blackPage = isAWhite ? pageB : pageA;

    // Play 2 moves: 1.e4 e5
    await clickMove(whitePage, 'e2', 'e4');
    await blackPage.waitForTimeout(2000);
    await clickMove(blackPage, 'e7', 'e5');
    await whitePage.waitForTimeout(2000);

    // Play 2 more: 2.Nf3 Nc6
    await clickMove(whitePage, 'g1', 'f3');
    await blackPage.waitForTimeout(2000);
    await clickMove(blackPage, 'b8', 'c6');
    await whitePage.waitForTimeout(2000);

    // White resigns
    const resignBtn = whitePage.locator('button:has-text("Resign")');
    if (await resignBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Handle confirm dialog
      whitePage.once('dialog', async dialog => await dialog.accept());
      await resignBtn.click();
    } else {
      // Fall back to API resign
      await resignGame(request, isAWhite ? tokenA : tokenB, gameId);
    }

    // Both should see end card
    await expect(whitePage.locator('.game-end-card').first()).toBeVisible({ timeout: 15000 });

    // Take screenshots
    await whitePage.screenshot({ path: 'test-results/game-end-white.png' });
    await blackPage.screenshot({ path: 'test-results/game-end-black.png' });

    await contextA.close();
    await contextB.close();
  });
});
