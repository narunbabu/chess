# Laravel Visualizer Security Guide

## Recommended Approach: Laravel Middleware

Use Laravel's built-in middleware system for robust authentication.

## Option 1: Custom Admin Middleware (Recommended)

### Step 1: Create Middleware

```bash
cd chess-backend
php artisan make:middleware AdminAuthMiddleware
```

### Step 2: Edit `app/Http/Middleware/AdminAuthMiddleware.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Allow access in local development
        if (config('app.env') === 'local') {
            return $next($request);
        }

        // Check for admin token in various places
        $token = $request->header('X-Admin-Token')
                 ?? $request->query('token')
                 ?? $request->input('token')
                 ?? $request->bearerToken();

        $adminToken = config('app.admin_token');

        // Validate token
        if (empty($adminToken) || $token !== $adminToken) {
            // Log unauthorized attempt
            \Log::warning('Unauthorized admin access attempt', [
                'ip' => $request->ip(),
                'url' => $request->fullUrl(),
                'user_agent' => $request->userAgent(),
            ]);

            // Return 403 for API requests
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'Admin access required'
                ], 403);
            }

            // Return HTML for browser requests
            abort(403, 'Forbidden - Admin access required');
        }

        return $next($request);
    }
}
```

### Step 3: Register Middleware

**Edit `app/Http/Kernel.php`:**

```php
<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    // ...

    /**
     * The application's route middleware.
     */
    protected $middlewareAliases = [
        // ... existing middleware
        'admin.auth' => \App\Http\Middleware\AdminAuthMiddleware::class,
    ];
}
```

Or if using Laravel 11+ (`bootstrap/app.php`):

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin.auth' => \App\Http\Middleware\AdminAuthMiddleware::class,
        ]);
    })
    // ...
    ->create();
```

### Step 4: Protect Routes

**Edit `routes/web.php`:**

```php
<?php

use Illuminate\Support\Facades\Route;

// Protect the visualizer HTML page
Route::middleware('admin.auth')->group(function () {
    Route::get('/tournament_db_visualizer.html', function () {
        return response()->file(public_path('tournament_db_visualizer.html'));
    });
});
```

**Edit `routes/api.php`:**

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TournamentController;

// Protect admin API endpoints
Route::middleware('admin.auth')->group(function () {
    Route::post('/championships/{id}/generate-tournament', [TournamentController::class, 'generateTournament']);

    // Add other admin routes here
    Route::get('/championships/{id}/tournament', [TournamentController::class, 'getTournament']);
});
```

### Step 5: Update Frontend to Send Token

**Edit `public/tournament_db_visualizer.html`:**

Add token management at the top of the script section:

```javascript
// Admin token management
let ADMIN_TOKEN = null;

function getAdminToken() {
    if (!ADMIN_TOKEN) {
        // Check if running in production
        const isProduction = !window.location.hostname.includes('localhost') &&
                            !window.location.hostname.includes('127.0.0.1');

        if (isProduction) {
            ADMIN_TOKEN = sessionStorage.getItem('admin_token');
            if (!ADMIN_TOKEN) {
                ADMIN_TOKEN = prompt('Enter admin access token:');
                if (!ADMIN_TOKEN) {
                    throw new Error('Admin token required');
                }
                sessionStorage.setItem('admin_token', ADMIN_TOKEN);
            }
        }
    }
    return ADMIN_TOKEN;
}

// Update all fetch calls to include token
async function loadAllChampionships() {
    try {
        const token = getAdminToken();
        const headers = {};
        if (token) {
            headers['X-Admin-Token'] = token;
        }

        const response = await fetch('/api/championships', { headers });
        // ... rest of code
    } catch (error) {
        if (error.message.includes('403')) {
            sessionStorage.removeItem('admin_token');
            ADMIN_TOKEN = null;
            alert('Invalid admin token. Please refresh and try again.');
        }
        console.error('Error:', error);
    }
}

async function generateTournamentForChampionship() {
    try {
        const token = getAdminToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['X-Admin-Token'] = token;
        }

        const response = await fetch(`/api/championships/${selectedChampionshipId}/generate-tournament`, {
            method: 'POST',
            headers: headers
        });

        if (response.status === 403) {
            sessionStorage.removeItem('admin_token');
            ADMIN_TOKEN = null;
            alert('Invalid admin token. Please refresh and try again.');
            return;
        }

        // ... rest of code
    } catch (error) {
        console.error('Error:', error);
    }
}
```

### Step 6: Add Environment Variables

**Local `.env`:**
```env
ADMIN_TOKEN=local-development-token
```

**Production `.env` (set in Render):**
```env
ADMIN_TOKEN=your-secure-random-production-token-here
```

**Generate secure token:**
```bash
# Use Laravel to generate secure token
php artisan tinker
>>> Str::random(64)
=> "abc123xyz456..." # Use this as your ADMIN_TOKEN
```

### Step 7: Add to Config

**Edit `config/app.php`:**

```php
<?php

