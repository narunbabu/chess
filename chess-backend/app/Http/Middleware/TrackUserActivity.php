<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use App\Services\RedisStatusService;

class TrackUserActivity
{
    protected RedisStatusService $redisStatus;

    public function __construct(RedisStatusService $redisStatus)
    {
        $this->redisStatus = $redisStatus;
    }

    /**
     * Handle an incoming request.
     *
     * Update the user's last_activity_at timestamp on each authenticated request.
     * This enables online/offline status detection in the frontend.
     * Also updates Redis for real-time status tracking.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1) Skip non-routed/static asset requests (avatars, assets, storage, favicon)
        $path = ltrim($request->path(), '/');
        $assetPrefixes = ['avatars/', 'assets/', 'storage/', 'favicon.ico', 'robots.txt', 'css/', 'js/', 'images/'];
        foreach ($assetPrefixes as $prefix) {
            if (str_starts_with($path, rtrim($prefix, '/')) || $path === rtrim($prefix, '/')) {
                return $next($request);
            }
        }

        // 2) Only proceed when user is authenticated
        if (!Auth::check()) {
            return $next($request);
        }

        try {
            $user = Auth::user();

            // Only update if last update was more than 1 minute ago to avoid excessive DB writes
            $lastActivity = $user->last_activity_at;

            if (!$lastActivity || $lastActivity->diffInMinutes(now()) >= 1) {
                $user->update([
                    'last_activity_at' => now()
                ]);
            }

            // Always update Redis for real-time tracking (fast, no DB overhead)
            // Redis uses TTL expiration, so frequent updates are fine
            $this->redisStatus->markOnline($user->id);

        } catch (\Throwable $e) {
            // Log and continue — do not block the request
            \Log::warning('TrackUserActivity encountered a non-fatal error: ' . $e->getMessage(), [
                'path' => $path,
                'user_id' => Auth::id() ?? null,
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString()
            ]);
            // Continue processing request so heartbeat/status code can still run
        }

        return $next($request);
    }
}
