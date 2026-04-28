<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->get('search');

        // Define online threshold (5 minutes)
        $onlineThreshold = now()->subMinutes(5);

        $users = User::query()
                    ->where('last_activity_at', '>=', $onlineThreshold);

        if ($query) {
            $users->where(function ($q) use ($query) {
                $q->where('name', 'like', '%' . $query . '%')
                  ->orWhere('email', 'like', '%' . $query . '%');
            });
        }

        // Return top 10 online users ordered by rating (descending)
        return $users->orderBy('rating', 'desc')
                    ->limit(10)
                    ->get(['id', 'name', 'email', 'avatar_url', 'rating']);
    }

    public function me(Request $request)
    {
        // Load user with roles and organization for frontend
        $user = $request->user()->load(['roles:id,name', 'organization:id,name,type,logo_url,slug']);
        return response()->json($user);
    }

    /**
     * Update user profile (display name and avatar)
     */
    public function updateProfile(Request $request)
    {
        \Log::info('=== PROFILE UPDATE CONTROLLER CALLED ===');
        \Log::info('Timestamp: ' . now()->toISOString());
        \Log::info('Request URL: ' . $request->fullUrl());
        \Log::info('Request Method: ' . $request->method());

        $user = $request->user();
        \Log::info('User authenticated:', ['id' => $user->id, 'name' => $user->name]);


        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'avatar' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
            'avatar_url' => 'sometimes|string|url|max:500',
            'birthday' => 'sometimes|nullable|date|before:today|after:1950-01-01',
            'class_of_study' => 'sometimes|nullable|string|in:Class 1,Class 2,Class 3,Class 4,Class 5,Class 6,Class 7,Class 8,Class 9,Class 10,Class 11,Class 12,Undergraduate,Postgraduate/Masters,PhD/Research,Working Professional,Senior/Retired,Other',
            'board_theme' => 'sometimes|string|max:30',
            'mobile_country_code' => 'sometimes|nullable|string|max:8',
            'mobile_number' => 'sometimes|nullable|string|max:30',
            'tournament_contact_consent' => 'sometimes|boolean',
            'whatsapp_updates_opt_in' => 'sometimes|boolean',
        ]);

        // Normalize mobile_number: strip spaces, hyphens, parens — digits only
        if (array_key_exists('mobile_number', $validated) && !empty($validated['mobile_number'])) {
            $normalized = preg_replace('/[^0-9]/', '', $validated['mobile_number']);
            $countryCode = $validated['mobile_country_code'] ?? $user->mobile_country_code;

            if ($countryCode === '+91') {
                if (strlen($normalized) !== 10) {
                    return response()->json([
                        'message' => 'Indian mobile numbers must be exactly 10 digits.',
                    ], 422);
                }
            } elseif (strlen($normalized) < 6 || strlen($normalized) > 15) {
                return response()->json([
                    'message' => 'Mobile number must be between 6 and 15 digits.',
                ], 422);
            }

            $validated['mobile_number'] = $normalized;
        }

        // Handle mobile fields
        if (array_key_exists('mobile_country_code', $validated)) {
            $user->mobile_country_code = $validated['mobile_country_code'];
        }
        if (array_key_exists('mobile_number', $validated)) {
            $user->mobile_number = $validated['mobile_number'];
        }
        if (array_key_exists('whatsapp_updates_opt_in', $validated)) {
            $user->whatsapp_updates_opt_in = $validated['whatsapp_updates_opt_in'];
        }

        // Set consent timestamp only when toggling ON and not already set
        if ($request->boolean('tournament_contact_consent') && !$user->tournament_contact_consent_at) {
            $user->tournament_contact_consent_at = now();
        }

        // Update name if provided
        if (isset($validated['name'])) {
            \Log::info('Updating name from "' . $user->name . '" to "' . $validated['name'] . '"');
            $user->name = $validated['name'];
        }

        // Update birthday if provided
        if (array_key_exists('birthday', $validated)) {
            $user->birthday = $validated['birthday'];
        }

        // Update class of study if provided
        if (array_key_exists('class_of_study', $validated)) {
            $user->class_of_study = $validated['class_of_study'];
        }

        // Update board theme if provided
        if (isset($validated['board_theme'])) {
            $user->board_theme = $validated['board_theme'];
        }

        // Update avatar from DiceBear URL if provided (no file upload)
        if (isset($validated['avatar_url']) && !$request->hasFile('avatar')) {
            // Only allow DiceBear URLs for safety
            if (str_starts_with($validated['avatar_url'], 'https://api.dicebear.com/')) {
                $user->avatar_url = $validated['avatar_url'];
                \Log::info('Setting DiceBear avatar URL:', ['url' => $validated['avatar_url']]);
            }
        }

        // Update avatar if provided
        if ($request->hasFile('avatar')) {
            $avatarFile = $request->file('avatar');
            \Log::info('Processing avatar file:', [
                'original_name' => $avatarFile->getClientOriginalName(),
                'size' => $avatarFile->getSize(),
                'mime_type' => $avatarFile->getMimeType()
            ]);

            // Delete old avatar if it's a local file (not Google/OAuth)
            if ($user->avatar_url && (str_contains($user->avatar_url, 'storage/') || str_contains($user->avatar_url, '/api/avatars/'))) {
                if (str_contains($user->avatar_url, 'storage/')) {
                    // Old format: http://localhost:8000/storage/avatars/filename.jpg
                    $oldPath = str_replace(asset('storage/'), '', $user->avatar_url);
                } else {
                    // New format: http://localhost:8000/api/avatars/filename.jpg
                    $filename = basename($user->avatar_url);
                    $oldPath = 'avatars/' . $filename;
                }

                \Log::info('Attempting to delete old avatar:', ['path' => $oldPath]);

                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                    \Log::info('Old avatar deleted successfully');
                } else {
                    \Log::info('Old avatar file not found, skipping deletion');
                }
            }

            // Store new avatar
            try {
                // Store the file with explicit visibility
                $avatarPath = $avatarFile->store('avatars', 'public');
                $filename = basename($avatarPath);
                $fullPath = storage_path('app/public/' . $avatarPath);

                // Ensure proper file permissions (644 = rw-r--r--)
                if (file_exists($fullPath)) {
                    chmod($fullPath, 0644);
                    \Log::info('File permissions set', [
                        'path' => $fullPath,
                        'permissions' => substr(sprintf('%o', fileperms($fullPath)), -4)
                    ]);
                }

                // Ensure directory has proper permissions (755 = rwxr-xr-x)
                $dir = dirname($fullPath);
                if (is_dir($dir)) {
                    chmod($dir, 0755);
                    \Log::info('Directory permissions set', [
                        'directory' => $dir,
                        'permissions' => substr(sprintf('%o', fileperms($dir)), -4)
                    ]);
                }

                // Use /api/avatars/ path which works with Laravel's routing on localhost
                // In production, nginx can serve /storage/ directly for better performance
                $fullUrl = url('/api/avatars/' . $filename);

                \Log::info('New avatar stored:', [
                    'relative_path' => $avatarPath,
                    'full_path' => $fullPath,
                    'full_url' => $fullUrl,
                    'storage_exists' => Storage::disk('public')->exists($avatarPath),
                    'file_exists' => file_exists($fullPath),
                    'file_readable' => is_readable($fullPath),
                    'file_size' => filesize($fullPath),
                    'file_permissions' => substr(sprintf('%o', fileperms($fullPath)), -4)
                ]);

                $user->avatar_url = $fullUrl;
            } catch (\Exception $e) {
                \Log::error('Failed to store avatar:', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                return response()->json([
                    'message' => 'Failed to upload avatar',
                    'error' => $e->getMessage()
                ], 500);
            }
        }

        // Mark profile as completed
        $user->profile_completed = true;

        // Save changes
        $user->save();

        \Log::info('Profile updated successfully:', [
            'new_name' => $user->name,
            'new_avatar_url' => $user->avatar_url
        ]);

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user
        ]);
    }

    /**
     * Get user's friends
     */
    public function getFriends(Request $request)
    {
        $user = $request->user();
        $friends = $user->friends()->get(['id', 'name', 'avatar_url', 'rating']);

        return response()->json($friends);
    }

    /**
     * Send friend request
     */
    public function addFriend(Request $request, $friendId)
    {
        $user = $request->user();
        $friend = User::findOrFail($friendId);

        if ($user->id === $friend->id) {
            return response()->json(['error' => 'Cannot add yourself as friend'], 400);
        }

        // Check if already friends or pending
        $existing = \DB::table('user_friends')
            ->where(function ($query) use ($user, $friend) {
                $query->where('user_id', $user->id)->where('friend_id', $friend->id);
            })
            ->orWhere(function ($query) use ($user, $friend) {
                $query->where('user_id', $friend->id)->where('friend_id', $user->id);
            })
            ->first();

        if ($existing) {
            return response()->json(['error' => 'Friend request already exists or you are already friends'], 400);
        }

        $user->sentFriendRequests()->attach($friend->id, ['status' => 'pending']);

        return response()->json(['message' => 'Friend request sent']);
    }

    /**
     * Remove friend
     */
    public function removeFriend(Request $request, $friendId)
    {
        $user = $request->user();
        $friend = User::findOrFail($friendId);

        $user->friends()->detach($friend->id);

        // Also detach if pending
        \DB::table('user_friends')->where('user_id', $user->id)->where('friend_id', $friend->id)->delete();
        \DB::table('user_friends')->where('user_id', $friend->id)->where('friend_id', $user->id)->delete();

        return response()->json(['message' => 'Friend removed']);
    }

    /**
     * Get pending friend requests
     */
    public function getPendingRequests(Request $request)
    {
        $user = $request->user();
        $requests = $user->receivedFriendRequests()->get(['id', 'name', 'avatar_url', 'rating']);

        return response()->json($requests);
    }

    /**
     * Accept friend request
     */
    public function acceptRequest(Request $request, $requesterId)
    {
        $user = $request->user();
        $requester = User::findOrFail($requesterId);

        $pivot = \DB::table('user_friends')
            ->where('user_id', $requester->id)
            ->where('friend_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if (!$pivot) {
            return response()->json(['error' => 'No pending request found'], 404);
        }

        \DB::table('user_friends')
            ->where('id', $pivot->id)
            ->update(['status' => 'accepted']);

        return response()->json(['message' => 'Friend request accepted']);
    }

    /**
     * Update tournament contact info (mobile number, consent, WhatsApp opt-in)
     */
    public function updateTournamentContact(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'mobile_country_code' => 'required|string|max:8',
            'mobile_number' => 'required|string|max:30',
            'tournament_contact_consent' => 'required|accepted',
            'whatsapp_updates_opt_in' => 'sometimes|boolean',
        ]);

        // Normalize mobile_number: strip spaces, hyphens, parens — digits only
        $normalized = preg_replace('/[^0-9]/', '', $validated['mobile_number']);
        $countryCode = $validated['mobile_country_code'];

        if ($countryCode === '+91') {
            if (strlen($normalized) !== 10) {
                return response()->json([
                    'message' => 'Indian mobile numbers must be exactly 10 digits.',
                ], 422);
            }
        } elseif (strlen($normalized) < 6 || strlen($normalized) > 15) {
            return response()->json([
                'message' => 'Mobile number must be between 6 and 15 digits.',
            ], 422);
        }

        $user->mobile_country_code = $validated['mobile_country_code'];
        $user->mobile_number = $normalized;
        $user->whatsapp_updates_opt_in = $validated['whatsapp_updates_opt_in'] ?? false;

        // Set consent timestamp only when toggling ON and not already set
        if ($validated['tournament_contact_consent'] && !$user->tournament_contact_consent_at) {
            $user->tournament_contact_consent_at = now();
        }

        $user->save();

        return response()->json([
            'message' => 'Tournament contact info updated successfully',
            'user' => $user->only([
                'id', 'mobile_country_code', 'mobile_number',
                'tournament_contact_consent_at', 'whatsapp_updates_opt_in',
            ]),
        ]);
    }

    /**
     * Reject friend request
     */
    public function rejectRequest(Request $request, $requesterId)
    {
        $user = $request->user();
        $requester = User::findOrFail($requesterId);

        \DB::table('user_friends')
            ->where('user_id', $requester->id)
            ->where('friend_id', $user->id)
            ->delete();

        return response()->json(['message' => 'Friend request rejected']);
    }
}
