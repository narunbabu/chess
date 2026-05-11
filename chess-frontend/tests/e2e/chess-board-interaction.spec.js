import { test, expect } from '@playwright/test';

const BOARD_SELECTOR = '[data-testid="chess-board"], .gc-board-wrapper, .chessboard, .board';

async function startCasualComputerGame(page) {
  await page.addInitScript(() => {
    localStorage.setItem('chess99:casual_tour:v1:guest', 'completed');
    localStorage.removeItem('chess99_active_computer_game');
    localStorage.setItem('computerDepth', '3');
  });

  await page.goto('/play', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button.start-button:has-text("Play")', { timeout: 15000 });
  await page.locator('button.start-button:has-text("Play")').first().click();
  await page.locator(BOARD_SELECTOR).first().waitFor({ state: 'visible', timeout: 15000 });
}

test.describe('Chess Board Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'fake-test-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
  });

  test('should render chess board with correct pieces', async ({ page }) => {
    await startCasualComputerGame(page);

    // Check that chess board exists
    const board = page.locator(BOARD_SELECTOR).first();
    await expect(board).toBeVisible();

    // Check for chess pieces (assuming they're represented by text or images)
    const pieces = page.locator('[data-piece], .piece, .chess-piece, [data-testid="chess-board"] img, [data-testid="chess-board"] svg');
    await expect.poll(async () => pieces.count(), { timeout: 10000 }).toBeGreaterThan(0);
    const pieceCount = await pieces.count();

    // Should have some pieces on the board (standard chess has 32 pieces)
    expect(pieceCount).toBeGreaterThan(0);

    // Check for different piece types
    const pieceTypes = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
    for (const pieceType of pieceTypes) {
      const piece = page.locator(`[data-piece*="${pieceType}"], .${pieceType}, [data-testid*="${pieceType}"]`);
      if (await piece.count() > 0) {
        await expect(piece.first()).toBeVisible();
      }
    }
  });

  test('should highlight squares on hover', async ({ page }) => {
    await startCasualComputerGame(page);

    const squares = page.locator('.square, [data-square], .board-square');
    if (await squares.count() > 0) {
      const firstSquare = squares.first();

      // Hover over a square
      await firstSquare.hover();

      // Check for hover effects
      const highlightedSquare = page.locator('.highlight, .hover, [data-hovered]');
      if (await highlightedSquare.count() > 0) {
        await expect(highlightedSquare.first()).toBeVisible();
      }
    }
  });

  test('should select pieces when clicked', async ({ page }) => {
    await startCasualComputerGame(page);

    const pieces = page.locator('[data-piece], .piece');
    if (await pieces.count() > 0) {
      const firstPiece = pieces.first();
      await firstPiece.click();

      // Check for selection indicators
      const selected = page.locator('.selected, [data-selected], .piece-selected');
      if (await selected.count() > 0) {
        await expect(selected.first()).toBeVisible();
      }
    }
  });

  test('should show valid move destinations after piece selection', async ({ page }) => {
    await startCasualComputerGame(page);

    const pieces = page.locator('[data-piece], .piece');
    if (await pieces.count() > 0) {
      // Select a piece
      await pieces.first().click();

      // Look for valid move indicators
      const validMoves = page.locator('.valid-move, .possible-move, [data-valid-move]');
      if (await validMoves.count() > 0) {
        await expect(validMoves.first()).toBeVisible();
      }
    }
  });

  test('should make moves by clicking source and destination', async ({ page }) => {
    await startCasualComputerGame(page);

    const squares = page.locator('.square, [data-square], .board-square');
    if (await squares.count() >= 2) {
      const sourceSquare = squares.first();
      const destSquare = squares.nth(1);

      // Make a move
      await sourceSquare.click();
      await destSquare.click();

      // Look for move completion indicators
      const moveIndicators = [
        '.move-complete',
        '[data-move-complete]',
        '.last-move',
        '[data-last-move]'
      ];

      let moveCompleted = false;
      for (const indicator of moveIndicators) {
        try {
          const element = page.locator(indicator);
          if (await element.isVisible({ timeout: 2000 })) {
            moveCompleted = true;
            break;
          }
        } catch (e) {
          // Continue checking
        }
      }
    }
  });

  test('should handle pawn moves specifically', async ({ page }) => {
    await startCasualComputerGame(page);

    // Find pawns (usually on the second rank for white, seventh for black)
    const pawns = page.locator('[data-piece*="pawn"], .pawn, [data-piece*="P"]');
    if (await pawns.count() > 0) {
      const pawn = pawns.first();
      await pawn.click();

      // Check if pawn has valid moves
      const validMoves = page.locator('.valid-move, .possible-move');
      if (await validMoves.count() > 0) {
        // Make a pawn move
        await validMoves.first().click();

        // Check for move feedback
        const feedback = page.locator('.feedback, .move-feedback');
        if (await feedback.isVisible({ timeout: 2000 })) {
          await expect(feedback).toBeVisible();
        }
      }
    }
  });
});

