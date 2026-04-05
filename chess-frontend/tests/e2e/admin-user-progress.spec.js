// @ts-check
const { test, expect } = require('@playwright/test');

const FRONTEND_URL = process.env.BASE_URL || 'http://localhost:3000';

// --- Mock Data ---

const MOCK_ADMIN_USER = {
  id: 1,
  name: 'Admin User',
  email: 'ab@ameyem.com',
  rating: 1500,
  games_played: 120,
  peak_rating: 1600,
  roles: [{ id: 1, name: 'platform_admin' }],
  subscription_tier: 'gold',
  tutorial_xp: 0,
  tutorial_level: 1,
  email_notifications_enabled: true,
};

const MOCK_OVERVIEW = {
  overview: {
    total_users: 50,
    active_today: 5,
    active_week: 20,
    active_month: 40,
    total_games: 500,
    total_hours: 250,
    new_users: 3,
  },
  games_by_outcome: [
    { code: 'checkmate', label: 'Checkmate', count: 200 },
    { code: 'resignation', label: 'Resignation', count: 150 },
    { code: 'timeout', label: 'Timeout', count: 100 },
  ],
  games_by_mode: [
    { mode: 'rated', label: 'Rated', count: 350 },
    { mode: 'casual', label: 'Casual', count: 150 },
  ],
  games_by_time_control: [
    { minutes: 5, label: 'Blitz (5 min)', count: 200 },
    { minutes: 10, label: 'Rapid (10 min)', count: 200 },
    { minutes: 3, label: 'Bullet (3 min)', count: 100 },
  ],
  rating_distribution: [],
  tutorial_stats: { users_started: 10, total_completions: 5, mastered: 2 },
  users: {
    data: [
      { id: 10, name: 'Player One', email: 'player1@test.com', rating: 1350, games_played: 45, last_activity_at: '2026-03-30T12:00:00Z' },
      { id: 11, name: 'Player Two', email: 'player2@test.com', rating: 1200, games_played: 20, last_activity_at: '2026-03-29T08:00:00Z' },
      { id: 12, name: 'Player Three', email: 'player3@test.com', rating: 1500, games_played: 80, last_activity_at: '2026-03-28T16:00:00Z' },
    ],
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 3,
  },
  ambassador_stats: null,
  organizations: [],
  meta: { period: '30d', is_platform_admin: true },
};

const MOCK_USER_DETAIL = {
  profile: {
    id: 10,
    name: 'Player One',
    email: 'player1@test.com',
    rating: 1350,
    games_played: 45,
    created_at: '2026-01-15T10:00:00Z',
    last_activity_at: '2026-03-30T12:00:00Z',
    subscription_tier: 'free',
    organization_id: null,
    referral_code: 'PLAY1',
    referred_by_user_id: null,
  },
  overview: {
    total_games: 45,
    wins: 22,
    losses: 18,
    draws: 5,
    win_rate: 48.9,
    avg_moves: 35,
    streak: 'W2',
    recent_form: ['W', 'W', 'L', 'D', 'W', 'L', 'W', 'L', 'L', 'W'],
  },
  games_by_outcome: [
    { label: 'Checkmate', count: 18 },
    { label: 'Resignation', count: 15 },
    { label: 'Timeout', count: 8 },
    { label: 'Draw', count: 4 },
  ],
  games_by_mode: [
    { label: 'Rated', count: 35 },
    { label: 'Casual', count: 10 },
  ],
  games_by_time_control: [
    { label: 'Blitz (5 min)', count: 25 },
    { label: 'Rapid (10 min)', count: 15 },
    { label: 'Bullet (3 min)', count: 5 },
  ],
  recent_games: [
    { id: 100, white: { name: 'Player One', rating: 1340 }, black: { name: 'Opponent A', rating: 1300 }, result: '1-0', user_won: true, user_color: 'white', end_reason: 'Checkmate', game_mode: 'rated', move_count: 32, ended_at: '2026-03-30T11:00:00Z' },
    { id: 99, white: { name: 'Opponent B', rating: 1400 }, black: { name: 'Player One', rating: 1330 }, result: '1-0', user_won: false, user_color: 'black', end_reason: 'Resignation', game_mode: 'rated', move_count: 45, ended_at: '2026-03-29T15:00:00Z' },
  ],
  tutorial: { started: 3, completed: 2, mastered: 1 },
  meta: { period: '30d' },
};

