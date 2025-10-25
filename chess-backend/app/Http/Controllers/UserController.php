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

        $users = User::query();

        if ($query) {
            $users->where('name', 'like', '%' . $query . '%');
        }

        return $users->get(['id', 'name', 'avatar_url', 'rating']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
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

        // Debug request details
        \Log::info('Request details:', [
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'content_length' => $request->header('Content-Length'),
            'all_input' => $request->input(),
            'all_files' => $request->allFiles(),
            'request_data' => $request->all()
        ]);

        // Log incoming request data
        \Log::info('Profile update request:', [
            'user_id' => $user->id,
            'has_name' => $request->has('name'),
            'name_value' => $request->input('name'),
            'has_avatar_file' => $request->hasFile('avatar'),
            'all_files' => $request->allFiles(),
            'all_data' => $request->all()
        ]);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'avatar' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        // Update name if provided
        if (isset($validated['name'])) {
            \Log::info('Updating name from "' . $user->name . '" to "' . $validated['name'] . '"');
            $user->name = $validated['name'];
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
                $avatarPath = $avatarFile->store('avatars', 'public');
                $filename = basename($avatarPath);
                $fullUrl = url('/api/avatars/' . $filename);

                \Log::info('New avatar stored:', [
                    'relative_path' => $avatarPath,
                    'full_url' => $fullUrl,
                    'storage_exists' => Storage::disk('public')->exists($avatarPath)
                ]);

                $user->avatar_url = $fullUrl;
            } catch (\Exception $e) {
                \Log::error('Failed to store avatar:', ['error' => $e->getMessage()]);
                return response()->json([
                    'message' => 'Failed to upload avatar',
                    'error' => $e->getMessage()
                ], 500);
            }
        }

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
