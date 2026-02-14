<?php

/**
 * API v1 Routes
 *
 * Mobile-optimized API endpoints for Android/iOS native apps.
 * All routes are prefixed with /api/v1/ (registered in bootstrap/app.php).
 *
 * v1 routes point to existing controllers where possible,
 * with new mobile-specific endpoints added as needed.
 */

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Api\GameHistoryController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\DrawController;
use App\Http\Controllers\PerformanceController;
use App\Http\Controllers\UserPresenceController;
use App\Http\Controllers\UserStatusController;
use App\Http\Controllers\ContextualPresenceController;
use App\Http\Controllers\WebSocketController;
use App\Http\Controllers\RatingController;
use App\Http\Controllers\SharedResultController;
use App\Http\Controllers\TutorialController;
use App\Http\Controllers\DeviceTokenController;
use App\Http\Controllers\EmailPreferenceController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// ─── Health Check (public) ────────────────────────────────────────────────────
Route::get('/health', [HealthController::class, 'index']);

// ─── Authentication ───────────────────────────────────────────────────────────
Route::prefix('auth')->middleware('throttle:mobile-auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

    // Mobile OAuth
    Route::post('google/mobile', [AuthController::class, 'googleMobileLogin']);
    Route::post('apple/mobile', [AuthController::class, 'appleMobileLogin']);

    // Token management (authenticated)
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('refresh', [AuthController::class, 'refreshToken']);
        Route::post('revoke-all', [AuthController::class, 'revokeAllTokens']);
    });

    // Web OAuth (not typically used by mobile, but available)
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback']);
});

// ─── Public routes ────────────────────────────────────────────────────────────
Route::get('/users', [UserController::class, 'index']);

