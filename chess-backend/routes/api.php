<?php

// routes/api.php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Api\GameHistoryController;
// use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;


Route::group(['middleware' => 'api', 'prefix' => 'auth'], function () {
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
});

// Protected routes for authenticated users (use a middleware like auth:sanctum or auth:api)
Route::middleware('auth:sanctum')->group(function () {
    // List summary (exclude moves) for dashboard or game list
    Route::get('/game-history', [GameHistoryController::class, 'index']);
    // Get full game details (including moves) when user clicks on a game
    Route::get('/game-history/{id}', [GameHistoryController::class, 'show']);
    Route::get('/rankings', [GameHistoryController::class, 'rankings']);
    Route::post('/game-history', [GameHistoryController::class, 'store']);
});

// routes/api.php

Route::get('/public-test', function () {
    Log::info('=== PUBLIC TEST ENDPOINT HIT ===');
    return response()->json([
        'status' => 'success',
        'message' => 'Public test endpoint works!',
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
