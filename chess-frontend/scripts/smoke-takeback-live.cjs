#!/usr/bin/env node
/**
 * Live takeback (undo) smoke test against a deployed Chess99 backend.
 *
 * Drives the real HTTP API and the real Reverb (Pusher protocol) socket, and
 * asserts on the events each client RECEIVES and on the persisted game state -
 * an HTTP 200 alone is not proof of delivery (see STATUS.md, 2026-09-02).
 *
 * Legs:
 *   synthetic  one account vs a synthetic bot: e4 e5, request undo ->
 *              server auto-accepts, socket gets game.undo.accepted, board reset.
 *   pair       two accounts, two sockets: request -> opponent socket gets
 *              game.undo.request -> accept -> both sockets get
 *              game.undo.accepted; then request -> decline -> requester gets
 *              game.undo.declined and the position is kept.
 *
 * Every game it creates is casual (no rating change) and is resigned at the end.
 *
 * Env:
 *   CHESS99_TEST_EMAIL / CHESS99_TEST_PASSWORD      account A (required)
 *   CHESS99_SMOKE_B_EMAIL / CHESS99_SMOKE_B_PASSWORD account B (pair leg only)
 *   CHESS99_API_BASE   default https://api.chess99.com/api
 *   CHESS99_WS_HOST    default api.chess99.com
 *   REACT_APP_REVERB_APP_KEY  default: read from chess-frontend/.env.production
 *
 * Usage: node scripts/smoke-takeback-live.cjs [synthetic|pair|all]
 * Exit code 0 = every leg that ran passed; 1 = a failure; 2 = a leg was skipped
 * for missing prerequisites (e.g. no account B) and nothing failed.
 */
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const API_BASE = process.env.CHESS99_API_BASE || 'https://api.chess99.com/api';
const WS_HOST = process.env.CHESS99_WS_HOST || 'api.chess99.com';
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EVENT_TIMEOUT_MS = 15000;

function reverbKey() {
  if (process.env.REACT_APP_REVERB_APP_KEY) return process.env.REACT_APP_REVERB_APP_KEY;
  const envFile = path.join(__dirname, '..', '.env.production');
  const match = fs.readFileSync(envFile, 'utf8').match(/^REACT_APP_REVERB_APP_KEY=(.*)$/m);
  if (!match || !match[1].trim()) throw new Error('REACT_APP_REVERB_APP_KEY not found');
  return match[1].trim();
}

