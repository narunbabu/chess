
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

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
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'credits' => $user->credits,
                'ref_code' => $user->ref_code,
                'total_games' => $user->total_games,
                'wins' => $user->wins,
                'losses' => $user->losses,
                'draws' => $user->draws,
                'win_rate' => $user->win_rate,
                'current_streak' => $user->current_streak,
                'best_streak' => $user->best_streak
            ]
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'ref_code' => 'nullable|string|size:8|exists:users,ref_code'
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'credits' => 100, // Welcome bonus
            'referred_by' => $validated['ref_code'] ?? null
        ]);

        // Give referral bonus
        if ($validated['ref_code'] ?? null) {
            $referrer = User::where('ref_code', $validated['ref_code'])->first();
            if ($referrer) {
                $referrer->addCredits(25, 'referral', 'Referred ' . $user->name);
                $user->addCredits(25, 'referral', 'Referred by ' . $referrer->name);
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'credits' => $user->fresh()->credits,
                'ref_code' => $user->ref_code,
                'total_games' => $user->total_games,
                'wins' => $user->wins,
                'losses' => $user->losses,
                'draws' => $user->draws,
                'win_rate' => $user->win_rate,
                'current_streak' => $user->current_streak,
                'best_streak' => $user->best_streak
            ]
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        
        return response()->json([
            'status' => 'success',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'credits' => $user->credits,
                'ref_code' => $user->ref_code,
                'total_games' => $user->total_games,
                'wins' => $user->wins,
                'losses' => $user->losses,
                'draws' => $user->draws,
                'win_rate' => $user->win_rate,
                'current_streak' => $user->current_streak,
                'best_streak' => $user->best_streak
            ]
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
}