// ─── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Illuminate\Http\Request $request) {
        return $request->user()->load('roles');
    });

    // ── Device Token Management (Push Notifications) ──────────────────────
    Route::prefix('devices')->group(function () {
        Route::post('/register', [DeviceTokenController::class, 'register']);
        Route::delete('/{token}', [DeviceTokenController::class, 'destroy']);
        Route::get('/', [DeviceTokenController::class, 'index']);
    });

    // ── Email Preferences ──────────────────────────────────────────────
    Route::prefix('email')->group(function () {
        Route::get('/preferences', [EmailPreferenceController::class, 'apiGetPreferences']);
        Route::put('/preferences', [EmailPreferenceController::class, 'apiUpdatePreferences']);
    });

    // ── Profile & Friends ─────────────────────────────────────────────────
    Route::post('/profile', [UserController::class, 'updateProfile']);
    Route::get('/friends', [UserController::class, 'getFriends']);
    Route::post('/friends/{friendId}', [UserController::class, 'addFriend']);
    Route::delete('/friends/{friendId}', [UserController::class, 'removeFriend']);
    Route::get('/friends/pending', [UserController::class, 'getPendingRequests']);
    Route::post('/friends/{requesterId}/accept', [UserController::class, 'acceptRequest']);
    Route::delete('/friends/{requesterId}/reject', [UserController::class, 'rejectRequest']);

    // ── Invitations ───────────────────────────────────────────────────────
    Route::post('/invitations/send', [InvitationController::class, 'send']);
    Route::post('/invitations/{id}/respond', [InvitationController::class, 'respond']);
    Route::get('/invitations/pending', [InvitationController::class, 'pending']);
    Route::get('/invitations/sent', [InvitationController::class, 'sent']);
    Route::get('/invitations/accepted', [InvitationController::class, 'accepted']);
    Route::delete('/invitations/{id}', [InvitationController::class, 'cancel']);

    // ── Games ─────────────────────────────────────────────────────────────
    Route::post('/games', [GameController::class, 'create']);
    Route::post('/games/computer', [GameController::class, 'createComputerGame']);
    Route::get('/games/active', [GameController::class, 'activeGames']);
    Route::get('/games/unfinished', [GameController::class, 'unfinishedGames']);
    Route::post('/games/create-from-unfinished', [GameController::class, 'createFromUnfinished']);
    Route::get('/games/{id}', [GameController::class, 'show']);
    Route::get('/games/{id}/moves', [GameController::class, 'moves']);
    Route::post('/games/{id}/move', [GameController::class, 'move']);
    Route::post('/games/{id}/resign', [GameController::class, 'resign']);
    Route::post('/games/{id}/pause-navigation', [GameController::class, 'pauseNavigation']);
    Route::delete('/games/{id}/unfinished', [GameController::class, 'deleteUnfinished']);
    Route::get('/games', [GameController::class, 'userGames']);

    // Game mode
    Route::post('/games/{id}/mode', [GameController::class, 'setGameMode']);
    Route::get('/games/{id}/mode', [GameController::class, 'getGameMode']);
    Route::get('/games/{id}/rating-change', [GameController::class, 'getRatingChange']);

    // ── Draw Offers ───────────────────────────────────────────────────────
    Route::post('/games/{id}/draw/offer', [DrawController::class, 'offerDraw']);
    Route::post('/games/{id}/draw/accept', [DrawController::class, 'acceptDraw']);
    Route::post('/games/{id}/draw/decline', [DrawController::class, 'declineDraw']);
    Route::post('/games/{id}/draw/cancel', [DrawController::class, 'cancelDraw']);
    Route::get('/games/{id}/draw/status', [DrawController::class, 'getDrawStatus']);
    Route::get('/games/{id}/draw/history', [DrawController::class, 'getDrawHistory']);
    Route::get('/games/{id}/draw/validate', [DrawController::class, 'validateDrawOffer']);

    // ── Performance ───────────────────────────────────────────────────────
    Route::get('/games/{id}/performance', [PerformanceController::class, 'getGamePerformance']);
    Route::get('/games/{id}/analysis', [PerformanceController::class, 'getGameAnalysis']);
    Route::get('/performance/history', [PerformanceController::class, 'getPerformanceHistory']);
    Route::get('/performance/stats', [PerformanceController::class, 'getPerformanceStats']);

    // ── Presence (contextual routes first) ────────────────────────────────
    Route::get('/presence/friends', [ContextualPresenceController::class, 'getFriendsStatus']);
    Route::get('/presence/opponents', [ContextualPresenceController::class, 'getCurrentRoundOpponents']);
    Route::get('/presence/lobby', [ContextualPresenceController::class, 'getLobbyUsers']);
    Route::get('/presence/contextual', [ContextualPresenceController::class, 'getContextualPresence']);
    Route::post('/presence/update', [UserPresenceController::class, 'updatePresence']);
    Route::get('/presence/stats', [UserPresenceController::class, 'getPresenceStats']);
    Route::get('/presence/online/users', [UserPresenceController::class, 'getOnlineUsers']);
    Route::post('/presence/heartbeat', [UserPresenceController::class, 'heartbeat']);
    Route::post('/presence/disconnect', [UserPresenceController::class, 'handleDisconnection']);
    Route::get('/presence/{user}', [UserPresenceController::class, 'getPresence']);

    // ── User Status ───────────────────────────────────────────────────────
    Route::post('/status/heartbeat', [UserStatusController::class, 'heartbeat']);
    Route::get('/status/check/{userId}', [UserStatusController::class, 'checkStatus']);
    Route::post('/status/batch-check', [UserStatusController::class, 'batchCheckStatus']);
    Route::get('/status/online-users', [UserStatusController::class, 'getOnlineUsers']);

    // ── Game History ──────────────────────────────────────────────────────
    Route::get('/game-history', [GameHistoryController::class, 'index']);
    Route::get('/game-history/{id}', [GameHistoryController::class, 'show']);
    Route::get('/rankings', [GameHistoryController::class, 'rankings']);
    Route::post('/game-history', [GameHistoryController::class, 'store']);

    // ── Ratings ───────────────────────────────────────────────────────────
    Route::get('/rating', [RatingController::class, 'getRating']);
    Route::post('/rating/initial', [RatingController::class, 'setInitialRating']);
    Route::post('/rating/update', [RatingController::class, 'updateRating']);
    Route::get('/rating/leaderboard', [RatingController::class, 'getLeaderboard']);
    Route::get('/rating/history', [RatingController::class, 'getRatingHistory']);

    // ── Tutorials ─────────────────────────────────────────────────────────
    Route::prefix('tutorial')->group(function () {
        Route::get('/modules', [TutorialController::class, 'getModules']);
        Route::get('/modules/{slug}', [TutorialController::class, 'getModule']);
        Route::get('/lessons/{id}', [TutorialController::class, 'getLesson']);
        Route::post('/lessons/{id}/start', [TutorialController::class, 'startLesson']);
        Route::post('/lessons/{id}/complete', [TutorialController::class, 'completeLesson']);
        Route::get('/progress', [TutorialController::class, 'getProgress']);
        Route::get('/progress/stats', [TutorialController::class, 'getStats']);
        Route::get('/achievements', [TutorialController::class, 'getAchievements']);
        Route::get('/achievements/user', [TutorialController::class, 'getUserAchievements']);
        Route::get('/daily-challenge', [TutorialController::class, 'getDailyChallenge']);
        Route::post('/daily-challenge/submit', [TutorialController::class, 'submitDailyChallenge']);
        Route::post('/practice-game/create', [TutorialController::class, 'createPracticeGame']);
        Route::post('/practice-game/{id}/complete', [TutorialController::class, 'completePracticeGame']);
        Route::post('/skill-assessment', [TutorialController::class, 'createSkillAssessment']);
        Route::get('/lessons/{id}/interactive', [TutorialController::class, 'getInteractiveLesson']);
        Route::post('/lessons/{id}/validate-move', [TutorialController::class, 'validateInteractiveMove']);
        Route::post('/lessons/{id}/hint', [TutorialController::class, 'getInteractiveHint']);
        Route::post('/lessons/{id}/reset-stage', [TutorialController::class, 'resetInteractiveStage']);
        Route::get('/lessons/{id}/interactive-progress', [TutorialController::class, 'getInteractiveProgress']);
    });

    // ── WebSocket API ─────────────────────────────────────────────────────
    Route::prefix('websocket')->group(function () {
        Route::post('/authenticate', [WebSocketController::class, 'authenticate']);
        Route::post('/broadcasting/auth', [WebSocketController::class, 'authenticate']);
        Route::post('/handshake', [WebSocketController::class, 'handshake']);
        Route::post('/acknowledge-handshake', [WebSocketController::class, 'acknowledgeHandshake']);
        Route::get('/handshake', [WebSocketController::class, 'getHandshake']);
        Route::post('/join-game', [WebSocketController::class, 'joinGame']);
        Route::post('/leave-game', [WebSocketController::class, 'leaveGame']);
        Route::post('/heartbeat', [WebSocketController::class, 'heartbeat']);
        Route::get('/room-state', [WebSocketController::class, 'getRoomState']);
        Route::get('/games/{gameId}/state', [WebSocketController::class, 'getRoomState']);
        Route::post('/validate-token', [WebSocketController::class, 'validateToken']);
        Route::post('/games/{gameId}/resume', [WebSocketController::class, 'resumeGame']);
        Route::post('/games/{gameId}/new-game', [WebSocketController::class, 'newGame']);
        Route::post('/games/{gameId}/move', [WebSocketController::class, 'broadcastMove']);
        Route::post('/games/{gameId}/resign', [WebSocketController::class, 'resignGame']);
        Route::post('/games/{gameId}/status', [WebSocketController::class, 'updateGameStatus']);
        Route::post('/games/{gameId}/forfeit', [WebSocketController::class, 'forfeitGame']);
        Route::post('/games/{gameId}/abort/request', [WebSocketController::class, 'requestAbort']);
        Route::post('/games/{gameId}/abort/respond', [WebSocketController::class, 'respondToAbort']);
        Route::post('/games/{gameId}/heartbeat', [WebSocketController::class, 'gameHeartbeat']);
        Route::post('/games/{gameId}/pause', [WebSocketController::class, 'pauseGame']);
        Route::post('/games/{gameId}/resume-request', [WebSocketController::class, 'requestResume']);
        Route::post('/games/{gameId}/request-resume', [WebSocketController::class, 'requestResumeFallback']);
        Route::post('/games/{gameId}/resume-response', [WebSocketController::class, 'respondToResumeRequest']);
        Route::get('/games/{gameId}/resume-status', [WebSocketController::class, 'getResumeStatus']);
        Route::post('/games/{gameId}/ping-opponent', [WebSocketController::class, 'pingOpponent']);
        Route::post('/games/{gameId}/draw/offer', [WebSocketController::class, 'offerDraw']);
        Route::post('/games/{gameId}/draw/accept', [WebSocketController::class, 'acceptDraw']);
        Route::post('/games/{gameId}/draw/decline', [WebSocketController::class, 'declineDraw']);
        Route::post('/games/{gameId}/undo/request', [WebSocketController::class, 'requestUndo']);
        Route::post('/games/{gameId}/undo/accept', [WebSocketController::class, 'acceptUndo']);
        Route::post('/games/{gameId}/undo/decline', [WebSocketController::class, 'declineUndo']);
        Route::get('/games/{gameId}/moves', [WebSocketController::class, 'getMoves']);
        Route::get('/games/{gameId}/championship-context', [WebSocketController::class, 'getChampionshipContext']);
    });

    // Broadcasting auth (standard Laravel pattern, outside websocket prefix)
    Route::post('/broadcasting/auth', [WebSocketController::class, 'authenticate']);

    // ── Championships (authenticated) ─────────────────────────────────────
    Route::prefix('championships')->group(function () {
        Route::post('/', [\App\Http\Controllers\ChampionshipController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'destroy']);
        Route::post('/{id}/restore', [\App\Http\Controllers\ChampionshipController::class, 'restore']);
        Route::delete('/{id}/force', [\App\Http\Controllers\ChampionshipController::class, 'forceDelete']);
        Route::get('/{id}/participants', [\App\Http\Controllers\ChampionshipController::class, 'participants']);
        Route::get('/{id}/matches', [\App\Http\Controllers\ChampionshipController::class, 'matches']);
        Route::get('/{id}/standings', [\App\Http\Controllers\ChampionshipController::class, 'standings']);
        Route::get('/{id}/my-matches', [\App\Http\Controllers\ChampionshipController::class, 'myMatches']);
        Route::get('/{id}/stats', [\App\Http\Controllers\ChampionshipController::class, 'stats']);
        Route::post('/{id}/register', [\App\Http\Controllers\ChampionshipController::class, 'register']);
        Route::post('/{id}/register-with-payment', [\App\Http\Controllers\ChampionshipController::class, 'registerWithPayment']);

        Route::prefix('/{championship}/matches')->group(function () {
            Route::get('/', [\App\Http\Controllers\ChampionshipMatchController::class, 'index']);
            Route::get('/pairings-preview', [\App\Http\Controllers\ChampionshipMatchController::class, 'getPairingsPreview'])->middleware('can:manage,championship');
            Route::post('/schedule-next', [\App\Http\Controllers\ChampionshipMatchController::class, 'scheduleNextRound'])->middleware('can:manage,championship');
            Route::get('/bracket', [\App\Http\Controllers\ChampionshipMatchController::class, 'getBracket']);
            Route::get('/stats', [\App\Http\Controllers\ChampionshipMatchController::class, 'getStats']);
            Route::get('/round/{round}/leaderboard', [\App\Http\Controllers\ChampionshipMatchController::class, 'getRoundLeaderboard']);
            Route::delete('/', [\App\Http\Controllers\ChampionshipMatchController::class, 'destroyAll'])->middleware('can:manage,championship');
        });

        Route::prefix('/{championship}')->middleware('can:manage,championship')->group(function () {
            Route::post('/generate-full-tournament', [\App\Http\Controllers\ChampionshipMatchController::class, 'generateFullTournament']);
            Route::get('/tournament-preview', [\App\Http\Controllers\ChampionshipMatchController::class, 'previewTournamentStructure']);
            Route::get('/tournament-config', [\App\Http\Controllers\ChampionshipMatchController::class, 'getTournamentConfig']);
            Route::put('/tournament-config', [\App\Http\Controllers\ChampionshipMatchController::class, 'updateTournamentConfig']);
            Route::get('/coverage-analysis', [\App\Http\Controllers\ChampionshipMatchController::class, 'getCoverageAnalysis']);
            Route::post('/assign-round-robin-coverage', [\App\Http\Controllers\ChampionshipMatchController::class, 'assignRoundRobinCoverage']);
        });

        Route::prefix('/{championship}/matches')->group(function () {
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

            Route::post('/{match}/schedule/propose', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'proposeSchedule']);
            Route::post('/{match}/schedule/{schedule}/accept', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'acceptSchedule']);
            Route::post('/{match}/schedule/{schedule}/propose-alternative', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'proposeAlternative']);
            Route::post('/{match}/schedule/confirm', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'confirmSchedule']);
            Route::post('/{match}/schedule/play-immediate', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'playImmediate']);
            Route::get('/{match}/schedule/proposals', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'getScheduleProposals']);
        });

        Route::get('/my-matches', [\App\Http\Controllers\ChampionshipMatchController::class, 'myMatches']);
        Route::get('/{id}/my-schedule', [\App\Http\Controllers\ChampionshipMatchSchedulingController::class, 'getUserSchedule']);
        Route::get('/{id}/instructions', [\App\Http\Controllers\ChampionshipController::class, 'getInstructions']);
        Route::post('/{id}/payment/initiate', [\App\Http\Controllers\ChampionshipPaymentController::class, 'initiatePayment']);
        Route::post('/payment/callback', [\App\Http\Controllers\ChampionshipPaymentController::class, 'handleCallback']);
        Route::post('/payment/refund/{participantId}', [\App\Http\Controllers\ChampionshipPaymentController::class, 'issueRefund']);
    });

    // ── Tournament Administration ─────────────────────────────────────────
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

    // ── Organizations ─────────────────────────────────────────────────────
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

// ─── Public Championship Routes ───────────────────────────────────────────────
Route::prefix('championships')->group(function () {
    Route::get('/', [\App\Http\Controllers\ChampionshipController::class, 'index']);
    Route::get('/{id}', [\App\Http\Controllers\ChampionshipController::class, 'show']);
});

// ─── Public endpoints ─────────────────────────────────────────────────────────
Route::post('/shared-results', [SharedResultController::class, 'store']);
Route::get('/shared-results/{uniqueId}', [SharedResultController::class, 'show']);
Route::get('/shared-results/{uniqueId}/og-data', [SharedResultController::class, 'getOgData']);