const results = [];
function check(leg, name, ok, detail = '') {
  results.push({ leg, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` - ${detail}` : ''}`);
  return ok;
}

async function api(token, method, url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

async function login(email, password) {
  const res = await api(null, 'POST', '/auth/login', { email, password });
  if (res.status !== 200 || !res.json?.token) {
    throw new Error(`login failed for account (HTTP ${res.status}): ${res.json?.message || ''}`);
  }
  return { token: res.json.token, user: res.json.user };
}

/** Minimal Pusher-protocol client: connect, auth + subscribe, collect events. */
class ReverbClient {
  constructor(label, token) {
    this.label = label;
    this.token = token;
    this.events = [];
    this.waiters = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://${WS_HOST}/app/${reverbKey()}?protocol=7&client=js&version=8.4.0&flash=false`;
      this.ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error(`${this.label}: socket connect timeout`)), EVENT_TIMEOUT_MS);
      this.ws.on('error', (err) => { clearTimeout(timer); reject(err); });
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        let data = msg.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* keep string */ } }
        if (msg.event === 'pusher:connection_established') {
          clearTimeout(timer);
          this.socketId = data.socket_id;
          resolve(this.socketId);
          return;
        }
        if (msg.event === 'pusher:ping') {
          this.ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
          return;
        }
        const event = { event: msg.event, channel: msg.channel, data, at: Date.now() };
        this.events.push(event);
        this.waiters = this.waiters.filter((w) => {
          if (!w.match(event)) return true;
          clearTimeout(w.timer);
          w.resolve(event);
          return false;
        });
      });
    });
  }

  async subscribe(channel) {
    const auth = await api(this.token, 'POST', '/websocket/broadcasting/auth', {
      socket_id: this.socketId,
      channel_name: channel,
    });
    if (auth.status !== 200 || !auth.json?.auth) {
      throw new Error(`${this.label}: channel auth failed (HTTP ${auth.status})`);
    }
    const subscribed = this.waitFor((e) => e.event === 'pusher_internal:subscription_succeeded' && e.channel === channel);
    this.ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel, auth: auth.json.auth } }));
    await subscribed;
  }

  /** Resolve with the first matching event received from now (or already seen since `since`). */
  waitFor(match, { since = Infinity, timeoutMs = EVENT_TIMEOUT_MS } = {}) {
    const seen = this.events.find((e) => e.at >= since && match(e));
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve) => {
      const waiter = { match, resolve };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(null);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const isEvent = (suffix) => (e) => e.event === suffix || e.event === `.${suffix}`;

async function gameState(token, gameId) {
  const res = await api(token, 'GET', `/games/${gameId}`);
  const game = res.json?.game || res.json?.data || res.json;
  return {
    status: res.status,
    fen: game?.fen,
    moveCount: Number(game?.move_count ?? (Array.isArray(game?.moves) ? game.moves.length : NaN)),
    turn: game?.turn,
  };
}

async function sendMove(client, gameId, from, to, san) {
  return api(client.token, 'POST', `/websocket/games/${gameId}/move`, {
    move: { from, to, promotion: null, san, uci: `${from}${to}` },
    socket_id: client.socketId,
  });
}

async function resign(token, gameId, leg) {
  const res = await api(token, 'POST', `/games/${gameId}/resign`, {});
  check(leg, `cleanup: resigned game ${gameId}`, res.status === 200, `HTTP ${res.status}`);
}

async function syntheticLeg() {
  const leg = 'synthetic';
  const a = await login(process.env.CHESS99_TEST_EMAIL, process.env.CHESS99_TEST_PASSWORD);
  check(leg, 'account A logged in', true, `user_id=${a.user?.id}`);

  // Registered only in routes/api_v1.php.
  const bots = await api(a.token, 'GET', '/v1/synthetic-players');
  const bot = (bots.json?.data || [])[0];
  if (!check(leg, 'synthetic player available', !!bot, `HTTP ${bots.status}`)) return;

  const created = await api(a.token, 'POST', '/games/computer', {
    player_color: 'white',
    computer_level: bot.computer_level || 1,
    synthetic_player_id: bot.id,
    game_mode: 'casual',
  });
  const game = created.json?.game;
  if (!check(leg, 'casual synthetic game created', created.status === 200 && game?.id,
    `HTTP ${created.status} ${created.json?.error || ''}`)) return;
  const gameId = game.id;
  console.log(`      game ${gameId} vs ${bot.name} (mode=${game.game_mode}, undo_white_remaining=${game.undo_white_remaining})`);

  const client = new ReverbClient('A', a.token);
  try {
    await client.connect();
    await client.subscribe(`private-game.${gameId}`);
    check(leg, 'socket subscribed to private-game channel', true, `socket_id=${client.socketId}`);

    const m1 = await sendMove(client, gameId, 'e2', 'e4', 'e4');
    check(leg, 'human move e4 accepted', m1.status === 200, `HTTP ${m1.status}`);
    const m2 = await api(a.token, 'POST', `/websocket/games/${gameId}/synthetic-move`, {
      move: { from: 'e7', to: 'e5', san: 'e5', uci: 'e7e5', is_mate_hint: false, is_check: false, is_stalemate: false },
    });
    check(leg, 'synthetic move e5 recorded', m2.status === 200, `HTTP ${m2.status} ${m2.json?.error || ''}`);

    const since = Date.now();
    const undo = await api(a.token, 'POST', `/websocket/games/${gameId}/undo/request`, {});
    check(leg, 'undo request answered by server (auto_accepted)',
      undo.status === 200 && undo.json?.auto_accepted === true,
      `HTTP ${undo.status} auto_accepted=${undo.json?.auto_accepted} ${undo.json?.message || ''}`);

    const accepted = await client.waitFor(isEvent('game.undo.accepted'), { since });
    check(leg, 'socket received game.undo.accepted', !!accepted,
      accepted ? `after ${accepted.at - since}ms, accepted_by_synthetic=${accepted.data?.accepted_by_synthetic}` : 'no event within 15s');
    if (accepted) {
      check(leg, 'event carries the starting position', accepted.data?.fen === STARTING_FEN, accepted.data?.fen);
    }
    check(leg, 'no game.undo.request broadcast for a bot game',
      !client.events.some((e) => e.at >= since && isEvent('game.undo.request')(e)));

    const state = await gameState(a.token, gameId);
    check(leg, 'persisted game reset to start (fen, 0 moves, white to move)',
      state.fen === STARTING_FEN && state.moveCount === 0 && state.turn === 'white',
      `fen=${state.fen} move_count=${state.moveCount} turn=${state.turn}`);

    const again = await api(a.token, 'POST', `/websocket/games/${gameId}/undo/request`, {});
    check(leg, 'undo with no moves is refused', again.status === 400, `HTTP ${again.status} ${again.json?.message || ''}`);
  } finally {
    client.close();
    await resign(a.token, gameId, leg);
  }
}

async function pairLeg() {
  const leg = 'pair';
  const a = await login(process.env.CHESS99_TEST_EMAIL, process.env.CHESS99_TEST_PASSWORD);
  const b = await login(process.env.CHESS99_SMOKE_B_EMAIL, process.env.CHESS99_SMOKE_B_PASSWORD);
  check(leg, 'accounts A and B logged in', a.user?.id !== b.user?.id, `A=${a.user?.id} B=${b.user?.id}`);

  const created = await api(a.token, 'POST', '/games', { opponent_id: b.user.id, game_mode: 'casual' });
  const game = created.json?.game || created.json;
  if (!check(leg, 'game A vs B created', [200, 201].includes(created.status) && game?.id,
    `HTTP ${created.status} ${created.json?.error || ''}`)) return;
  const gameId = game.id;

  const byId = { [a.user.id]: a, [b.user.id]: b };
  const white = new ReverbClient('white', byId[game.white_player_id].token);
  const black = new ReverbClient('black', byId[game.black_player_id].token);
  try {
    if (!check(leg, 'game is casual (undo allowed)', game.game_mode !== 'rated', `mode=${game.game_mode}`)) return;

    await Promise.all([white.connect(), black.connect()]);
    await Promise.all([white.subscribe(`private-game.${gameId}`), black.subscribe(`private-game.${gameId}`)]);
    check(leg, 'both sockets subscribed', true);

    const playOpening = async () => {
      const w = await sendMove(white, gameId, 'e2', 'e4', 'e4');
      const bl = await sendMove(black, gameId, 'e7', 'e5', 'e5');
      return w.status === 200 && bl.status === 200;
    };

    // Round 1: request -> accept
    check(leg, 'opening e4 e5 played', await playOpening());
    let since = Date.now();
    const req = await api(white.token, 'POST', `/websocket/games/${gameId}/undo/request`, {});
    check(leg, 'white requested undo', req.status === 200 && req.json?.success === true,
      `HTTP ${req.status} ${req.json?.message || ''}`);
    const heard = await black.waitFor(isEvent('game.undo.request'), { since });
    check(leg, 'black socket received game.undo.request', !!heard,
      heard ? `after ${heard.at - since}ms, expires_at=${heard.data?.expires_at}` : 'no event within 15s');

    since = Date.now();
    const acc = await api(black.token, 'POST', `/websocket/games/${gameId}/undo/accept`, {});
    check(leg, 'black accepted undo', acc.status === 200 && acc.json?.success !== false,
      `HTTP ${acc.status} ${acc.json?.message || ''}`);
    const [wAcc, bAcc] = await Promise.all([
      white.waitFor(isEvent('game.undo.accepted'), { since }),
      black.waitFor(isEvent('game.undo.accepted'), { since }),
    ]);
    check(leg, 'white socket received game.undo.accepted', !!wAcc, wAcc ? `fen=${wAcc.data?.fen}` : 'none within 15s');
    check(leg, 'black socket received game.undo.accepted', !!bAcc, bAcc ? `fen=${bAcc.data?.fen}` : 'none within 15s');
    let state = await gameState(white.token, gameId);
    check(leg, 'persisted game reset to start after accept',
      state.fen === STARTING_FEN && state.moveCount === 0,
      `fen=${state.fen} move_count=${state.moveCount}`);

    // Round 2: request -> decline
    check(leg, 'opening replayed', await playOpening());
    const before = await gameState(white.token, gameId);
    since = Date.now();
    const req2 = await api(white.token, 'POST', `/websocket/games/${gameId}/undo/request`, {});
    check(leg, 'white requested undo again', req2.status === 200, `HTTP ${req2.status} ${req2.json?.message || ''}`);
    await black.waitFor(isEvent('game.undo.request'), { since });
    since = Date.now();
    const dec = await api(black.token, 'POST', `/websocket/games/${gameId}/undo/decline`, {});
    check(leg, 'black declined undo', dec.status === 200, `HTTP ${dec.status} ${dec.json?.message || ''}`);
    const wDec = await white.waitFor(isEvent('game.undo.declined'), { since });
    check(leg, 'white socket received game.undo.declined', !!wDec, wDec ? '' : 'none within 15s');
    state = await gameState(white.token, gameId);
    check(leg, 'position kept after decline',
      state.fen === before.fen && state.moveCount === before.moveCount,
      `move_count=${state.moveCount}`);
  } finally {
    white.close();
    black.close();
    await resign(a.token, gameId, leg);
  }
}

(async () => {
  const which = process.argv[2] || 'all';
  let skipped = false;
  if (!process.env.CHESS99_TEST_EMAIL || !process.env.CHESS99_TEST_PASSWORD) {
    console.error('CHESS99_TEST_EMAIL / CHESS99_TEST_PASSWORD are required');
    process.exit(1);
  }
  console.log(`Takeback smoke against ${API_BASE} / wss://${WS_HOST} at ${new Date().toISOString()}`);

  for (const [name, run] of [['synthetic', syntheticLeg], ['pair', pairLeg]]) {
    if (which !== 'all' && which !== name) continue;
    if (name === 'pair' && (!process.env.CHESS99_SMOKE_B_EMAIL || !process.env.CHESS99_SMOKE_B_PASSWORD)) {
      console.log('SKIP [pair] CHESS99_SMOKE_B_EMAIL / CHESS99_SMOKE_B_PASSWORD not set - needs a second account');
      skipped = true;
      continue;
    }
    try {
      await run();
    } catch (err) {
      check(name, 'leg completed without error', false, err.message);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed${skipped ? ' (pair leg skipped)' : ''}`);
  // exitCode, not exit(): exiting with fetch sockets still open trips a libuv assertion on Windows.
  process.exitCode = failed ? 1 : skipped ? 2 : 0;
})();