return [
    // ... existing config

    /*
    |--------------------------------------------------------------------------
    | Admin Token
    |--------------------------------------------------------------------------
    |
    | This token is used to authenticate admin operations like accessing
    | the tournament visualizer and administrative API endpoints.
    |
    */

    'admin_token' => env('ADMIN_TOKEN'),
];
```

## Option 2: Simple HTML Token Guard (Quick Setup)

If you don't want to create middleware, add this to `public/tournament_db_visualizer.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Tournament Database Visualizer</title>
    <style>
        /* ... existing styles ... */
    </style>
</head>
<body>

<!-- Add this script FIRST, before any other scripts -->
<script>
(function() {
    const isProduction = !window.location.hostname.includes('localhost') &&
                        !window.location.hostname.includes('127.0.0.1');

    if (isProduction) {
        const stored = sessionStorage.getItem('admin_verified');
        if (!stored) {
            // Prompt for token
            const token = prompt('🔒 Enter admin access token:');

            // Replace this with your actual secure token
            // Generate a random token: php artisan tinker >>> Str::random(32)
            const correctToken = 'YOUR_SECURE_TOKEN_HERE';

            if (token !== correctToken) {
                document.body.innerHTML = `
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    ">
                        <div style="
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            text-align: center;
                        ">
                            <h1 style="color: #e74c3c; margin: 0 0 20px 0;">
                                🚫 Access Denied
                            </h1>
                            <p style="color: #7f8c8d; margin: 0;">
                                You are not authorized to access this resource.
                            </p>
                        </div>
                    </div>
                `;
                throw new Error('Unauthorized access attempt');
            }

            // Store verification
            sessionStorage.setItem('admin_verified', 'true');
        }
    }
})();
</script>

<!-- Rest of your visualizer HTML -->
<!-- ... -->

</body>
</html>
```

## Option 3: IP Whitelist (Advanced)

Add IP whitelisting to your middleware:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminAuthMiddleware
{
    /**
     * Whitelisted IP addresses
     */
    protected $whitelist = [
        // Add your IP addresses here
        // '123.456.789.0',
    ];

    public function handle(Request $request, Closure $next)
    {
        // Allow in local development
        if (config('app.env') === 'local') {
            return $next($request);
        }

        $clientIp = $request->ip();

        // Check IP whitelist (if configured)
        if (!empty($this->whitelist) && !in_array($clientIp, $this->whitelist)) {
            \Log::warning('Admin access from non-whitelisted IP', [
                'ip' => $clientIp,
                'url' => $request->fullUrl(),
            ]);
            abort(403, 'Access denied from this IP address');
        }

        // Check admin token
        $token = $request->header('X-Admin-Token') ?? $request->query('token');
        $adminToken = config('app.admin_token');

        if ($token !== $adminToken) {
            abort(403, 'Invalid admin token');
        }

        return $next($request);
    }
}
```

## Testing the Security

### Local Testing

```bash
cd chess-backend
php artisan serve

# Visit in browser (should work without token in local env)
open http://localhost:8000/tournament_db_visualizer.html

# Test API endpoint
curl http://localhost:8000/api/championships
```

### Production Testing

```bash
# Should require token
curl -i https://your-app.onrender.com/tournament_db_visualizer.html
# Expected: 403 Forbidden

# With token
curl -i -H "X-Admin-Token: your-token" https://your-app.onrender.com/api/championships
# Expected: 200 OK

# Or via query parameter
curl -i "https://your-app.onrender.com/api/championships?token=your-token"
# Expected: 200 OK
```

## Setting Environment Variables in Render

1. Go to Render Dashboard
2. Select your Web Service
3. Click "Environment" tab
4. Add new environment variable:
   - **Key**: `ADMIN_TOKEN`
   - **Value**: `your-secure-random-token` (use output from `Str::random(64)`)
5. Click "Save Changes"
6. Render will automatically redeploy

## Security Best Practices

