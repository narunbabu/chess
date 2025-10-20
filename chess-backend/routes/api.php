<?php

// routes/api.php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Api\GameHistoryController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\UserPresenceController;
use App\Http\Controllers\WebSocketController;
use App\Http\Controllers\RatingController;
// use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;


Route::group(['middleware' => 'api', 'prefix' => 'auth'], function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

    // Social authentication routes
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback']);
});

// Protected routes for authenticated users (use a middleware like auth:sanctum or auth:api)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [UserController::class, 'me']);
    Route::get('/users', [UserController::class, 'index']);

    // Invitation routes
    Route::post('/invitations/send', [InvitationController::class, 'send']);
    Route::post('/invitations/{id}/respond', [InvitationController::class, 'respond']);
    Route::get('/invitations/pending', [InvitationController::class, 'pending']);
    Route::get('/invitations/sent', [InvitationController::class, 'sent']);
    Route::get('/invitations/accepted', [InvitationController::class, 'accepted']);
    Route::delete('/invitations/{id}', [InvitationController::class, 'cancel']);

    // Game routes
    Route::post('/games', [GameController::class, 'create']);
    Route::get('/games/active', [GameController::class, 'activeGames']);
    Route::get('/games/{id}', [GameController::class, 'show']);
    Route::post('/games/{id}/move', [GameController::class, 'move']);
    Route::post('/games/{id}/resign', [GameController::class, 'resign']);
    Route::get('/games', [GameController::class, 'userGames']);

    // User Presence routes
    Route::post('/presence/update', [UserPresenceController::class, 'updatePresence']);
    Route::get('/presence/stats', [UserPresenceController::class, 'getPresenceStats']);
    Route::get('/presence/online/users', [UserPresenceController::class, 'getOnlineUsers']);
    Route::post('/presence/heartbeat', [UserPresenceController::class, 'heartbeat']);
    Route::post('/presence/disconnect', [UserPresenceController::class, 'handleDisconnection']);
    Route::get('/presence/{user}', [UserPresenceController::class, 'getPresence']);

    // List summary (exclude moves) for dashboard or game list
    Route::get('/game-history', [GameHistoryController::class, 'index']);
    // Get full game details (including moves) when user clicks on a game
    Route::get('/game-history/{id}', [GameHistoryController::class, 'show']);
    Route::get('/rankings', [GameHistoryController::class, 'rankings']);
    Route::post('/game-history', [GameHistoryController::class, 'store']);

    // Rating routes
    Route::get('/rating', [RatingController::class, 'getRating']);
    Route::post('/rating/initial', [RatingController::class, 'setInitialRating']);
    Route::post('/rating/update', [RatingController::class, 'updateRating']);
    Route::get('/rating/leaderboard', [RatingController::class, 'getLeaderboard']);
    Route::get('/rating/history', [RatingController::class, 'getRatingHistory']);

    // WebSocket API routes for real-time game connections
    Route::prefix('websocket')->group(function () {
        Route::post('/authenticate', [WebSocketController::class, 'authenticate']);
        // Alternative Laravel standard broadcasting auth route
        Route::post('/broadcasting/auth', [WebSocketController::class, 'authenticate']);
        Route::post('/handshake', [WebSocketController::class, 'handshake']);
        Route::post('/acknowledge-handshake', [WebSocketController::class, 'acknowledgeHandshake']);
        Route::get('/handshake', [WebSocketController::class, 'getHandshake']);
        Route::post('/join-game', [WebSocketController::class, 'joinGame']);
        Route::post('/leave-game', [WebSocketController::class, 'leaveGame']);
        Route::post('/heartbeat', [WebSocketController::class, 'heartbeat']);
        Route::get('/room-state', [WebSocketController::class, 'getRoomState']);
        Route::post('/validate-token', [WebSocketController::class, 'validateToken']);

        // New Phase 2A fix endpoints
        Route::post('/games/{gameId}/resume', [WebSocketController::class, 'resumeGame']);
        Route::post('/games/{gameId}/new-game', [WebSocketController::class, 'newGame']);
        Route::post('/games/{gameId}/move', [WebSocketController::class, 'broadcastMove']);
        Route::post('/games/{gameId}/resign', [WebSocketController::class, 'resignGame']);
        Route::post('/games/{gameId}/status', [WebSocketController::class, 'updateGameStatus']);

        // Game termination endpoints (forfeit, mutual abort, inactivity)
        Route::post('/games/{gameId}/forfeit', [WebSocketController::class, 'forfeitGame']);
        Route::post('/games/{gameId}/abort/request', [WebSocketController::class, 'requestAbort']);
        Route::post('/games/{gameId}/abort/respond', [WebSocketController::class, 'respondToAbort']);
        Route::post('/games/{gameId}/heartbeat', [WebSocketController::class, 'gameHeartbeat']);
        
        // Game pause/resume functionality
        Route::post('/games/{gameId}/pause', [WebSocketController::class, 'pauseGame']);
        Route::post('/games/{gameId}/resume', [WebSocketController::class, 'resumeGame']);

        // Resume request functionality
        Route::post('/games/{gameId}/resume-request', [WebSocketController::class, 'requestResume']);
        Route::post('/games/{gameId}/resume-response', [WebSocketController::class, 'respondToResumeRequest']);

        // Ping opponent (remind them to move)
        Route::post('/games/{gameId}/ping-opponent', [WebSocketController::class, 'pingOpponent']);

        // Draw offer functionality
        Route::post('/games/{gameId}/draw/offer', [WebSocketController::class, 'offerDraw']);
        Route::post('/games/{gameId}/draw/accept', [WebSocketController::class, 'acceptDraw']);
        Route::post('/games/{gameId}/draw/decline', [WebSocketController::class, 'declineDraw']);

        // Get move history for timer calculation
        Route::get('/games/{gameId}/moves', [WebSocketController::class, 'getMoves']);
    });
});

