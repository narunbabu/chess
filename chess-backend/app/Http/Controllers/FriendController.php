<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FriendController extends Controller
{
    public function list(Request $request): JsonResponse
    {
        $userId = Auth::id();

        $friendIds = Friendship::where(function ($q) use ($userId) {
            $q->where('user_id', $userId)
              ->orWhere('friend_id', $userId);
        })
            ->accepted()
            ->get()
            ->map(fn ($f) => $f->user_id === $userId ? $f->friend_id : $f->user_id)
            ->unique()
            ->values();

        $friends = User::whereIn('id', $friendIds)
            ->get(['id', 'name', 'avatar_url', 'rating']);

        return response()->json($friends);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'friend_id' => 'required|exists:users,id',
        ]);

        $userId = Auth::id();
        $friendId = (int) $validated['friend_id'];

        if ($userId === $friendId) {
            return response()->json(['error' => 'Cannot add yourself as a friend'], 400);
        }

        $existing = Friendship::where(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $userId)->where('friend_id', $friendId);
        })->orWhere(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $friendId)->where('friend_id', $userId);
        })->first();

        if ($existing) {
            $status = $existing->status;
            if ($status === 'pending') {
                return response()->json(['error' => 'Friend request already pending'], 400);
            }
            if ($status === 'accepted') {
                return response()->json(['error' => 'Already friends'], 400);
            }
            return response()->json(['error' => 'Friend request already exists'], 400);
        }

        Friendship::create([
            'user_id' => $userId,
            'friend_id' => $friendId,
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Friend request sent'], 201);
    }

    public function accept(Request $request, int $requesterId): JsonResponse
    {
        $userId = Auth::id();

        $friendship = Friendship::where('user_id', $requesterId)
            ->where('friend_id', $userId)
            ->where('status', 'pending')
            ->first();

        if (!$friendship) {
            return response()->json(['error' => 'No pending request found'], 404);
        }

        $friendship->update(['status' => 'accepted']);

        return response()->json(['message' => 'Friend request accepted']);
    }

    public function reject(Request $request, int $requesterId): JsonResponse
    {
        $userId = Auth::id();

        $deleted = Friendship::where('user_id', $requesterId)
            ->where('friend_id', $userId)
            ->where('status', 'pending')
            ->delete();

        if (!$deleted) {
            return response()->json(['error' => 'No pending request found'], 404);
        }

        return response()->json(['message' => 'Friend request rejected']);
    }

    public function pending(Request $request): JsonResponse
    {
        $userId = Auth::id();

        $requesterIds = Friendship::where('friend_id', $userId)
            ->where('status', 'pending')
            ->pluck('user_id');

        $requesters = User::whereIn('id', $requesterIds)
            ->get(['id', 'name', 'avatar_url', 'rating']);

        return response()->json($requesters);
    }

    public function remove(Request $request, int $friendId): JsonResponse
    {
        $userId = Auth::id();

        $deleted = Friendship::where(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $userId)->where('friend_id', $friendId);
        })->orWhere(function ($q) use ($userId, $friendId) {
            $q->where('user_id', $friendId)->where('friend_id', $userId);
        })->delete();

        if (!$deleted) {
            return response()->json(['error' => 'Friendship not found'], 404);
        }

        return response()->json(['message' => 'Friend removed']);
    }
}
