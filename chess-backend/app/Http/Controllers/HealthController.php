<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    /**
     * API health check endpoint.
     * Returns server status, API version, and minimum supported app versions.
     */
    public function index(): JsonResponse
    {
        $dbHealthy = true;
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $dbHealthy = false;
        }

        return response()->json([
            'status' => $dbHealthy ? 'healthy' : 'degraded',
            'api_version' => 'v1',
            'min_supported_app_version' => [
                'android' => '1.0.0',
                'ios' => '1.0.0',
            ],
            'features' => [
                'websocket' => true,
                'push_notifications' => true,
                'apple_sign_in' => true,
                'google_sign_in' => true,
            ],
            'server_time' => now()->toIso8601String(),
        ]);
    }
}
