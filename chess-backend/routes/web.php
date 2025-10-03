<?php

// routes/web.php

use App\Http\Controllers\Auth\SocialAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome'); // Change this to your desired homepage view
});

Route::group(['prefix' => 'auth'], function () {
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])->name('auth.redirect');
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])->name('auth.callback');
    // Handle POST requests from some OAuth providers
    Route::post('{provider}/callback', [SocialAuthController::class, 'callback']);
});