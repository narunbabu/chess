<?php

// routes/web.php

use App\Http\Controllers\Auth\SocialAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome'); // Change this to your desired homepage view
});

// Serve storage files (needed for php artisan serve development server)
Route::get('/storage/{path}', function ($path) {
    try {
        \Log::info('Storage route hit', ['path' => $path]);

        // Convert forward slashes to proper directory separators
        $path = str_replace('/', DIRECTORY_SEPARATOR, $path);
        $filePath = storage_path('app' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . $path);

        \Log::info('Resolved file path', ['filePath' => $filePath, 'exists' => file_exists($filePath)]);

        if (!file_exists($filePath)) {
            \Log::error('File not found', ['filePath' => $filePath]);
            abort(404, 'File not found');
        }

        \Log::info('Serving file', ['filePath' => $filePath, 'size' => filesize($filePath)]);

        // Get the file's MIME type
        $mimeType = mime_content_type($filePath);

        return response()->file($filePath, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=3600'
        ]);
    } catch (\Exception $e) {
        \Log::error('Storage route error', [
            'path' => $path,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        abort(500, $e->getMessage());
    }
})->where('path', '.*')->name('storage.local');

Route::group(['prefix' => 'auth'], function () {
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])->name('auth.redirect');
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])->name('auth.callback');
    // Handle POST requests from some OAuth providers
    Route::post('{provider}/callback', [SocialAuthController::class, 'callback']);
});
