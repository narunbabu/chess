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
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'avatar' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if (isset($validated['name'])) {
            $user->name = $validated['name'];
        }

        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists
            if ($user->avatar_url && Storage::disk('public')->exists(str_replace(asset('storage/'), '', $user->avatar_url))) {
                Storage::disk('public')->delete(str_replace(asset('storage/'), '', $user->avatar_url));
            }

            // Store new avatar
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
            $user->avatar_url = asset('storage/' . $avatarPath);
        }

        $user->save();

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
