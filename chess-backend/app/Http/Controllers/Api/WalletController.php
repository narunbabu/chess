
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\WalletTransaction;

class WalletController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function balance(Request $request)
    {
        return response()->json([
            'credits' => $request->user()->credits
        ]);
    }

    public function transactions(Request $request)
    {
        $transactions = $request->user()
            ->walletTransactions()
            ->with('sourceGame')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($transactions);
    }

    public function transfer(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|integer|min:1',
            'reason' => 'required|string|in:game_win,game_loss,quest_reward,tournament_entry,tournament_win,daily_bonus,admin_adjustment',
            'description' => 'nullable|string',
            'game_id' => 'nullable|exists:game_histories,id'
        ]);

        $user = $request->user();
        
        if ($validated['amount'] > 0) {
            $user->addCredits(
                $validated['amount'],
                $validated['reason'],
                $validated['description'],
                $validated['game_id'] ?? null
            );
        } else {
            if (!$user->deductCredits(
                abs($validated['amount']),
                $validated['reason'],
                $validated['description'],
                $validated['game_id'] ?? null
            )) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Insufficient credits'
                ], 400);
            }
        }

        return response()->json([
            'status' => 'success',
            'credits' => $user->fresh()->credits
        ]);
    }

    public function purchase(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|integer|min:1',
            'payment_id' => 'required|string',
            'payment_method' => 'required|string'
        ]);

        // This would integrate with Razorpay/Stripe
        // For now, we'll just add credits directly
        $user = $request->user();
        $user->addCredits(
            $validated['amount'],
            'purchase',
            'Credit purchase via ' . $validated['payment_method'],
            null,
            ['payment_id' => $validated['payment_id']]
        );

        return response()->json([
            'status' => 'success',
            'credits' => $user->fresh()->credits
        ]);
    }
}
