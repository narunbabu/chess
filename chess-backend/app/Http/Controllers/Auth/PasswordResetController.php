<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        // Generic response — never reveal whether email exists
        if (!$user) {
            return response()->json([
                'message' => "If that email is registered, you'll receive a reset link.",
            ]);
        }

        // OAuth users can't reset password — they have no local password
        if ($user->provider !== null) {
            return response()->json([
                'message' => 'This account uses Google login. Please sign in with Google.',
                'oauth' => true,
            ]);
        }

        // Generate token: plain text sent in email, SHA256 hash stored in DB
        $token = Str::random(64);

        $user->update([
            'reset_token' => hash('sha256', $token),
            'reset_token_expires_at' => now()->addHour(),
        ]);

        Mail::to($user)->send(new PasswordResetMail($user, $token));

        return response()->json([
            'message' => "If that email is registered, you'll receive a reset link.",
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || $user->provider !== null) {
            return response()->json(['message' => 'Invalid reset link.'], 422);
        }

        if (!$user->reset_token || !$user->reset_token_expires_at) {
            return response()->json(['message' => 'Invalid reset link.'], 422);
        }

        if ($user->reset_token_expires_at->isPast()) {
            return response()->json([
                'message' => 'This reset link has expired. Please request a new one.',
            ], 422);
        }

        if (!hash_equals($user->reset_token, hash('sha256', $request->token))) {
            return response()->json(['message' => 'Invalid reset link.'], 422);
        }

        // Update password — User model has 'hashed' cast so plain text is auto-hashed
        $user->update([
            'password' => $request->password,
            'reset_token' => null,
            'reset_token_expires_at' => null,
        ]);

        // Revoke all Sanctum tokens — forces re-login on all devices
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password updated successfully. Please log in with your new password.',
        ]);
    }
}
