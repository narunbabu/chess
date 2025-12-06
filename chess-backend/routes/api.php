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
use App\Http\Controllers\UserStatusController;
use App\Http\Controllers\ContextualPresenceController;
use App\Http\Controllers\WebSocketController;
use App\Http\Controllers\RatingController;
use App\Http\Controllers\SharedResultController;
use App\Http\Controllers\TutorialController;
// use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;


Route::group(['middleware' => 'api', 'prefix' => 'auth'], function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

    // Mobile authentication routes (Android/iOS)
    Route::post('google/mobile', [AuthController::class, 'googleMobileLogin']);

    // Social authentication routes (Web)
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback']);
});

// Public routes
Route::get('/users', [UserController::class, 'index']);

// Protected routes for authenticated users (use a middleware like auth:sanctum or auth:api)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Illuminate\Http\Request $request) {
        return $request->user()->load('roles');
    });

    // Profile routes
    Route::post('/profile', [UserController::class, 'updateProfile']);
    Route::get('/friends', [UserController::class, 'getFriends']);
    Route::post('/friends/{friendId}', [UserController::class, 'addFriend']);
    Route::delete('/friends/{friendId}', [UserController::class, 'removeFriend']);
    Route::get('/friends/pending', [UserController::class, 'getPendingRequests']);
    Route::post('/friends/{requesterId}/accept', [UserController::class, 'acceptRequest']);
    Route::delete('/friends/{requesterId}/reject', [UserController::class, 'rejectRequest']);

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
    Route::get('/games/unfinished', [GameController::class, 'unfinishedGames']);
    Route::post('/games/create-from-unfinished', [GameController::class, 'createFromUnfinished']);
    Route::get('/games/{id}', [GameController::class, 'show']);
    Route::get('/games/{id}/moves', [GameController::class, 'moves']); // Efficient compact format
    Route::post('/games/{id}/move', [GameController::class, 'move']);
    Route::post('/games/{id}/resign', [GameController::class, 'resign']);
    Route::post('/games/{id}/pause-navigation', [GameController::class, 'pauseNavigation']);
    Route::delete('/games/{id}/unfinished', [GameController::class, 'deleteUnfinished']);
    Route::get('/games', [GameController::class, 'userGames']);

    // Contextual Presence routes (Smart, context-aware tracking) - MUST come before parameterized routes
    Route::get('/presence/friends', [ContextualPresenceController::class, 'getFriendsStatus']);
    Route::get('/presence/opponents', [ContextualPresenceController::class, 'getCurrentRoundOpponents']);
    Route::get('/presence/lobby', [ContextualPresenceController::class, 'getLobbyUsers']);
    Route::get('/presence/contextual', [ContextualPresenceController::class, 'getContextualPresence']);

    // User Presence routes (WebSocket-based)
    Route::post('/presence/update', [UserPresenceController::class, 'updatePresence']);
    Route::get('/presence/stats', [UserPresenceController::class, 'getPresenceStats']);
    Route::get('/presence/online/users', [UserPresenceController::class, 'getOnlineUsers']);
    Route::post('/presence/heartbeat', [UserPresenceController::class, 'heartbeat']);
    Route::post('/presence/disconnect', [UserPresenceController::class, 'handleDisconnection']);
    Route::get('/presence/{user}', [UserPresenceController::class, 'getPresence']); // MUST be last - catches everything else

    // User Status routes (Database-backed, reliable)
    Route::post('/status/heartbeat', [UserStatusController::class, 'heartbeat']);
    Route::get('/status/check/{userId}', [UserStatusController::class, 'checkStatus']);
    Route::post('/status/batch-check', [UserStatusController::class, 'batchCheckStatus']);
    Route::get('/status/online-users', [UserStatusController::class, 'getOnlineUsers']);

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

    // Tutorial System routes
    Route::prefix('tutorial')->group(function () {
        // Module and Lesson routes
        Route::get('/modules', [TutorialController::class, 'getModules']);
        Route::get('/modules/{slug}', [TutorialController::class, 'getModule']);
        Route::get('/lessons/{id}', [TutorialController::class, 'getLesson']);
        Route::post('/lessons/{id}/start', [TutorialController::class, 'startLesson']);
        Route::post('/lessons/{id}/complete', [TutorialController::class, 'completeLesson']);

        // Progress and Stats routes
        Route::get('/progress', [TutorialController::class, 'getProgress']);
        Route::get('/progress/stats', [TutorialController::class, 'getStats']);

        // Achievement routes
        Route::get('/achievements', [TutorialController::class, 'getAchievements']);
        Route::get('/achievements/user', [TutorialController::class, 'getUserAchievements']);

        // Daily Challenge routes
        Route::get('/daily-challenge', [TutorialController::class, 'getDailyChallenge']);
        Route::post('/daily-challenge/submit', [TutorialController::class, 'submitDailyChallenge']);

        // Practice Game routes
        Route::post('/practice-game/create', [TutorialController::class, 'createPracticeGame']);
        Route::post('/practice-game/{id}/complete', [TutorialController::class, 'completePracticeGame']);

        // Skill Assessment routes
        Route::post('/skill-assessment', [TutorialController::class, 'createSkillAssessment']);

        // Interactive Lesson routes
        Route::get('/lessons/{id}/interactive', [TutorialController::class, 'getInteractiveLesson']);
        Route::post('/lessons/{id}/validate-move', [TutorialController::class, 'validateInteractiveMove']);
        Route::post('/lessons/{id}/hint', [TutorialController::class, 'getInteractiveHint']);
        Route::post('/lessons/{id}/reset-stage', [TutorialController::class, 'resetInteractiveStage']);
        Route::get('/lessons/{id}/interactive-progress', [TutorialController::class, 'getInteractiveProgress']);
    });

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
        Route::get('/games/{gameId}/state', [WebSocketController::class, 'getRoomState']); // Alternative path for frontend
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

        // Resume status check
        Route::get('/games/{gameId}/resume-status', [WebSocketController::class, 'getResumeStatus']);

        // Ping opponent (remind them to move)
        Route::post('/games/{gameId}/ping-opponent', [WebSocketController::class, 'pingOpponent']);

        // Draw offer functionality
        Route::post('/games/{gameId}/draw/offer', [WebSocketController::class, 'offerDraw']);
        Route::post('/games/{gameId}/draw/accept', [WebSocketController::class, 'acceptDraw']);
        Route::post('/games/{gameId}/draw/decline', [WebSocketController::class, 'declineDraw']);

        // Get move history for timer calculation
        Route::get('/games/{gameId}/moves', [WebSocketController::class, 'getMoves']);

        // Get championship context for a game
        Route::get('/games/{gameId}/championship-context', [WebSocketController::class, 'getChampionshipContext']);
    });

    // Laravel Broadcasting Authentication Route (standard Laravel pattern)
    // This must be outside the websocket prefix to match Laravel Echo's default endpoint
    Route::post('/broadcasting/auth', [WebSocketController::class, 'authenticate']);

    // Championship routes (authenticated only)
    Route::prefix('championships')->group(function () {
        Route::post('/', [\App\Http\Controllers\ChampionshipController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'destroy']); // Archive (soft delete)
        Route::post('/{id}/restore', [\App\Http\Controllers\ChampionshipController::class, 'restore']); // Restore archived
        Route::delete('/{id}/force', [\App\Http\Controllers\ChampionshipController::class, 'forceDelete']); // Permanent delete
        Route::get('/{id}/participants', [\App\Http\Controllers\ChampionshipController::class, 'participants']);
        Route::get('/{id}/matches', [\App\Http\Controllers\ChampionshipController::class, 'matches']);
        Route::get('/{id}/standings', [\App\Http\Controllers\ChampionshipController::class, 'standings']);
        Route::get('/{id}/my-matches', [\App\Http\Controllers\ChampionshipController::class, 'myMatches']);
        Route::get('/{id}/stats', [\App\Http\Controllers\ChampionshipController::class, 'stats']);

        // Championship registration routes
        Route::post('/{id}/register', [\App\Http\Controllers\ChampionshipController::class, 'register']);
        Route::post('/{id}/register-with-payment', [\App\Http\Controllers\ChampionshipController::class, 'registerWithPayment']);

        // Championship match management
        Route::prefix('/{championship}/matches')->group(function () {
            // Specific routes must come before parameterized routes
            Route::get('/', [\App\Http\Controllers\ChampionshipMatchController::class, 'index']);
            Route::get('/pairings-preview', [\App\Http\Controllers\ChampionshipMatchController::class, 'getPairingsPreview'])->middleware('can:manage,championship');
            Route::post('/schedule-next', [\App\Http\Controllers\ChampionshipMatchController::class, 'scheduleNextRound'])->middleware('can:manage,championship');
            Route::get('/bracket', [\App\Http\Controllers\ChampionshipMatchController::class, 'getBracket']);
            Route::get('/stats', [\App\Http\Controllers\ChampionshipMatchController::class, 'getStats']);
            Route::get('/round/{round}/leaderboard', [\App\Http\Controllers\ChampionshipMatchController::class, 'getRoundLeaderboard']);
            Route::delete('/', [\App\Http\Controllers\ChampionshipMatchController::class, 'destroyAll'])->middleware('can:manage,championship');
        });

        // Tournament generation routes (admin only)
        Route::prefix('/{championship}')->middleware('can:manage,championship')->group(function () {
            Route::post('/generate-full-tournament', [\App\Http\Controllers\ChampionshipMatchController::class, 'generateFullTournament']);
            Route::get('/tournament-preview', [\App\Http\Controllers\ChampionshipMatchController::class, 'previewTournamentStructure']);
            Route::get('/tournament-config', [\App\Http\Controllers\ChampionshipMatchController::class, 'getTournamentConfig']);
            Route::put('/tournament-config', [\App\Http\Controllers\ChampionshipMatchController::class, 'updateTournamentConfig']);
            Route::get('/coverage-analysis', [\App\Http\Controllers\ChampionshipMatchController::class, 'getCoverageAnalysis']);
            Route::post('/assign-round-robin-coverage', [\App\Http\Controllers\ChampionshipMatchController::class, 'assignRoundRobinCoverage']);
        });

        // Championship match routes continued
        Route::prefix('/{championship}/matches')->group(function () {

            // Parameterized routes that must come after specific routes
            Route::get('/{match}', [\App\Http\Controllers\ChampionshipMatchController::class, 'show']);
            Route::get('/{match}/can-play', [\App\Http\Controllers\ChampionshipMatchController::class, 'canPlay']);
            Route::post('/{match}/game', [\App\Http\Controllers\ChampionshipMatchController::class, 'createGame']);
            Route::post('/{match}/challenge', [\App\Http\Controllers\ChampionshipMatchController::class, 'sendChallenge']);
            Route::post('/{match}/notify-start', [\App\Http\Controllers\ChampionshipMatchController::class, 'notifyGameStart']);
            Route::post('/{match}/resume-request/accept', [\App\Http\Controllers\ChampionshipMatchController::class, 'acceptResumeRequest']);
            Route::post('/{match}/resume-request/decline', [\App\Http\Controllers\ChampionshipMatchController::class, 'declineResumeRequest']);
            Route::post('/{match}/result', [\App\Http\Controllers\ChampionshipMatchController::class, 'reportResult']);
            Route::post('/{match}/send-invitation', [\App\Http\Controllers\ChampionshipMatchController::class, 'sendInvitation'])->middleware('can:manage,championship');
            Route::put('/{match}/reschedule', [\App\Http\Controllers\ChampionshipMatchController::class, 'reschedule'])->middleware('can:manage,championship');
            Route::delete('/{match}', [\App\Http\Controllers\ChampionshipMatchController::class, 'destroy'])->middleware('can:manage,championship');

            // Match scheduling routes
            Route::post('/{match}/schedule/propose', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'proposeSchedule']);
            Route::post('/{match}/schedule/{schedule}/accept', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'acceptSchedule']);
            Route::post('/{match}/schedule/{schedule}/propose-alternative', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'proposeAlternative']);
            Route::post('/{match}/schedule/confirm', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'confirmSchedule']);
            Route::post('/{match}/schedule/play-immediate', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'playImmediate']);
            Route::get('/{match}/schedule/proposals', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'getScheduleProposals']);
        });

        // User's championship matches
        Route::get('/my-matches', [\App\Http\Controllers\ChampionshipMatchController::class, 'myMatches']);

        // User's championship scheduling information
        Route::get('/{id}/my-schedule', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'getUserSchedule']);

        // Championship instructions
        Route::get('/{id}/instructions', [\App\Http\Controllers\ChampionshipController::class, 'getInstructions']);

        // Payment routes
        Route::post('/{id}/payment/initiate', [\App\Http\Controllers\ChampionshipPaymentController::class, 'initiatePayment']);
        Route::post('/payment/callback', [\App\Http\Controllers\ChampionshipPaymentController::class, 'handleCallback']);
        Route::post('/payment/refund/{participantId}', [\App\Http\Controllers\ChampionshipPaymentController::class, 'issueRefund']);
    });

    // Tournament administration routes
    Route::prefix('admin/tournaments')->middleware(['role:platform_admin,platform_manager,tournament_organizer'])->group(function () {
        Route::get('/overview', [\App\Http\Controllers\TournamentAdminController::class, 'overview']);
        Route::post('/{championship}/start', [\App\Http\Controllers\TournamentAdminController::class, 'startChampionship']);
        Route::post('/{championship}/pause', [\App\Http\Controllers\TournamentAdminController::class, 'pauseChampionship']);
        Route::post('/{championship}/resume', [\App\Http\Controllers\TournamentAdminController::class, 'resumeChampionship']);
        Route::post('/{championship}/complete', [\App\Http\Controllers\TournamentAdminController::class, 'completeChampionship']);
        Route::post('/{championship}/validate', [\App\Http\Controllers\TournamentAdminController::class, 'validateTournament']);
        Route::post('/maintenance', [\App\Http\Controllers\TournamentAdminController::class, 'runMaintenance']);
        Route::get('/analytics', [\App\Http\Controllers\TournamentAdminController::class, 'getAnalytics']);
        Route::get('/health', [\App\Http\Controllers\TournamentAdminController::class, 'getSystemHealth']);
    });

    // Organization routes (authenticated only)
    Route::prefix('organizations')->group(function () {
        Route::get('/', [\App\Http\Controllers\OrganizationController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\OrganizationController::class, 'store']);
        Route::get('/{id}', [\App\Http\Controllers\OrganizationController::class, 'show']);
        Route::put('/{id}', [\App\Http\Controllers\OrganizationController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\OrganizationController::class, 'destroy']);
        Route::get('/{id}/members', [\App\Http\Controllers\OrganizationController::class, 'members']);
        Route::post('/{id}/members', [\App\Http\Controllers\OrganizationController::class, 'addMember']);
        Route::delete('/{organizationId}/members/{userId}', [\App\Http\Controllers\OrganizationController::class, 'removeMember']);
    });
});

