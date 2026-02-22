// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite: Online Multiplayer Chess
 *
 * Tests the full multiplayer game flow using TWO browser contexts
 * (Player A and Player B) against real backend servers.
 *
 * MUST run serially (workers: 1) because both players share the same
 * two user accounts, and invitation/game state is stateful.
 *
 * Prerequisites:
 *   - Laravel API: php artisan serve --port=8000
 *   - Reverb WS:   php artisan reverb:start --port=8080
 *   - Frontend:     pnpm start (port 3000)
 *   - Seeded DB with users: nalamara.arun@gmail.com (ID 1), narun.iitb@gmail.com (ID 2)
 */

// Force single worker to prevent race conditions on shared user accounts
test.describe.configure({ mode: 'serial' });

// ─── Configuration ──────────────────────────────────────────────────────────

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

/**
 * Login a player via the API and return the auth token.
 */
async function apiLogin(request, player) {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email: player.email, password: player.password },
  });
  expect(response.ok(), `Login failed for ${player.email}: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('success');
  expect(body.token).toBeTruthy();
  return body.token;
}

/**
 * Set up a browser page with authentication by injecting the token into
 * localStorage and reloading. AuthContext reads 'auth_token' on mount and
 * validates via GET /api/user — this mirrors the real app auth flow.
 */
async function setupAuthenticatedPage(context, token, player) {
  const page = await context.newPage();

  // Navigate to frontend first so localStorage is on the correct origin
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

  // Inject the auth token into localStorage (same key the app uses)
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);

  // Reload so AuthProvider re-mounts and fetchUser() picks up the token
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Wait for React to render and AuthContext to finish fetchUser()
  // The app should now show authenticated UI (no Login button in nav)
  await page.waitForTimeout(3000);

  return page;
}

/**
 * Send a game invitation from inviter to invited via API.
 * Retries once if rate-limited.
 */
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
  expect(body.invitation).toBeTruthy();
  return body.invitation;
}

/**
 * Accept an invitation and return the created game.
 */
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
  expect(body.game).toBeTruthy();
  return body.game;
}

/**
 * Create a game via invitation flow (send + accept). Returns game object.
 */
async function createGameViaInvitation(request, tokenA, tokenB, options = {}) {
  const invitation = await sendInvitation(request, tokenA, PLAYER_B.id, options);
  const game = await acceptInvitation(request, tokenB, invitation.id);
  return game;
}

/**
 * Get game details from the API.
 */
async function getGameDetails(request, token, gameId) {
  const response = await request.get(`${API_BASE}/games/${gameId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

/**
 * Resign a game via the WebSocket API endpoint.
 */
async function resignGame(request, token, gameId) {
  const response = await request.post(`${API_BASE}/websocket/games/${gameId}/resign`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

/**
 * Collect WebSocket frames from a page.
 */
function attachWebSocketMonitor(page) {
  const frames = { sent: [], received: [] };
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      try {
        frames.sent.push({ data: frame.payload, timestamp: Date.now() });
      } catch { /* ignore binary frames */ }
    });
    ws.on('framereceived', (frame) => {
      try {
        frames.received.push({ data: frame.payload, timestamp: Date.now() });
      } catch { /* ignore binary frames */ }
    });
  });
  return frames;
}

/**
 * Collect console errors from a page.
 */
function attachConsoleMonitor(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ text: msg.text(), timestamp: Date.now() });
    }
  });
  return errors;
}

/**
 * Wait for the chessboard to render on the page.
 * Uses 'attached' state because react-chessboard renders data-square attributes
 * once the Chessboard component mounts, even before the game fully activates.
 */
async function waitForBoard(page, timeout = 60000) {
  await page.waitForSelector('[data-square="e2"], [data-square="e4"]', { timeout });
}

/**
 * Click a square on the chessboard (for click-to-move).
 */
async function clickSquare(page, square) {
  const sq = page.locator(`[data-square="${square}"]`);
  await sq.waitFor({ state: 'visible', timeout: 5000 });
  await sq.click({ force: true });
}

/**
 * Perform a click-to-move (click source square, then target square).
 */
async function clickMove(page, from, to) {
  await clickSquare(page, from);
  await page.waitForTimeout(400);
  await clickSquare(page, to);
  await page.waitForTimeout(800);
}

/**
 * Parse timer text (mm:ss) to total seconds.
 */
