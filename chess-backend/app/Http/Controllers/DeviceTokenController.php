<?php

namespace App\Http\Controllers;

use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceTokenController extends Controller
{
    /**
     * Register a device token for push notifications.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_token' => 'required|string|max:512',
            'platform' => 'required|in:android,ios',
            'device_name' => 'nullable|string|max:255',
        ]);

        $token = DeviceToken::updateOrCreate(
            ['device_token' => $validated['device_token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $validated['platform'],
                'device_name' => $validated['device_name'] ?? null,
                'is_active' => true,
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Device token registered',
            'device_token' => $token,
        ], 201);
    }

    /**
     * Deactivate a device token (on logout or app uninstall).
     */
    public function destroy(string $token): JsonResponse
    {
        $deleted = DeviceToken::where('device_token', $token)
            ->where('user_id', request()->user()->id)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status' => 'error',
                'message' => 'Device token not found',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Device token removed',
        ]);
    }

    /**
     * List current user's registered devices.
     */
    public function index(Request $request): JsonResponse
    {
        $tokens = DeviceToken::where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->get(['id', 'platform', 'device_name', 'created_at']);

        return response()->json([
            'status' => 'success',
            'devices' => $tokens,
        ]);
    }
}
