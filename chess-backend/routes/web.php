<?php

// routes/web.php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\EmailPreferenceController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome'); // Change this to your desired homepage view
});

// Serve storage files (needed for php artisan serve development server).
// SECURITY (2026-06-12): hardened against path traversal — the resolved path
// must stay inside storage/app/public, and the route is disabled in production
// (nginx serves /storage there).
Route::get('/storage/{path}', function ($path) {
    if (app()->environment('production')) {
        abort(404);
    }

    $publicRoot = realpath(storage_path('app' . DIRECTORY_SEPARATOR . 'public'));
    $filePath = realpath($publicRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path));

    // Reject traversal: resolved path must exist and remain under the public root
    if (
        $publicRoot === false
        || $filePath === false
        || !is_file($filePath)
        || !str_starts_with($filePath, $publicRoot . DIRECTORY_SEPARATOR)
    ) {
        abort(404, 'File not found');
    }

    return response()->file($filePath, [
        'Content-Type' => mime_content_type($filePath),
        'Cache-Control' => 'public, max-age=3600',
    ]);
})->where('path', '.*')->name('storage.local');

// Shared result page with Open Graph meta tags for social media
Route::get('/share/result/{uniqueId}', [\App\Http\Controllers\SharedResultController::class, 'showHtml'])
    ->name('share.result.html');

// Protect the visualizer HTML page
Route::middleware('admin.auth')->group(function () {
    Route::get('/tournament_db_visualizer.html', function () {
        return response()->file(public_path('tournament_db_visualizer.html'));
    });
});

Route::group(['prefix' => 'auth'], function () {
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])->name('auth.redirect');
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])->name('auth.callback');
    // Handle POST requests from some OAuth providers
    Route::post('{provider}/callback', [SocialAuthController::class, 'callback']);
});

// ── Email Preference Routes (signed, no auth required for CAN-SPAM) ─────────
Route::middleware('signed')->group(function () {
    Route::get('/email/unsubscribe', [EmailPreferenceController::class, 'unsubscribe'])
        ->name('email.unsubscribe');
    Route::get('/email/preferences', [EmailPreferenceController::class, 'showPreferences'])
        ->name('email.preferences');
    Route::post('/email/preferences', [EmailPreferenceController::class, 'updatePreferences'])
        ->name('email.preferences.update');
});

// Catch-all route for development tools and unwanted requests
Route::any('/{path}', function ($path) {
    // Log the request for debugging
    \Log::info('Catch-all route hit', [
        'path' => $path,
        'method' => request()->method(),
        'user_agent' => request()->userAgent(),
        'referer' => request()->header('referer'),
        'ip' => request()->ip()
    ]);

    // Return 404 for unknown routes instead of 500
    return response()->json([
        'error' => 'Route not found',
        'path' => $path,
        'message' => 'The requested route does not exist on this server.'
    ], 404);
})->where('path', '.*')->fallback();