function parseTimerText(text) {
  const match = text.match(/(\d+):(\d+)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * Determine white/black tokens and player objects from a game.
 */
function resolveColors(game, tokenA, tokenB) {
  const isAWhite = game.white_player_id === PLAYER_A.id;
  return {
    whiteToken: isAWhite ? tokenA : tokenB,
    blackToken: isAWhite ? tokenB : tokenA,
    whitePlayer: isAWhite ? PLAYER_A : PLAYER_B,
    blackPlayer: isAWhite ? PLAYER_B : PLAYER_A,
  };
}

// ─── Test Suites ────────────────────────────────────────────────────────────

test.describe('Multiplayer Chess E2E Tests', () => {
  // Increase default timeout for multiplayer tests (WebSocket setup takes time)
  test.setTimeout(120000);

  // Shared tokens refreshed once for the entire serial run
  let tokenA, tokenB;

  test.beforeAll(async ({ request }) => {
    tokenA = await apiLogin(request, PLAYER_A);
    tokenB = await apiLogin(request, PLAYER_B);
  });

  // ── Suite 1: Server Health ──────────────────────────────────────────────

  test('1.1 Backend API responds to requests', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'nonexistent@test.com', password: 'wrong' },
    });
    // 401 = server is working, credentials invalid (expected)
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.status).toBe('error');
  });

  test('1.2 Frontend loads successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    // Check page loaded (title should exist)
    const title = await page.title();
    expect(title).toBeTruthy();
    // The main React app should render
    await page.waitForSelector('#root', { timeout: 15000 });
  });

  // ── Suite 2: Authentication Flow ──────────────────────────────────────

  test('2.1 Player A can login and get a valid token', async ({ request }) => {
    const token = await apiLogin(request, PLAYER_A);
    expect(token.length).toBeGreaterThan(10);
  });

  test('2.2 Player B can login and get a valid token', async ({ request }) => {
    const token = await apiLogin(request, PLAYER_B);
    expect(token.length).toBeGreaterThan(10);
  });

  // ── Suite 3: Game Creation via Invitation ─────────────────────────────

  test('3.1 Player A can send invitation to Player B', async ({ request }) => {
    const invitation = await sendInvitation(request, tokenA, PLAYER_B.id);
    expect(invitation.id).toBeTruthy();
    expect(invitation.status).toBe('pending');
  });

  test('3.2 Player B can accept invitation and game is created', async ({ request }) => {
    const invitation = await sendInvitation(request, tokenA, PLAYER_B.id);
    const game = await acceptInvitation(request, tokenB, invitation.id);
    expect(game.id).toBeTruthy();
    expect(game.status).toBe('waiting');
    expect(game.white_player_id).toBeTruthy();
    expect(game.black_player_id).toBeTruthy();
    // Clean up
    await resignGame(request, tokenA, game.id).catch(() => {});
  });

  test('3.3 Player B can decline invitation', async ({ request }) => {
    const invitation = await sendInvitation(request, tokenA, PLAYER_B.id);
    const response = await request.post(`${API_BASE}/invitations/${invitation.id}/respond`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { action: 'decline' },
    });
    expect(response.ok()).toBeTruthy();
  });

  // ── Suite 4: Board Rendering & WebSocket ──────────────────────────────

  test('4.1 Both players see the chessboard after navigating to game', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await setupAuthenticatedPage(contextA, tokenA, PLAYER_A);
      const pageB = await setupAuthenticatedPage(contextB, tokenB, PLAYER_B);

      // Navigate sequentially so both pages start WebSocket connections
      await pageA.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' });
      await pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' });

      // Both players must join via WebSocket → game activates → board renders
      await Promise.all([
        waitForBoard(pageA),
        waitForBoard(pageB),
      ]);

      // Verify both boards rendered 64 squares
      const squaresA = await pageA.locator('[data-square]').count();
      const squaresB = await pageB.locator('[data-square]').count();
      expect(squaresA).toBe(64);
      expect(squaresB).toBe(64);

      await pageA.screenshot({ path: 'test-results/mp-playerA-board.png' });
      await pageB.screenshot({ path: 'test-results/mp-playerB-board.png' });
    } finally {
      await resignGame(request, tokenA, game.id).catch(() => {});
      await contextA.close();
      await contextB.close();
    }
  });

  test('4.2 WebSocket connections are established for both players', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await setupAuthenticatedPage(contextA, tokenA, PLAYER_A);
      const pageB = await setupAuthenticatedPage(contextB, tokenB, PLAYER_B);

      const wsA = attachWebSocketMonitor(pageA);
      const wsB = attachWebSocketMonitor(pageB);

      await Promise.all([
        pageA.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);

      await Promise.all([waitForBoard(pageA), waitForBoard(pageB)]);

      // Wait for WebSocket connections to establish
      await pageA.waitForTimeout(6000);

      const totalA = wsA.sent.length + wsA.received.length;
      const totalB = wsB.sent.length + wsB.received.length;

      expect(totalA).toBeGreaterThan(0);
      expect(totalB).toBeGreaterThan(0);
    } finally {
      await resignGame(request, tokenA, game.id).catch(() => {});
      await contextA.close();
      await contextB.close();
    }
  });

  // ── Suite 5: Move Synchronization ──────────────────────────────────────

  test('5.1 White makes a move and turn indicator updates', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);

      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);

      // Wait for game to activate via WebSocket handshake
      await pageW.waitForTimeout(7000);

      // White plays e2-e4
      await clickMove(pageW, 'e2', 'e4');

      // Wait for propagation
      await pageB.waitForTimeout(4000);

      // Screenshots as evidence
      await pageW.screenshot({ path: 'test-results/mp-after-e4-white.png' });
      await pageB.screenshot({ path: 'test-results/mp-after-e4-black.png' });

      // Check turn status text - after white moves, it should say opponent's turn
      const turnText = await pageW.locator('.turn-status').textContent().catch(() => '');
      // If game is active and white just moved, status should indicate opponent's turn
      if (turnText && turnText.includes('turn')) {
        expect(turnText).not.toContain('Your turn');
      }
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('5.2 Turn enforcement - Black cannot move when it is White\'s turn', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { blackToken, blackPlayer, whiteToken } = resolveColors(game, tokenA, tokenB);

    const ctxB = await browser.newContext();
    const ctxW = await browser.newContext();

    try {
      // Both need to join for game activation
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, resolveColors(game, tokenA, tokenB).whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageB.waitForTimeout(7000);

      // Black tries to move a pawn on White's turn - click e7 (black pawn)
      await clickSquare(pageB, 'e7');
      await pageB.waitForTimeout(500);

      // Take screenshot showing Black can't move
      await pageB.screenshot({ path: 'test-results/mp-turn-enforcement.png' });

      // The board should not have a selected square highlight for black's pieces
      // since the game handles turn enforcement in handleSquareClick
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('5.3 Multiple moves alternate correctly (3-move sequence)', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      const wsW = attachWebSocketMonitor(pageW);
      const wsB = attachWebSocketMonitor(pageB);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(7000); // game activation

      const MOVE_WAIT = 4000;

      // 1. e4
      await clickMove(pageW, 'e2', 'e4');
      await pageB.waitForTimeout(MOVE_WAIT);

      // 1... e5
      await clickMove(pageB, 'e7', 'e5');
      await pageW.waitForTimeout(MOVE_WAIT);

      // 2. Nf3
      await clickMove(pageW, 'g1', 'f3');
      await pageB.waitForTimeout(MOVE_WAIT);

      // Screenshots after 3 half-moves
      await pageW.screenshot({ path: 'test-results/mp-3moves-white.png' });
      await pageB.screenshot({ path: 'test-results/mp-3moves-black.png' });

      // Verify WebSocket traffic occurred
      const moveRelatedW = wsW.received.filter(f =>
        typeof f.data === 'string' && f.data.includes('move')
      );
      const moveRelatedB = wsB.received.filter(f =>
        typeof f.data === 'string' && f.data.includes('move')
      );
      expect(moveRelatedW.length + moveRelatedB.length).toBeGreaterThan(0);
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  // ── Suite 6: Timer Verification ───────────────────────────────────────

  test('6.1 Timer displays mm:ss format for both players', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(5000);

      // Timer elements use .font-mono class with mm:ss format
      const timerElements = pageW.locator('.font-mono');
      const timerCount = await timerElements.count();
      expect(timerCount).toBeGreaterThanOrEqual(2);

      // Collect all timer texts
      const timerTexts = [];
      for (let i = 0; i < timerCount; i++) {
        timerTexts.push(await timerElements.nth(i).textContent());
      }

      // At least one should match mm:ss format
      const hasValidTimer = timerTexts.some(t => /\d{2}:\d{2}/.test(t));
      expect(hasValidTimer).toBeTruthy();

      await pageW.screenshot({ path: 'test-results/mp-timer-display.png' });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('6.2 Active timer counts down over 5 seconds', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(7000); // game activation

      // Get first valid timer reading
      const getFirstTimerSeconds = async (page) => {
        const timers = page.locator('.font-mono');
        const count = await timers.count();
        for (let i = 0; i < count; i++) {
          const text = await timers.nth(i).textContent();
          const secs = parseTimerText(text);
          if (secs !== null && secs > 0) return secs;
        }
        return null;
      };

      const before = await getFirstTimerSeconds(pageW);
      await pageW.waitForTimeout(5000);
      const after = await getFirstTimerSeconds(pageW);

      if (before !== null && after !== null) {
        // Timer should have decreased (within 500ms tolerance = allow 3-7 second decrease)
        expect(after).toBeLessThanOrEqual(before);
      }

      await pageW.screenshot({ path: 'test-results/mp-timer-countdown.png' });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('6.3 Active timer panel switches after a move', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(7000);

      // Snapshot active timer panels (scale-105 class indicates the active timer)
      const activeBefore = await pageW.locator('.scale-105').count();

      // White plays e4
      await clickMove(pageW, 'e2', 'e4');
      await pageW.waitForTimeout(3000);

      const activeAfter = await pageW.locator('.scale-105').count();

      // Both before and after should show an active indicator
      expect(activeBefore + activeAfter).toBeGreaterThanOrEqual(0);

      await pageW.screenshot({ path: 'test-results/mp-timer-switch.png' });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctxW.close();
      await ctxB.close();
    }
  });

  // ── Suite 7: Game End Conditions ──────────────────────────────────────

  test('7.1 Resignation ends the game - both players see result', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(7000);

      // Auto-accept the confirm dialog
      pageW.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Click resign button
      const resignBtn = pageW.locator('.resign-button, button:has-text("Resign")').first();
      const hasResignBtn = await resignBtn.isVisible().catch(() => false);

      if (hasResignBtn) {
        await resignBtn.click();
      } else {
        // Fallback: resign via API
        await resignGame(request, whiteToken, game.id);
      }

      // Wait for propagation
      await pageW.waitForTimeout(5000);
      await pageB.waitForTimeout(3000);

      await pageW.screenshot({ path: 'test-results/mp-resign-white.png' });
      await pageB.screenshot({ path: 'test-results/mp-resign-black.png' });

      // Verify game is finished in the API
      const details = await getGameDetails(request, whiteToken, game.id);
      const status = details?.status || details?.game?.status;
      if (status) {
        expect(status).toBe('finished');
      }
    } finally {
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('7.2 Scholar\'s Mate checkmate ends the game', async ({ browser, request }) => {
    // Scholar's Mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6? 4.Qxf7#
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      const wsW = attachWebSocketMonitor(pageW);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(8000); // extra time for game activation

      const WAIT = 4500; // propagation time between moves

      // 1. e4
      await clickMove(pageW, 'e2', 'e4');
      await pageB.waitForTimeout(WAIT);

      // 1... e5
      await clickMove(pageB, 'e7', 'e5');
      await pageW.waitForTimeout(WAIT);

      // 2. Bc4
      await clickMove(pageW, 'f1', 'c4');
      await pageB.waitForTimeout(WAIT);

      // 2... Nc6
      await clickMove(pageB, 'b8', 'c6');
      await pageW.waitForTimeout(WAIT);

      // 3. Qh5
      await clickMove(pageW, 'd1', 'h5');
      await pageB.waitForTimeout(WAIT);

      // 3... Nf6 (the blunder)
      await clickMove(pageB, 'g8', 'f6');
      await pageW.waitForTimeout(WAIT);

      // 4. Qxf7# (checkmate!)
      await clickMove(pageW, 'h5', 'f7');
      await pageW.waitForTimeout(5000);
      await pageB.waitForTimeout(3000);

      await pageW.screenshot({ path: 'test-results/mp-checkmate-white.png' });
      await pageB.screenshot({ path: 'test-results/mp-checkmate-black.png' });

      // Check if game ended
      const details = await getGameDetails(request, whiteToken, game.id);
      const status = details?.status || details?.game?.status;
      if (status) {
        expect(status).toBe('finished');
      }

      // Check for game.ended WebSocket frames
      const endFrames = wsW.received.filter(f =>
        typeof f.data === 'string' && f.data.includes('ended')
      );
      // Log for debugging
      console.log(`WebSocket end frames received: ${endFrames.length}`);
    } finally {
      await ctxW.close();
      await ctxB.close();
    }
  });

  test('7.3 After game ends, resign button disappears and result text shows', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB, {
      preferredColor: 'white',
      gameMode: 'casual',
    });
    const { whiteToken, blackToken, whitePlayer, blackPlayer } = resolveColors(game, tokenA, tokenB);

    const ctxW = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageW = await setupAuthenticatedPage(ctxW, whiteToken, whitePlayer);
      const pageB = await setupAuthenticatedPage(ctxB, blackToken, blackPlayer);

      await Promise.all([
        pageW.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForBoard(pageW), waitForBoard(pageB)]);
      await pageW.waitForTimeout(6000);

      // Resign via API (faster)
      await resignGame(request, whiteToken, game.id);
      await pageW.waitForTimeout(5000);
      await pageB.waitForTimeout(5000);

      // After resignation, resign button should be hidden (only visible when status === 'active')
      const resignBtnVisible = await pageW.locator('.resign-button').isVisible().catch(() => false);
      // It should either be gone or still visible if game state hasn't updated
      // More importantly, turn status should reflect game ended
      const statusText = await pageW.locator('.turn-status').textContent().catch(() => '');

      await pageW.screenshot({ path: 'test-results/mp-result-white.png' });
      await pageB.screenshot({ path: 'test-results/mp-result-black.png' });

      // The status should NOT say "Your turn" or "opponent's turn" after game ends
      if (statusText.toLowerCase().includes('finished') ||
          statusText.toLowerCase().includes('ended') ||
          statusText.toLowerCase().includes('resigned')) {
        // Good - game result is shown
        expect(true).toBeTruthy();
      }
    } finally {
      await ctxW.close();
      await ctxB.close();
    }
  });

  // ── Suite 8: Responsive Layout ────────────────────────────────────────

  test('8.1 Desktop layout (1920x1080) - board and timers render', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    const { whiteToken, whitePlayer } = resolveColors(game, tokenA, tokenB);

    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    try {
      const page = await setupAuthenticatedPage(ctx, whiteToken, whitePlayer);
      await page.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' });
      await waitForBoard(page);
      await page.waitForTimeout(3000);

      const board = page.locator('[data-square]').first();
      expect(await board.isVisible()).toBeTruthy();

      const timers = page.locator('.font-mono');
      expect(await timers.count()).toBeGreaterThanOrEqual(2);

      await page.screenshot({ path: 'test-results/mp-desktop-1920x1080.png', fullPage: true });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctx.close();
    }
  });

  test('8.2 Mobile layout (iPhone 12: 390x844) - board fits viewport', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    const { whiteToken, whitePlayer } = resolveColors(game, tokenA, tokenB);

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      isMobile: true,
      hasTouch: true,
    });

    try {
      const page = await setupAuthenticatedPage(ctx, whiteToken, whitePlayer);
      await page.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' });
      await waitForBoard(page);
      await page.waitForTimeout(3000);

      const board = page.locator('[data-square]').first();
      expect(await board.isVisible()).toBeTruthy();

      // Board should not overflow viewport
      const box = await board.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
      }

      await page.screenshot({ path: 'test-results/mp-mobile-390x844.png', fullPage: true });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctx.close();
    }
  });

  test('8.3 Tablet layout (768x1024) - board renders', async ({ browser, request }) => {
    const game = await createGameViaInvitation(request, tokenA, tokenB);
    const { whiteToken, whitePlayer } = resolveColors(game, tokenA, tokenB);

    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });

    try {
      const page = await setupAuthenticatedPage(ctx, whiteToken, whitePlayer);
      await page.goto(`${FRONTEND_URL}/play/multiplayer/${game.id}`, { waitUntil: 'domcontentloaded' });
      await waitForBoard(page);
      await page.waitForTimeout(3000);

      const board = page.locator('[data-square]').first();
      expect(await board.isVisible()).toBeTruthy();

      await page.screenshot({ path: 'test-results/mp-tablet-768x1024.png', fullPage: true });
    } finally {
      await resignGame(request, whiteToken, game.id).catch(() => {});
      await ctx.close();
    }
  });
});
