
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Api\GameHistoryController;
use App\Http\Controllers\Api\WalletController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Public test endpoint
Route::get('/public-test', function () {
    return response()->json(['message' => 'API is working']);
});

// Auth routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
    
    // Social auth
    Route::get('/{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::get('/{provider}/callback', [SocialAuthController::class, 'callback']);
});

// Game history routes
Route::get('/games/{token}', [GameHistoryController::class, 'showByToken']); // Public share
Route::get('/rankings', [GameHistoryController::class, 'rankings']); // Public rankings

Route::prefix('game-history')->group(function () {
    Route::get('/', [GameHistoryController::class, 'index']);
    Route::post('/', [GameHistoryController::class, 'store']);
    Route::get('/{id}', [GameHistoryController::class, 'show']);
    Route::post('/{id}/share', [GameHistoryController::class, 'generateShare']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Wallet management
    Route::prefix('wallet')->group(function () {
        Route::get('/balance', [WalletController::class, 'balance']);
        Route::get('/transactions', [WalletController::class, 'transactions']);
        Route::post('/transfer', [WalletController::class, 'transfer']);
        Route::post('/purchase', [WalletController::class, 'purchase']);
    });
});
