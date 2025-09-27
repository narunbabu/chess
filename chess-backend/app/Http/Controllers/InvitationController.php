<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\User;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class InvitationController extends Controller
{
    public function send(Request $request)
    {
        $request->validate([
            'invited_user_id' => 'required|exists:users,id'
        ]);

        $inviter = Auth::user();
        $invitedUser = User::find($request->invited_user_id);

        if ($inviter->id === $invitedUser->id) {
            return response()->json(['error' => 'Cannot invite yourself'], 400);
        }

        // Check if there's already a pending invitation
        $existingInvitation = Invitation::where([
            ['inviter_id', $inviter->id],
            ['invited_id', $invitedUser->id],
            ['status', 'pending']
        ])->first();

        if ($existingInvitation) {
            return response()->json(['error' => 'Invitation already sent'], 400);
        }

        $invitation = Invitation::create([
            'inviter_id' => $inviter->id,
            'invited_id' => $invitedUser->id,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Invitation sent successfully',
            'invitation' => $invitation->load(['inviter', 'invited'])
        ]);
    }

    public function respond(Request $request, $id)
    {
        $request->validate([
            'action' => 'required|in:accept,decline'
        ]);

        $invitation = Invitation::where([
            ['id', $id],
            ['invited_id', Auth::id()],
            ['status', 'pending']
        ])->first();

        if (!$invitation) {
            return response()->json(['error' => 'Invitation not found or already responded'], 404);
        }

        $invitation->status = $request->action === 'accept' ? 'accepted' : 'declined';
        $invitation->save();

        $game = null;

        // If invitation is accepted, create a new game
        if ($invitation->status === 'accepted') {
            \Log::info('Creating game for invitation ID: ' . $invitation->id);
            \Log::info('Inviter ID: ' . $invitation->inviter_id . ', Invited ID: ' . $invitation->invited_id);

            // Randomly assign colors
            $isInviterWhite = rand(0, 1) === 1;

            $game = Game::create([
                'white_player_id' => $isInviterWhite ? $invitation->inviter_id : $invitation->invited_id,
                'black_player_id' => $isInviterWhite ? $invitation->invited_id : $invitation->inviter_id,
                'status' => 'active',
                'result' => 'ongoing',
                'turn' => 'white',
                'moves' => []
            ]);

            \Log::info('Game created with ID: ' . $game->id);
            \Log::info('White player: ' . $game->white_player_id . ', Black player: ' . $game->black_player_id);
        }

        $response = [
            'message' => "Invitation {$invitation->status}",
            'invitation' => $invitation->load(['inviter', 'invited'])
        ];

        if ($game) {
            $response['game'] = $game->load(['whitePlayer', 'blackPlayer']);
        }

        return response()->json($response);
    }

    public function pending()
    {
        $pendingInvitations = Invitation::where([
            ['invited_id', Auth::id()],
            ['status', 'pending']
        ])->with(['inviter'])->get();

        return response()->json($pendingInvitations);
    }

    public function sent()
    {
        $sentInvitations = Invitation::where([
            ['inviter_id', Auth::id()],
            ['status', 'pending']
        ])->with(['invited'])->get();

        return response()->json($sentInvitations);
    }

    public function checkAccepted()
    {
        try {
            // Get recently accepted invitations where current user was the inviter
            $acceptedInvitations = Invitation::select('invitations.*')
                ->where('invitations.inviter_id', Auth::id())
                ->where('invitations.status', 'accepted')
                ->get();

            \Log::info('checkAccepted called for user: ' . Auth::id());
            \Log::info('Found invitations: ' . $acceptedInvitations->count());

            $gamesFromAccepted = [];

            foreach ($acceptedInvitations as $invitation) {
                \Log::info('Processing invitation ID: ' . $invitation->id . ' with status: ' . $invitation->status);

                // Find the game created from this invitation
                $game = Game::where(function($query) use ($invitation) {
                    $query->where([
                        ['white_player_id', $invitation->inviter_id],
                        ['black_player_id', $invitation->invited_id]
                    ])->orWhere([
                        ['white_player_id', $invitation->invited_id],
                        ['black_player_id', $invitation->inviter_id]
                    ]);
                })->with(['whitePlayer', 'blackPlayer'])->first();

                \Log::info('Found game: ' . ($game ? $game->id : 'none'));

                if ($game) {
                    // Load the related user data after we've found the game
                    $invitation->load(['invited']);

                    $gamesFromAccepted[] = [
                        'invitation' => $invitation,
                        'game' => $game
                    ];

                    // Return accepted invitations but don't change status
                    // The frontend will handle showing these only once per session
                    \Log::info('Found accepted invitation ' . $invitation->id . ' with game ' . $game->id);
                }
            }

            \Log::info('Returning ' . count($gamesFromAccepted) . ' games from accepted invitations');
            return response()->json($gamesFromAccepted);
        } catch (\Exception $e) {
            \Log::error('Error in checkAccepted: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json(['error' => 'Server error', 'message' => $e->getMessage()], 500);
        }
    }

    public function cancel($id)
    {
        $invitation = Invitation::where([
            ['id', $id],
            ['inviter_id', Auth::id()],
            ['status', 'pending']
        ])->first();

        if (!$invitation) {
            return response()->json(['error' => 'Invitation not found'], 404);
        }

        $invitation->delete();

        return response()->json(['message' => 'Invitation cancelled']);
    }
}