### ✅ Do This:
- Use long random tokens (64+ characters)
- Store token in environment variables, never in code
- Use HTTPS only (Render provides this by default)
- Log unauthorized access attempts
- Use `sessionStorage` for token (cleared on browser close)
- Rotate tokens periodically

### ❌ Don't Do This:
- Hardcode tokens in source code
- Use short or predictable tokens
- Commit tokens to git
- Share tokens publicly
- Use same token for dev and production

## Token Generation

```bash
# Option 1: Laravel Tinker
php artisan tinker
>>> use Illuminate\Support\Str;
>>> Str::random(64)

# Option 2: OpenSSL
openssl rand -base64 48

# Option 3: PHP
php -r "echo bin2hex(random_bytes(32));"
```

## Monitoring and Logs

Check for unauthorized access attempts:

```bash
# View Laravel logs
tail -f storage/logs/laravel.log | grep "Unauthorized"

# Or via Render
render logs <service-name> | grep "admin"
```

## Quick Command Reference

```bash
# Create middleware
php artisan make:middleware AdminAuthMiddleware

# Clear caches after changes
php artisan config:clear
php artisan route:clear
php artisan cache:clear

# List routes with middleware
php artisan route:list --path=api

# Test middleware
php artisan tinker
>>> request()->header('X-Admin-Token', 'test-token')
```

## Summary

**Recommended Setup:**
1. Create Laravel middleware for token validation
2. Generate secure 64-character token
3. Store token in environment variables
4. Protect visualizer route and admin API endpoints
5. Update frontend to send token in headers
6. Test locally and in production

**Time to implement:** ~15 minutes

**Security level:** High - suitable for production admin tools
=====================================================================













 can you analyze @chess-frontend/src/components/play/PlayComputer.js in this I need to add certain facilities
  1. In play area, mobile view and web view we need to show something like previous moves (last three moves on top of this list). By clicking/taping the move text the chess boxes related to that move should be hilighted
  2. Have you implemented request for offering draw? Camputer can decide if it can allow for draw. Because users are demanding it. Can we implement?
  3. Final and important one, undo past move. Just after user move was made and also after this computer also made its move. In every game we should be allowing 3 such undo my last move

  Make a detail modification plan and place that in /docs/tasks with today's date and appropriate file name.