const MOCK_PROGRESS = {
  rating_progression: [
    { date: '2026-03-01', rating: 1280, change: 12, games: 2 },
    { date: '2026-03-03', rating: 1295, change: 15, games: 3 },
    { date: '2026-03-05', rating: 1290, change: -5, games: 1 },
    { date: '2026-03-08', rating: 1310, change: 20, games: 2 },
    { date: '2026-03-10', rating: 1305, change: -5, games: 1 },
    { date: '2026-03-12', rating: 1320, change: 15, games: 2 },
    { date: '2026-03-15', rating: 1335, change: 15, games: 3 },
    { date: '2026-03-18', rating: 1330, change: -5, games: 1 },
    { date: '2026-03-20', rating: 1340, change: 10, games: 2 },
    { date: '2026-03-25', rating: 1350, change: 10, games: 2 },
    { date: '2026-03-30', rating: 1350, change: 0, games: 1 },
  ],
  points_per_day: [
    { date: '2026-03-01', points: 12, lost: 0, games: 2 },
    { date: '2026-03-03', points: 15, lost: 0, games: 3 },
    { date: '2026-03-05', points: 0, lost: -5, games: 1 },
    { date: '2026-03-08', points: 20, lost: 0, games: 2 },
    { date: '2026-03-10', points: 0, lost: -5, games: 1 },
    { date: '2026-03-12', points: 15, lost: 0, games: 2 },
    { date: '2026-03-15', points: 15, lost: 0, games: 3 },
    { date: '2026-03-18', points: 0, lost: -5, games: 1 },
    { date: '2026-03-20', points: 10, lost: 0, games: 2 },
    { date: '2026-03-25', points: 10, lost: 0, games: 2 },
    { date: '2026-03-30', points: 0, lost: 0, games: 1 },
  ],
  games_per_day: [
    { date: '2026-03-01', total: 2, wins: 1, draws: 0, losses: 1 },
    { date: '2026-03-03', total: 3, wins: 2, draws: 1, losses: 0 },
    { date: '2026-03-05', total: 1, wins: 0, draws: 0, losses: 1 },
    { date: '2026-03-08', total: 2, wins: 2, draws: 0, losses: 0 },
    { date: '2026-03-10', total: 1, wins: 0, draws: 1, losses: 0 },
    { date: '2026-03-12', total: 2, wins: 1, draws: 0, losses: 1 },
    { date: '2026-03-15', total: 3, wins: 2, draws: 0, losses: 1 },
    { date: '2026-03-18', total: 1, wins: 0, draws: 0, losses: 1 },
    { date: '2026-03-20', total: 2, wins: 1, draws: 1, losses: 0 },
    { date: '2026-03-25', total: 2, wins: 1, draws: 0, losses: 1 },
    { date: '2026-03-30', total: 1, wins: 1, draws: 0, losses: 0 },
  ],
  meta: { period: '30d', user_id: 10 },
};

const MOCK_PROGRESS_EMPTY = {
  rating_progression: [],
  points_per_day: [],
  games_per_day: [],
  meta: { period: '30d', user_id: 11 },
};

// --- Helpers ---