// Public championship routes (no authentication required)
Route::prefix('championships')->group(function () {
    Route::get('/', [\App\Http\Controllers\ChampionshipController::class, 'index']); // Public listing
    Route::get('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'show']); // Public view
});

// Championship webhook route (public - no auth required)
Route::post('/championships/payment/webhook', [\App\Http\Controllers\ChampionshipPaymentController::class, 'handleWebhook']);

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

// Debug endpoint for avatar storage diagnostics
Route::get('/debug/avatar-storage', function () {
    $avatarDir = storage_path('app/public/avatars');
    $files = [];

    if (is_dir($avatarDir)) {
        $items = array_diff(scandir($avatarDir), ['.', '..']);
        foreach ($items as $item) {
            $path = $avatarDir . '/' . $item;
            $files[] = [
                'filename' => $item,
                'size' => filesize($path),
                'readable' => is_readable($path),
                'permissions' => substr(sprintf('%o', fileperms($path)), -4),
                'modified' => date('Y-m-d H:i:s', filemtime($path))
            ];
        }
    }

    return response()->json([
        'storage_path' => storage_path(),
        'app_public_path' => storage_path('app/public'),
        'avatars_directory' => $avatarDir,
        'directory_exists' => is_dir($avatarDir),
        'directory_readable' => is_dir($avatarDir) ? is_readable($avatarDir) : false,
        'directory_writable' => is_dir($avatarDir) ? is_writable($avatarDir) : false,
        'directory_permissions' => is_dir($avatarDir) ? substr(sprintf('%o', fileperms($avatarDir)), -4) : 'N/A',
        'file_count' => count($files),
        'files' => $files,
        'php_user' => posix_getpwuid(posix_geteuid()),
        'app_url' => config('app.url'),
        'environment' => config('app.env')
    ]);
});

// Serve avatar files
Route::get('/avatars/{filename}', function ($filename) {
    // Enhanced logging for production debugging
    \Log::info('=== AVATAR REQUEST ===', [
        'filename' => $filename,
        'storage_path' => storage_path('app/public/avatars/' . $filename),
        'storage_base' => storage_path('app/public/avatars'),
        'app_url' => config('app.url'),
        'environment' => config('app.env')
    ]);

    // Sanitize filename to prevent directory traversal
    $filename = basename($filename);
    $path = storage_path('app/public/avatars/' . $filename);

    \Log::info('Avatar file check:', [
        'sanitized_filename' => $filename,
        'full_path' => $path,
        'exists' => file_exists($path),
        'readable' => file_exists($path) ? is_readable($path) : false,
        'permissions' => file_exists($path) ? substr(sprintf('%o', fileperms($path)), -4) : 'N/A'
    ]);

    if (!file_exists($path)) {
        // Check if directory exists
        $dir = storage_path('app/public/avatars');
        \Log::error('Avatar file not found', [
            'requested_path' => $path,
            'directory_exists' => is_dir($dir),
            'directory_readable' => is_dir($dir) ? is_readable($dir) : false,
            'files_in_directory' => is_dir($dir) ? scandir($dir) : []
        ]);

        return response()->json([
            'error' => 'Avatar not found',
            'filename' => $filename,
            'path' => $path,
            'debug' => config('app.debug') ? [
                'directory_exists' => is_dir($dir),
                'available_files' => is_dir($dir) ? array_values(array_diff(scandir($dir), ['.', '..'])) : []
            ] : null
        ], 404);
    }

    if (!is_readable($path)) {
        \Log::error('Avatar file not readable', [
            'path' => $path,
            'permissions' => substr(sprintf('%o', fileperms($path)), -4),
            'owner' => posix_getpwuid(fileowner($path))
        ]);

        return response()->json([
            'error' => 'Avatar file not accessible',
            'filename' => $filename
        ], 403);
    }

    try {
        $file = file_get_contents($path);
        $mimeType = mime_content_type($path);

        \Log::info('Avatar served successfully', [
            'filename' => $filename,
            'size' => strlen($file),
            'mime_type' => $mimeType
        ]);

        return response($file)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000');
    } catch (\Exception $e) {
        \Log::error('Failed to serve avatar', [
            'filename' => $filename,
            'error' => $e->getMessage()
        ]);

        return response()->json([
            'error' => 'Failed to load avatar',
            'message' => config('app.debug') ? $e->getMessage() : 'Internal server error'
        ], 500);
    }
})->where('filename', '.*');

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

// Shared game result routes (public - no auth required)
Route::post('/shared-results', [SharedResultController::class, 'store']);
Route::get('/shared-results/{uniqueId}', [SharedResultController::class, 'show']);
Route::get('/shared-results/{uniqueId}/og-data', [SharedResultController::class, 'getOgData']);

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

// Tournament Visualizer API (admin only - protected in production)
Route::middleware('admin.auth')->prefix('visualizer')->group(function () {
    Route::post('/tournaments/create', [\App\Http\Controllers\TournamentVisualizerController::class, 'createTournament']);
    Route::get('/tournaments/list', [\App\Http\Controllers\TournamentVisualizerController::class, 'listTournaments']);
    Route::get('/tournaments/{id}', [\App\Http\Controllers\TournamentVisualizerController::class, 'getTournament']);
    Route::put('/matches/{matchId}/result', [\App\Http\Controllers\TournamentVisualizerController::class, 'updateMatchResult']);
    Route::get('/tournaments/{id}/standings', [\App\Http\Controllers\TournamentVisualizerController::class, 'getStandings']);
    Route::get('/tournaments/{id}/export', [\App\Http\Controllers\TournamentVisualizerController::class, 'exportTournament']);
    Route::delete('/tournaments/{id}', [\App\Http\Controllers\TournamentVisualizerController::class, 'deleteTournament']);
    Route::get('/tournaments/{id}/tiebreaker', [\App\Http\Controllers\TiebreakerController::class, 'getBreakdown']);

    // Player Assignment Routes
    Route::get('/championships', [\App\Http\Controllers\TournamentVisualizerController::class, 'getChampionships']);
    Route::get('/users', [\App\Http\Controllers\TournamentVisualizerController::class, 'getUsers']);
    Route::post('/championships/{championshipId}/assign-players', [\App\Http\Controllers\TournamentVisualizerController::class, 'assignPlayersToChampionship']);
});