✦ I will start by creating a detailed modification plan and placing it in the /docs/tasks directory as requested. This plan will outline the necessary changes to implement the previous moves display, the draw offer functionality, and
  the undo move feature. After the plan is in place, I will proceed with the implementation.
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✓  WriteFile Writing to docs/tasks/2025_..._enhancements.md                                                                                                                                                                           │
│                                                                                                                                                                                                                                       │
│   1 # Modification Plan for PlayComputer.js Enhancements                                                                                                                                                                              │
│   2                                                                                                                                                                                                                                   │
│   3 **Date:** 2025-12-09                                                                                                                                                                                                              │
│   4                                                                                                                                                                                                                                   │
│   5 This document outlines the plan to implement three new features in `@chess-frontend/src/components/play/PlayComputer.js`:                                                                                                         │
│   6 1.  **Previous Moves Display**: Show and highlight the last three moves.                                                                                                                                                          │
│   7 2.  **Offer Draw**: Allow the player to offer a draw to the computer.                                                                                                                                                             │
│   8 3.  **Undo Move**: Allow the player to undo their last move (up to 3 times).                                                                                                                                                      │
│   9                                                                                                                                                                                                                                   ││  10 ---                                                                                                                                                                                                                               │
│  11                                                                                                                                                                                                                                   │
│  12 ## 1. Previous Moves Display & Highlighting                                                                                                                                                                                       │
│  13                                                                                                                                                                                                                                   │
│  14 This feature will display the last three moves and highlight the corresponding squares on the board when a move is clicked.                                                                                                       │
│  15                                                                                                                                                                                                                                   │
│  16 ### New State Variables in `PlayComputer.js`                                                                                                                                                                                      │
│  17                                                                                                                                                                                                                                   │
│  18 -   `highlightedMoveSquares`: `useState({})` - An object to store squares to highlight for a selected past move (e.g., `{ from: 'e2', to: 'e4' }`). This will be passed to `ChessBoard`.                                          │
│  19                                                                                                                                                                                                                                   │
│  20 ### New Component: `PreviousMoves.js`                                                                                                                                                                                             │
│  21                                                                                                                                                                                                                                   │
│  22 -   **Location**: `chess-frontend/src/components/play/PreviousMoves.js`                                                                                                                                                           │
│  23 -   **Purpose**: A presentational component to display a list of moves.                                                                                                                                                           │
│  24 -   **Props**:                                                                                                                                                                                                                    │
│  25     -   `moves`: An array of the last 3 move objects from `gameHistory`.                                                                                                                                                          │
│  26     -   `onMoveClick`: A callback function that receives a move object when clicked.                                                                                                                                              │
│  27 -   **Functionality**:                                                                                                                                                                                                            │
│  28     -   Renders the `san` (Standard Algebraic Notation) of each move.                                                                                                                                                             │
│  29     -   Calls `onMoveClick` when a move is clicked, passing the move object.                                                                                                                                                      │
│  30                                                                                                                                                                                                                                   │
│  31 ### Modifications to `PlayComputer.js`                                                                                                                                                                                            │
│  32                                                                                                                                                                                                                                   │
│  33 1.  **Integrate `PreviousMoves` component**:                                                                                                                                                                                      │
│  34     -   Import the new `PreviousMoves` component.                                                                                                                                                                                 │
│  35     -   Render it within `GameContainer`, likely in the sidebar area.                                                                                                                                                             │
│  36     -   Slice `gameHistory` to pass only the last 3 moves to it.                                                                                                                                                                  │
│  37                                                                                                                                                                                                                                   │
│  38 2.  **Implement `handlePreviousMoveClick` callback**:                                                                                                                                                                             │
│  39     -   Create a new callback function `handlePreviousMoveClick(move)`.                                                                                                                                                           │
│  40     -   This function will set the `highlightedMoveSquares` state based on the `from` and `to` squares of the clicked `move` object.                                                                                              │
│  41     -   Example: `setHighlightedMoveSquares({ [move.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }, [move.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } })`. The current `moveSquares` state can be used as a          │
│     reference.                                                                                                                                                                                                                        │
│  42                                                                                                                                                                                                                                   │
│  43 ### Modifications to `ChessBoard.js`                                                                                                                                                                                              │
│  44                                                                                                                                                                                                                                   │
│  45 1.  **Accept new prop**:                                                                                                                                                                                                          │
│  46     -   Add a new prop `highlightedMoveSquares`.                                                                                                                                                                                  │
│  47 2.  **Render highlights**:                                                                                                                                                                                                        │
│  48     -   Merge `highlightedMoveSquares` with existing square styling logic (`moveSquares`, `rightClickedSquares`) to render the highlights. The highlight style should be distinct.                                                │
│  49                                                                                                                                                                                                                                   │
│  50 ---                                                                                                                                                                                                                               │
│  51                                                                                                                                                                                                                                   │
│  52 ## 2. Offer Draw                                                                                                                                                                                                                  │
│  53                                                                                                                                                                                                                                   │
│  54 This feature adds a button for the player to offer a draw.                                                                                                                                                                        │
│  55                                                                                                                                                                                                                                   │
│  56 ### New State Variables in `PlayComputer.js`                                                                                                                                                                                      │
│  57                                                                                                                                                                                                                                   │
│  58 -   `drawOfferState`: `useState('none')` - Can be `'none'`, `'offered'`, `'accepted'`, `'rejected'`.                                                                                                                              │
│  59                                                                                                                                                                                                                                   │
│  60 ### Modifications to `PlayComputer.js`                                                                                                                                                                                            │
│  61                                                                                                                                                                                                                                   │
│  62 1.  **Add "Offer Draw" button**:                                                                                                                                                                                                  │
│  63     -   Add a new button to the controls section within `GameContainer`.                                                                                                                                                          │
│  64     -   The button should be disabled if a draw has already been offered, or if the game is over.                                                                                                                                 │
│  65                                                                                                                                                                                                                                   │
│  66 2.  **Implement `handleOfferDraw` callback**:                                                                                                                                                                                     │
│  67     -   Create a new async callback `handleOfferDraw`.                                                                                                                                                                            │
│  68     -   This function will be called when the "Offer Draw" button is clicked.                                                                                                                                                     │
│  69     -   It will set `drawOfferState` to `'offered'`.                                                                                                                                                                              │
│  70     -   It will use a utility (similar to `makeComputerMove`) to get an evaluation from the chess engine.                                                                                                                         │
│  71     -   **Decision Logic**:                                                                                                                                                                                                       │
│  72         -   If the position evaluation is within a certain threshold (e.g., +/- 0.5), the computer accepts. Set `drawOfferState` to `'accepted'`.                                                                                 │
│  73         -   If accepted, call `handleGameComplete` with a draw result.                                                                                                                                                            │
│  74         -   If the evaluation is outside the threshold, the computer rejects. Set `drawOfferState` to `'rejected'`.                                                                                                               │
│  75         -   Display a status message to the user based on the outcome. The `'rejected'` state can reset to `'none'` after a few seconds.                                                                                          │
│  76                                                                                                                                                                                                                                   │
│  77 3.  **Engine Interaction for Draw**:                                                                                                                                                                                              │
│  78     -   A new utility function might be needed, or `makeComputerMove` could be adapted to return just an evaluation without making a move. We'll need to check the capabilities of the backend/engine integration. For now,       │
│     assume we can get an evaluation.                                                                                                                                                                                                  │
│  79                                                                                                                                                                                                                                   │
│  80 ---                                                                                                                                                                                                                               │
│  81                                                                                                                                                                                                                                   │
│  82 ## 3. Undo Move                                                                                                                                                                                                                   │
│  83                                                                                                                                                                                                                                   │
│  84 This feature allows the player to take back their last move, and the computer's subsequent move.                                                                                                                                  │
│  85                                                                                                                                                                                                                                   │
│  86 ### New State Variables in `PlayComputer.js`                                                                                                                                                                                      │
│  87                                                                                                                                                                                                                                   │
│  88 -   `undoCount`: `useState(3)` - To track remaining undos.                                                                                                                                                                        │
│  89                                                                                                                                                                                                                                   │
│  90 ### Modifications to `PlayComputer.js`                                                                                                                                                                                            │
│  91                                                                                                                                                                                                                                   │
│  92 1.  **Add "Undo" button**:                                                                                                                                                                                                        │
│  93     -   Add an "Undo" button to the controls section inside `GameContainer`.                                                                                                                                                      │
│  94     -   Display the remaining `undoCount`.                                                                                                                                                                                        │
│  95     -   The button should be disabled when `undoCount` is 0, it's not the player's turn, the game is over, or `gameHistory` is too short (less than 2 moves).                                                                     │
│  96                                                                                                                                                                                                                                   │
│  97 2.  **Implement `handleUndoMove` callback**:                                                                                                                                                                                      │
│  98     -   Create a new callback `handleUndoMove`.                                                                                                                                                                                   │
│  99     -   **Validation**: Check if an undo is possible:                                                                                                                                                                             │
│ 100         -   `undoCount > 0`                                                                                                                                                                                                       │
│ 101         -   `!gameOver`                                                                                                                                                                                                           │
│ 102         -   `gameHistory.length >= 2` (to undo both player and computer move)                                                                                                                                                     │
│ 103         -   It should be the player's turn (`game.turn() === playerColor`).                                                                                                                                                       │
│ 104     -   **Revert Logic**:                                                                                                                                                                                                         │
│ 105         -   Use `safeGameMutate` to perform the undo.                                                                                                                                                                             │
│ 106         -   Inside, call `gameCopy.undo()` twice to revert the computer's and then the player's move.                                                                                                                             │
│ 107         -   Update `gameHistory` by slicing off the last two entries: `setGameHistory(gameHistory.slice(0, -2))`.                                                                                                                 │
│ 108         -   Update `moveCount` by decrementing it by 2.                                                                                                                                                                           │
│ 109         -   Decrement `undoCount`: `setUndoCount(prev => prev - 1)`.                                                                                                                                                              │
│ 110     -   **State Resynchronization**:                                                                                                                                                                                              │
│ 111         -   After undoing, the player's timer should be active again. The timer values may need to be adjusted, but for simplicity, we can just restart the player's turn without restoring the exact time before the move.       │
│ 112         -   Recalculate player and computer scores by summing up evaluations from the now-shortened `gameHistory`.                                                                                                                │
│ 113         -   Reset `lastMoveEvaluation` and `lastComputerEvaluation`.                                                                                                                                                              │
│ 114                                                                                                                                                                                                                                   │
│ 115 ### Affected Components and Files                                                                                                                                                                                                 │
│ 116                                                                                                                                                                                                                                   │
│ 117 -   **`chess-frontend/src/components/play/PlayComputer.js`**: Main logic, state management, and callbacks for all three features.                                                                                                 │
│ 118 -   **`chess-frontend/src/components/play/ChessBoard.js`**: To render move highlights.                                                                                                                                            │
│ 119 -   **`chess-frontend/src/components/play/GameContainer.js`**: To add the new UI elements (buttons, move list).                                                                                                                   │
│ 120 -   **`chess-frontend/src/components/play/PreviousMoves.js`**: (New file) To display previous moves.  