async function setupMockedAdminPage(page) {
  // Inject admin auth token
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'test-admin-token-e2e');
    window.localStorage.setItem('user', JSON.stringify({
      id: 1,
      name: 'Admin User',
      email: 'ab@ameyem.com',
      roles: [{ id: 1, name: 'platform_admin' }],
    }));
  });

  // Mock /api/user endpoint (AuthContext fetchUser)
  await page.route('**/api/user', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_USER) })
  );

  // Mock admin dashboard overview
  await page.route('**/api/admin/dashboard/overview**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_OVERVIEW) })
  );

  // Mock user detail endpoint
  await page.route('**/api/admin/dashboard/user/10?**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER_DETAIL) })
  );

  // Mock user detail for player with no data
  await page.route('**/api/admin/dashboard/user/11?**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...MOCK_USER_DETAIL,
      profile: { ...MOCK_USER_DETAIL.profile, id: 11, name: 'Player Two', email: 'player2@test.com', rating: 1200, games_played: 20 },
      overview: { ...MOCK_USER_DETAIL.overview, total_games: 20, wins: 8, losses: 10, draws: 2 },
    }) })
  );

  // Mock progress endpoint for player 10 (has data)
  await page.route('**/api/admin/dashboard/user/10/progress**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROGRESS) })
  );

  // Mock progress endpoint for player 11 (empty data)
  await page.route('**/api/admin/dashboard/user/11/progress**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROGRESS_EMPTY) })
  );

  // Catch WebSocket and Echo-related calls to prevent errors
  await page.route('**/broadcasting/**', route => route.abort());
  await page.route('**/api/user-status/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}

// --- Tests ---

test.describe('Admin Dashboard - User Progress Charts', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin can navigate to users tab and see user list', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for dashboard to load
    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });

    // Click Users tab
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Player Two')).toBeVisible();
    await expect(page.locator('text=Player Three')).toBeVisible();
  });

  test('clicking a user row opens UserDetailPanel', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });

    // Click on Player One row
    await page.locator('tr', { hasText: 'Player One' }).click();

    // UserDetailPanel should appear with profile data
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });
    // Check stats rendered
    await expect(page.locator('text=Win Rate')).toBeVisible();
  });

  test('Progress Graphs toggle is visible and collapsed by default', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await page.locator('tr', { hasText: 'Player One' }).click();

    // Wait for detail panel
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });

    // Progress Graphs button should be visible
    const chartsToggle = page.locator('button', { hasText: 'Progress Graphs' });
    await expect(chartsToggle).toBeVisible();

    // Charts should NOT be visible yet (collapsed)
    await expect(page.locator('text=Rating Progression')).not.toBeVisible();
    await expect(page.locator('text=Rating Points Per Day')).not.toBeVisible();
    await expect(page.locator('text=Games Played Per Day')).not.toBeVisible();
  });

  test('expanding Progress Graphs shows all three charts', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await page.locator('tr', { hasText: 'Player One' }).click();
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });

    // Click Progress Graphs toggle
    await page.locator('button', { hasText: 'Progress Graphs' }).click();

    // All three chart sections should appear
    await expect(page.locator('text=Rating Progression')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Rating Points Per Day')).toBeVisible();
    await expect(page.locator('text=Games Played Per Day')).toBeVisible();

    // recharts renders SVG elements — verify SVG containers exist
    const svgElements = page.locator('.recharts-wrapper svg');
    await expect(svgElements.first()).toBeVisible({ timeout: 5000 });

    // Rating chart should have a line path
    const ratingLine = page.locator('.recharts-line-curve');
    await expect(ratingLine).toBeVisible();

    // Games chart should have stacked bars
    const bars = page.locator('.recharts-bar-rectangle');
    expect(await bars.count()).toBeGreaterThan(0);
  });

  test('collapsing Progress Graphs hides the charts', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await page.locator('tr', { hasText: 'Player One' }).click();
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });

    // Expand
    await page.locator('button', { hasText: 'Progress Graphs' }).click();
    await expect(page.locator('text=Rating Progression')).toBeVisible({ timeout: 8000 });

    // Collapse
    await page.locator('button', { hasText: 'Progress Graphs' }).click();
    await expect(page.locator('text=Rating Progression')).not.toBeVisible();
  });

  test('empty data shows "No game data" message', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player Two')).toBeVisible({ timeout: 5000 });

    // Click on Player Two (has empty progress data)
    await page.locator('tr', { hasText: 'Player Two' }).click();
    await expect(page.locator('p:has-text("player2@test.com")')).toBeVisible({ timeout: 5000 });

    // Expand Progress Graphs
    await page.locator('button', { hasText: 'Progress Graphs' }).click();

    // Should show empty state message
    await expect(page.locator('text=No game data for this period')).toBeVisible({ timeout: 5000 });

    // Charts should NOT be visible
    await expect(page.locator('text=Rating Progression')).not.toBeVisible();
  });

  test('charts have correct recharts elements and legend', async ({ page }) => {
    await setupMockedAdminPage(page);
    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await page.locator('tr', { hasText: 'Player One' }).click();
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });

    await page.locator('button', { hasText: 'Progress Graphs' }).click();
    await expect(page.locator('text=Rating Progression')).toBeVisible({ timeout: 8000 });

    // Rating Points chart should have a Legend with Gained, Lost
    const legends = page.locator('.recharts-legend-wrapper');
    await expect(legends.first()).toBeVisible();
    await expect(legends.first().locator('text=Gained')).toBeVisible();
    await expect(legends.first().locator('text=Lost')).toBeVisible();

    // Games chart should have a Legend with Wins, Draws, Losses
    await expect(legends.last().locator('text=Wins')).toBeVisible();
    await expect(legends.last().locator('text=Draws')).toBeVisible();
    await expect(legends.last().locator('text=Losses')).toBeVisible();

    // X-axis should render tick labels (recharts uses <tspan> inside <text> for axis labels)
    const xAxisTicks = page.locator('.recharts-cartesian-axis-tick');
    expect(await xAxisTicks.count()).toBeGreaterThan(0);
  });

  test('switching period re-fetches progress data', async ({ page }) => {
    let progressCallCount = 0;

    await setupMockedAdminPage(page);

    // Override progress route to count calls
    await page.route('**/api/admin/dashboard/user/10/progress**', route => {
      progressCallCount++;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROGRESS) });
    });

    await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
    await page.click('text=Users');
    await expect(page.locator('text=Player One')).toBeVisible({ timeout: 5000 });
    await page.locator('tr', { hasText: 'Player One' }).click();
    await expect(page.locator('p:has-text("player1@test.com")')).toBeVisible({ timeout: 5000 });

    // Expand charts — first fetch
    await page.locator('button', { hasText: 'Progress Graphs' }).click();
    await expect(page.locator('text=Rating Progression')).toBeVisible({ timeout: 8000 });

    const callsAfterExpand = progressCallCount;
    expect(callsAfterExpand).toBeGreaterThanOrEqual(1);

    // Switch period to 7 Days using the period buttons inside UserDetailPanel
    const periodButtons = page.locator('button', { hasText: '7 Days' });
    // There may be two period filters (overview + user detail) — click the second one (inside detail panel)
    const detailPeriodBtn = periodButtons.last();
    await detailPeriodBtn.click();

    // Wait for re-fetch
    await page.waitForTimeout(1000);

    // Should have made another fetch call
    expect(progressCallCount).toBeGreaterThan(callsAfterExpand);
  });
});
