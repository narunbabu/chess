<?php

// routes/api.php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\GameHistoryController;
// use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;


Route::group(['middleware' => ['api', 'web'], 'prefix' => 'auth'], function () {
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
    return response()->json([
        'status' => 'success',
        'message' => 'Public test endpoint works!',
    ]);
});


// Public endpoint to store game history (you can allow guest records with user_id null)
// You can also allow this route only if you want to capture online data for logged-in users.