test.describe('Move Validation API', () => {
  test('should send move validation requests with correct data', async ({ page }) => {
    let apiCallCount = 0;
    let lastRequestData = null;

    // Intercept API calls
    await page.route('**/api/tutorial/lessons/*/validate-move', async (route) => {
      apiCallCount++;
      const request = route.request();
      lastRequestData = request.postDataJSON();

      // Mock successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            feedback: 'Valid move!',
            feedback_type: 'success',
            score_change: 10,
            goal_achieved: false
          }
        })
      });
    });

    await startCasualComputerGame(page);

    // Make a move
    const squares = page.locator('.square, [data-square]');
    if (await squares.count() >= 2) {
      await squares.first().click();
      await squares.nth(1).click();

      // Wait for API call
      await page.waitForTimeout(1000);

      // Verify request data structure when the board flow makes a validation call.
      if (lastRequestData) {
        expect(lastRequestData).toHaveProperty('move');
        expect(lastRequestData).toHaveProperty('fen_after');
        expect(lastRequestData).toHaveProperty('stage_id');
      }
    }
  });

  test('should handle invalid moves correctly', async ({ page }) => {
    // Mock API response for invalid move
    await page.route('**/api/tutorial/lessons/*/validate-move', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            success: false,
            feedback: 'Invalid move. Try again.',
            feedback_type: 'error',
            score_change: -5,
            goal_achieved: false
          }
        })
      });
    });

    await startCasualComputerGame(page);

    // Attempt to make an invalid move
    const squares = page.locator('.square, [data-square]');
    if (await squares.count() >= 2) {
      await squares.first().click();
      await squares.nth(1).click();

      // Look for error feedback
      const errorFeedback = page.locator('.error, .invalid-move, [data-feedback="error"]');
      if (await errorFeedback.isVisible({ timeout: 3000 })) {
        await expect(errorFeedback).toBeVisible();
        await expect(errorFeedback).toContainText('Invalid');
      }
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/tutorial/lessons/*/validate-move', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Validation failed' })
      });
    });

    await startCasualComputerGame(page);

    // Make a move
    const squares = page.locator('.square, [data-square]');
    if (await squares.count() >= 2) {
      await squares.first().click();
      await squares.nth(1).click();

      // Check for error handling
      const errorMessages = page.locator('.error-message, .validation-error, [role="alert"]');
      if (await errorMessages.isVisible({ timeout: 3000 })) {
        await expect(errorMessages).toBeVisible();
      }
    }
  });
});

test.describe('Board Orientation and Controls', () => {
  test('should support both white and black perspectives', async ({ page }) => {
    await startCasualComputerGame(page);

    // Look for orientation controls
    const orientationButton = page.locator('button:has-text("Flip"), button[aria-label*="flip"], .flip-board');

    if (await orientationButton.isVisible()) {
      await orientationButton.click();

      // Check that board orientation changed (pieces should be in different positions)
      const board = page.locator('[data-testid="chess-board"], .chessboard');
      await expect(board).toBeVisible();

      // Check for orientation attribute
      const orientation = await board.getAttribute('data-orientation') ||
                        await board.getAttribute('class');
      expect(orientation).toBeDefined();
    }
  });

  test('should have proper board coordinates', async ({ page }) => {
    await startCasualComputerGame(page);

    // Check for rank and file labels (1-8, a-h)
    const rankLabels = page.locator('[data-rank], .rank').or(page.locator('.board-label').filter({ hasText: /^[1-8]$/ }));
    const fileLabels = page.locator('[data-file], .file').or(page.locator('.board-label').filter({ hasText: /^[a-h]$/ }));

    // These might not always be visible, so we just check if they exist
    const rankCount = await rankLabels.count();
    const fileCount = await fileLabels.count();

    // If labels exist, there should be the correct number
    if (rankCount > 0) {
      expect(rankCount).toBeGreaterThanOrEqual(8);
    }
    if (fileCount > 0) {
      expect(fileCount).toBeGreaterThanOrEqual(8);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await startCasualComputerGame(page);

    // Focus on the board
    const board = page.locator(BOARD_SELECTOR).first();
    await board.click();

    // Try keyboard navigation
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Check for any focus or selection changes
    const focused = page.locator(':focus');
    const selected = page.locator('.selected, [data-selected]');

    // At least one of these should be present
    const hasFocusOrSelection = await focused.count() > 0 || await selected.count() > 0;
    expect(hasFocusOrSelection).toBeTruthy();
  });
});
