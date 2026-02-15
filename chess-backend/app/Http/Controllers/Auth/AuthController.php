<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid credentials'
            ], 401);
        }

        $user = User::where('email', $request->email)->first();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'user' => $user
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'user' => $user
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Handle Google OAuth for mobile apps (Android/iOS)
     * Verifies Google ID token using Google's tokeninfo API
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function googleMobileLogin(Request $request)
    {
        Log::info('=== MOBILE GOOGLE LOGIN REQUEST ===');
        Log::info('Request IP: ' . $request->ip());
        Log::info('User Agent: ' . $request->userAgent());

        $request->validate([
            'idToken' => 'required|string',
        ]);

        $idToken = $request->input('idToken');
        Log::info('Received ID token (first 50 chars): ' . substr($idToken, 0, 50));

        try {
            // Verify the ID token using Google's tokeninfo endpoint
            $response = Http::get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $idToken,
            ]);

            if (!$response->successful()) {
                Log::error('Token verification failed', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid Google ID token'
                ], 401);
            }

            $payload = $response->json();

            // Verify the token is for our app
            $clientId = config('services.google.client_id');
            if ($payload['aud'] !== $clientId) {
                Log::error('Token audience mismatch', [
                    'expected' => $clientId,
                    'received' => $payload['aud']
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid token audience'
                ], 401);
            }

            Log::info('=== TOKEN VERIFIED SUCCESSFULLY ===');
            Log::info('User Email: ' . $payload['email']);
            Log::info('User Name: ' . ($payload['name'] ?? 'N/A'));
            Log::info('Google ID: ' . $payload['sub']);
            Log::info('Email Verified: ' . ($payload['email_verified'] ? 'YES' : 'NO'));

            // Extract user information from payload
            $googleId = $payload['sub'];
            $email = $payload['email'];
            $name = $payload['name'] ?? explode('@', $email)[0];
            $avatarUrl = $payload['picture'] ?? null;

            Log::info('Avatar URL from Google: ' . ($avatarUrl ?? 'NULL'));

            // Find or create user
            $user = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'provider' => 'google',
                    'provider_id' => $googleId,
                    'email_verified_at' => ($payload['email_verified'] ?? false) ? now() : null,
                ]
            );

            Log::info('=== USER CREATED/UPDATED ===');
            Log::info('User ID: ' . $user->id);
            Log::info('User Name: ' . $user->name);
            Log::info('User Email: ' . $user->email);

            // Download and store avatar locally if provided
            if ($avatarUrl) {
                Log::info('Attempting to download and store avatar locally...');
                $localAvatarPath = $this->downloadAndStoreAvatar($avatarUrl, $user->id);

                if ($localAvatarPath) {
                    $user->avatar_url = $localAvatarPath;
                    $user->save();
                    Log::info('Avatar downloaded and stored locally at: ' . $localAvatarPath);
                } else {
                    Log::warning('Failed to download avatar, user will use default');
                }
            }

            // Generate JWT token using Laravel Sanctum
            $token = $user->createToken('mobile_auth_token')->plainTextToken;

            Log::info('=== AUTHENTICATION SUCCESSFUL ===');
            Log::info('Generated token for user: ' . $user->id);

            return response()->json([
                'status' => 'success',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $user->avatar_url,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('=== MOBILE GOOGLE LOGIN ERROR ===');
            Log::error('Error message: ' . $e->getMessage());
            Log::error('Error code: ' . $e->getCode());
            Log::error('Error file: ' . $e->getFile());
            Log::error('Error line: ' . $e->getLine());
            Log::error('Stack trace: ' . $e->getTraceAsString());

            return response()->json([
                'status' => 'error',
                'message' => 'Authentication failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Refresh the current Sanctum token (revoke old, issue new).
     * Mobile apps should call this periodically or on 401 responses.
     */
    public function refreshToken(Request $request)
    {
        $request->validate([
            'device_name' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $deviceName = $request->input('device_name', 'mobile_auth_token');

        // Revoke the current token
        $request->user()->currentAccessToken()->delete();

        // Issue a new token
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
            ],
        ]);
    }

    /**
     * Revoke all tokens for the authenticated user (e.g., sign out everywhere).
     */
    public function revokeAllTokens(Request $request)
    {
        $count = $request->user()->tokens()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'All tokens revoked',
            'tokens_revoked' => $count,
        ]);
    }

    /**
     * Handle Apple Sign-In for mobile apps (iOS requirement).
     * Verifies Apple identity token and creates/updates user.
     */
    public function appleMobileLogin(Request $request)
    {
        Log::info('=== MOBILE APPLE LOGIN REQUEST ===');

        $request->validate([
            'identity_token' => 'required|string',
            'authorization_code' => 'nullable|string',
            'user_name' => 'nullable|string|max:255',
            'user_email' => 'nullable|email|max:255',
        ]);

        try {
            $identityToken = $request->input('identity_token');

            // Decode the JWT header to get the key ID
            $tokenParts = explode('.', $identityToken);
            if (count($tokenParts) !== 3) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid identity token format',
                ], 401);
            }

            $payload = json_decode(base64_decode(strtr($tokenParts[1], '-_', '+/')), true);

            if (!$payload || !isset($payload['sub']) || !isset($payload['iss'])) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid token payload',
                ], 401);
            }

            // Verify issuer is Apple
            if ($payload['iss'] !== 'https://appleid.apple.com') {
                Log::error('Apple token issuer mismatch', ['iss' => $payload['iss']]);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid token issuer',
                ], 401);
            }

            // Verify audience matches our app's bundle ID
            $bundleId = config('services.apple.client_id');
            if ($bundleId && $payload['aud'] !== $bundleId) {
                Log::error('Apple token audience mismatch', [
                    'expected' => $bundleId,
                    'received' => $payload['aud'],
                ]);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid token audience',
                ], 401);
            }

            // Verify token hasn't expired
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Token has expired',
                ], 401);
            }

            $appleUserId = $payload['sub'];
            $email = $payload['email'] ?? $request->input('user_email');
            $name = $request->input('user_name');

            if (!$email) {
                // Apple only sends email on first sign-in; look up by provider_id
                $existingUser = User::where('provider', 'apple')
                    ->where('provider_id', $appleUserId)
                    ->first();

                if (!$existingUser) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Email not provided and user not found. Please try signing in again.',
                    ], 422);
                }

                $user = $existingUser;
            } else {
                // Find or create user
                $user = User::where('email', $email)->first();

                if ($user) {
                    // Update existing user with Apple provider info
                    $user->update([
                        'provider' => 'apple',
                        'provider_id' => $appleUserId,
                        'email_verified_at' => $user->email_verified_at ?? now(),
                    ]);
                    if ($name && !$user->name) {
                        $user->update(['name' => $name]);
                    }
                } else {
                    $user = User::create([
                        'name' => $name ?? explode('@', $email)[0],
                        'email' => $email,
                        'provider' => 'apple',
                        'provider_id' => $appleUserId,
                        'email_verified_at' => now(),
                    ]);
                }
            }

            $token = $user->createToken('mobile_auth_token')->plainTextToken;

            Log::info('=== APPLE AUTHENTICATION SUCCESSFUL ===', ['user_id' => $user->id]);

            return response()->json([
                'status' => 'success',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $user->avatar_url,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('=== MOBILE APPLE LOGIN ERROR ===', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Authentication failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download avatar from external URL and store it locally
     *
     * @param string $url External avatar URL
     * @param int $userId User ID for filename
     * @return string|null Local storage path or null on failure
     */
    private function downloadAndStoreAvatar($url, $userId)
    {
        try {
            // Create a unique filename
            $extension = 'jpg'; // Default extension
            $filename = 'avatars/' . $userId . '_' . time() . '.' . $extension;

            // Download the image with a 10 second timeout
            $imageContent = @file_get_contents($url, false, stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'header' => [
                        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ]
                ]
            ]));

            if ($imageContent === false) {
                Log::warning('Failed to download avatar from: ' . $url);
                return null;
            }

            // Store the image in public storage
            Storage::disk('public')->put($filename, $imageContent);

            // Return the storage path (will be accessible via /storage/avatars/...)
            return $filename;

        } catch (\Exception $e) {
            Log::error('Error downloading avatar: ' . $e->getMessage());
            return null;
        }
    }
}
