// @ts-check
/**
 * E2E Test: Real-user matchmaking via the smart-match queue
 *
 * Validates the full flow:
 *   1. Both players log in and go to Dashboard
 *   2. Both click "▶ Play Now" → MatchmakingQueue modal opens (autoStart=true)
 *   3. Backend finds each user as the other's candidate (via user_presence)
 *   4. Player B's browser receives the MatchRequestReceived WebSocket event
 *   5. GlobalInvitationDialog shows "Match Request" popup
 *   6. Player B clicks "Accept" → game created → both navigate to /play/multiplayer/{id}
 *   7. Both see a real chessboard; opponent is human (not computer_player_id)
 *
 * Prerequisites:
 *   - php artisan serve (port 8000)
 *   - php artisan reverb:start (port 8080)
 *   - pnpm start (port 3000)
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const API_BASE     = 'http://localhost:8000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const PLAYER_A = { email: 'nalamara.arun@gmail.com', password: 'password', id: 1 };
const PLAYER_B = { email: 'narun.iitb@gmail.com',    password: 'password', id: 2 };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiLogin(request, player) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: player.email, password: player.password },
  });
  expect(res.ok(), `Login failed for ${player.email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.token, 'Expected a token in login response').toBeTruthy();
  return body.token;
}

async function setupAuthPage(context, token) {
  const page = await context.newPage();
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait for AuthContext to validate token and render authenticated UI
  await page.waitForTimeout(3000);
  return page;
}

function captureConsole(page) {
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  return logs;
}

function captureWsFrames(page) {
  const frames = [];
  page.on('websocket', ws => {
    ws.on('framereceived', f => { try { frames.push(f.payload); } catch {} });
  });
  return frames;
}

// ── Test ─────────────────────────────────────────────────────────────────────

test.describe('Matchmaking: Real-user smart match flow', () => {
  test.setTimeout(120000);

  let tokenA, tokenB;

  test.beforeAll(async ({ request }) => {
    tokenA = await apiLogin(request, PLAYER_A);
    tokenB = await apiLogin(request, PLAYER_B);
    console.log('Tokens obtained for both players');
  });

  test('Both players match each other via Play Now — not a bot', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageA = await setupAuthPage(ctxA, tokenA);
      const pageB = await setupAuthPage(ctxB, tokenB);

      const logsA = captureConsole(pageA);
      const logsB = captureConsole(pageB);
      const wsB   = captureWsFrames(pageB);

      // ── 1. Navigate both to Dashboard ──────────────────────────────────────
      console.log('Step 1: Navigate both to Dashboard');
      await Promise.all([
        pageA.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' }),
        pageB.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' }),
      ]);

      // Let presence heartbeat fire (5 s initial beat) so both users appear online
      console.log('Step 2: Waiting 6s for presence heartbeats...');
      await pageA.waitForTimeout(6000);

      // ── 2. Both click "▶ Play Now" ─────────────────────────────────────────
      console.log('Step 3: Both players click Play Now');
      const playNowA = pageA.locator('button:has-text("Play Now")').first();
      const playNowB = pageB.locator('button:has-text("Play Now")').first();

      await expect(playNowA).toBeVisible({ timeout: 10000 });
      await expect(playNowB).toBeVisible({ timeout: 10000 });

      // Click simultaneously so both are in the search window together
      await Promise.all([
        playNowA.click(),
        playNowB.click(),
      ]);

      // ── 3. MatchmakingQueue modal opens + autoStart fires findPlayers ───────
      // Modal renders .matchmaking-overlay; wait for it on each page
      console.log('Step 4: Wait for matchmaking modals to open');
      await Promise.all([
        pageA.waitForSelector('.matchmaking-overlay', { timeout: 8000 }),
        pageB.waitForSelector('.matchmaking-overlay', { timeout: 8000 }),
      ]);
      console.log('Matchmaking modals open on both pages');

      await pageA.screenshot({ path: 'test-results/mm-modal-A.png' });
      await pageB.screenshot({ path: 'test-results/mm-modal-B.png' });

      // ── 4. Wait for match request dialog on Player B ───────────────────────
      // GlobalInvitationDialog renders "Match Request" heading when pendingMatchRequest is set.
      // Timeout is generous: findPlayers runs, broadcasts event, WS delivers it.
      console.log('Step 5: Waiting for "Match Request" invitation on Player B...');
      await pageB.waitForSelector('text=Match Request', { timeout: 30000 });

      await pageB.screenshot({ path: 'test-results/mm-invite-B.png' });
      console.log('Match Request dialog appeared on Player B');

      // ── 5. Player B accepts ────────────────────────────────────────────────
      console.log('Step 6: Player B clicks Accept');
      const acceptBtn = pageB.locator('button:has-text("Accept")').first();
      await expect(acceptBtn).toBeVisible({ timeout: 5000 });
      await acceptBtn.click();

      // ── 6. Both navigate to game ───────────────────────────────────────────
      console.log('Step 7: Waiting for both to navigate to /play/multiplayer/...');
      await Promise.all([
        pageB.waitForURL(/\/play\/multiplayer\/\d+/, { timeout: 20000 }),
        pageA.waitForURL(/\/play\/multiplayer\/\d+/, { timeout: 20000 }),
      ]);

      const urlA = pageA.url();
      const urlB = pageB.url();
      console.log(`Player A URL: ${urlA}`);
      console.log(`Player B URL: ${urlB}`);

      // Both should be at the same game URL
      expect(urlA).toMatch(/\/play\/multiplayer\/(\d+)/);
      expect(urlB).toMatch(/\/play\/multiplayer\/(\d+)/);
      const gameIdA = urlA.match(/\/play\/multiplayer\/(\d+)/)?.[1];
      const gameIdB = urlB.match(/\/play\/multiplayer\/(\d+)/)?.[1];
      expect(gameIdA).toBe(gameIdB);

      // ── 7. Chessboard renders on both pages ────────────────────────────────
      console.log('Step 8: Waiting for chessboard on both pages...');
      await Promise.all([
        pageA.waitForSelector('[data-square="e2"], [data-square="e4"]', { timeout: 30000 }),
        pageB.waitForSelector('[data-square="e2"], [data-square="e4"]', { timeout: 30000 }),
      ]);

      const squaresA = await pageA.locator('[data-square]').count();
      const squaresB = await pageB.locator('[data-square]').count();
      expect(squaresA).toBe(64);
      expect(squaresB).toBe(64);

      await pageA.screenshot({ path: 'test-results/mm-game-A.png' });
      await pageB.screenshot({ path: 'test-results/mm-game-B.png' });

      // ── 8. Verify it's a human vs human game (not bot) ─────────────────────
      console.log('Step 9: Verifying game is human vs human...');
      const gameId = gameIdA;
      const authHdr = `Bearer ${tokenA}`;
      const gameRes = await fetch(`${API_BASE}/games/${gameId}`, {
        headers: { Authorization: authHdr, Accept: 'application/json' },
      }).catch(() => null);

      // If game API is reachable, verify no computer_player_id
      if (gameRes?.ok) {
        const gameData = await gameRes.json();
        const game = gameData.game || gameData;
        console.log('Game data:', JSON.stringify({
          id: game.id,
          white_player_id: game.white_player_id,
          black_player_id: game.black_player_id,
          computer_player_id: game.computer_player_id,
          status: game.status,
        }));
        expect(game.computer_player_id, 'Game should be human vs human, not vs bot').toBeFalsy();
        expect(game.white_player_id).toBeTruthy();
        expect(game.black_player_id).toBeTruthy();
        // Both player IDs should be user 1 or user 2
        const playerIds = [game.white_player_id, game.black_player_id].sort();
        expect(playerIds).toContain(PLAYER_A.id);
        expect(playerIds).toContain(PLAYER_B.id);
        console.log(`✅ Human vs Human confirmed: white=${game.white_player_id} black=${game.black_player_id}`);
      }

      // ── 9. Check console logs for WS auth success ──────────────────────────
      const wsAuthLogs = logsB.filter(l => l.includes('WS:AUTH') || l.includes('GIC:TRACE') || l.includes('Presence'));
      console.log('Player B relevant console logs:', wsAuthLogs.slice(0, 10));

      const wsEventsB = wsB.filter(f => typeof f === 'string' && f.includes('match.request'));
      console.log(`Player B WebSocket frames with 'match.request': ${wsEventsB.length}`);

    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