// Laravel Broadcasting Authentication Route (standard pattern)
Route::post('/broadcasting/auth', [WebSocketController::class, 'authenticate'])->middleware('auth:sanctum');

// routes/api.php

Route::get('/public-test', function () {
    Log::info('=== PUBLIC TEST ENDPOINT HIT ===');
    return response()->json([
        'status' => 'success',
        'message' => 'Public test endpoint works!',
    ]);
});

Route::get('/debug/oauth-config', function () {
    return response()->json([
        'google_client_id' => config('services.google.client_id'),
        'google_redirect' => config('services.google.redirect'),
        'frontend_url' => config('app.frontend_url'),
        'env_google_redirect' => env('GOOGLE_REDIRECT_URL'),
        'env_frontend_url' => env('FRONTEND_URL'),
    ]);
});

Route::post('/debug-test', function (Illuminate\Http\Request $request) {
    Log::info('=== DEBUG TEST ENDPOINT HIT ===');
    Log::info('Method: ' . $request->method());
    Log::info('Headers: ', $request->headers->all());
    Log::info('Body: ' . $request->getContent());

    return response()->json([
        'status' => 'success',
        'message' => 'Debug test endpoint works!',
        'received_data' => $request->all()
    ]);
});


// Add logging middleware to all routes
Route::middleware('web')->group(function () {
    Log::info('=== API ROUTES LOADING ===');
});

// Public endpoint to store game history (allows guest records with user_id null)
Route::post('/public/game-history', function (Illuminate\Http\Request $request) {
    Log::info('=== ROUTE HIT: /public/game-history ===');
    Log::info('Request received at route level');
    Log::info('Request method: ' . $request->method());
    Log::info('Request URL: ' . $request->fullUrl());
    Log::info('Request IP: ' . $request->ip());
    Log::info('User Agent: ' . $request->userAgent());

    try {
        Log::info('Calling GameHistoryController::storePublic');
        $controller = new GameHistoryController();
        return $controller->storePublic($request);
    } catch (\Exception $e) {
        Log::error('=== FATAL ERROR IN ROUTE ===');
        Log::error('Exception: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        return response()->json([
            'error' => 'Server error occurred',
            'message' => $e->getMessage()
        ], 500);
    }
});
