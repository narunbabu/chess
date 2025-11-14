<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InvitationController extends Controller
{
    public function send(Request $request)
    {
        Log::info('📤 Invitation send request received', [
            'request_data' => $request->all(),
            'inviter_id' => Auth::id(),
            'auth_user' => Auth::user()?->email ?? 'unknown'
        ]);

        try {
            $validated = $request->validate([
                'invited_user_id' => 'required|exists:users,id',
                'preferred_color' => 'nullable|in:white,black,random'
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('❌ Invitation validation failed', [
                'errors' => $e->errors(),
                'request_data' => $request->all()
            ]);
            throw $e;
        }

        $inviterId = Auth::id();
        $invitedId = $validated['invited_user_id'];

        Log::info('✅ Invitation data validated', [
            'inviter_id' => $inviterId,
            'invited_id' => $invitedId,
            'preferred_color' => $validated['preferred_color'] ?? 'not specified'
        ]);

        if ($inviterId === (int) $invitedId) {
            Log::warning('⚠️ User tried to invite themselves', [
                'user_id' => $inviterId
            ]);
            return response()->json(['error' => 'Cannot invite yourself'], 400);
        }

        // Check for existing pending invitation and replace it
        $existing = Invitation::where([
            ['inviter_id', $inviterId],
            ['invited_id', $invitedId],
            ['status', 'pending']
        ])->first();

        if ($existing) {
            Log::info('🔄 Found existing pending invitation, replacing it', [
                'existing_invitation_id' => $existing->id,
                'inviter_id' => $inviterId,
                'invited_id' => $invitedId
            ]);

            // Load relationships before deleting for broadcasting
            $existingData = $existing->load(['inviter', 'invited']);

            // Broadcast cancellation event to recipient
            Log::info('🚫 Broadcasting InvitationCancelled event for replacement', [
                'invitation_id' => $existingData->id,
                'invited_user_id' => $existingData->invited_id,
                'channel' => "App.Models.User.{$existingData->invited_id}",
                'event' => 'invitation.cancelled'
            ]);
            broadcast(new \App\Events\InvitationCancelled($existingData));

            // Delete the old invitation
            $existing->delete();

            Log::info('✅ Old invitation deleted, proceeding to create new one');
        }

        // Resolve 'random' immediately to a concrete color
        $colorPreference = $validated['preferred_color'] ?? 'random';
        if ($colorPreference === 'random') {
            $colorPreference = random_int(0, 1) ? 'white' : 'black';
        }

        $invitation = Invitation::create([
            'inviter_id' => $inviterId,
            'invited_id' => $invitedId,
            'status' => 'pending',
            'inviter_preferred_color' => $colorPreference
        ]);

        // Broadcast invitation sent event to recipient in real-time
        $freshInvitation = $invitation->fresh();
        Log::info('📨 Broadcasting InvitationSent event', [
            'invitation_id' => $freshInvitation->id,
            'invited_user_id' => $invitedId,
            'channel' => "App.Models.User.{$invitedId}",
            'event' => 'invitation.sent'
        ]);
        broadcast(new \App\Events\InvitationSent($freshInvitation));

        return response()->json([
            'message' => 'Invitation sent successfully',
            'invitation' => $invitation->load(['inviter', 'invited'])
        ]);
    }

    public function pending()
    {
        $invitations = Invitation::where([
            ['invited_id', Auth::id()],
            ['status', 'pending']
        ])->where(function ($query) {
            // Include all game invitations
            $query->where('type', 'game_invitation')
                  // Only include non-expired resume requests
                  ->orWhere(function ($subQuery) {
                      $subQuery->where('type', 'resume_request')
                               ->where(function ($expQuery) {
                                   $expQuery->whereNull('expires_at')
                                           ->orWhere('expires_at', '>', now());
                               });
                  });
        })->with(['inviter', 'game'])->get();

        return response()->json($invitations);
    }

    public function sent()
    {
        $invitations = Invitation::where('inviter_id', Auth::id())
            ->whereIn('status', ['pending', 'accepted'])
            ->where(function ($query) {
                // Include all game invitations
                $query->where('type', 'game_invitation')
                      // Only include non-expired resume requests
                      ->orWhere(function ($subQuery) {
                          $subQuery->where('type', 'resume_request')
                                   ->where(function ($expQuery) {
                                       $expQuery->whereNull('expires_at')
                                               ->orWhere('expires_at', '>', now());
                                   });
                      });
            })->with(['invited', 'game'])
            ->get();

        return response()->json($invitations);
    }

    public function accepted()
    {
        $invitations = Invitation::where('inviter_id', Auth::id())
            ->acceptedActive()
            ->with(['invited', 'game'])
            ->latest('updated_at')
            ->get();

        return response()->json($invitations);
    }

    public function cancel($id)
    {
        $invitation = Invitation::where([
            ['id', $id],
            ['inviter_id', Auth::id()],
            ['status', 'pending']
        ])->first();

        if (!$invitation) {
            return response()->json(['error' => 'Invitation not found or already responded'], 404);
        }

        // Load relationships before deleting so we can broadcast
        $invitationData = $invitation->load(['inviter', 'invited']);

        // Broadcast cancellation event to recipient in real-time
        Log::info('🚫 Broadcasting InvitationCancelled event', [
            'invitation_id' => $invitationData->id,
            'invited_user_id' => $invitationData->invited_id,
            'channel' => "App.Models.User.{$invitationData->invited_id}",
            'event' => 'invitation.cancelled'
        ]);
        broadcast(new \App\Events\InvitationCancelled($invitationData));

        $invitation->delete();

        return response()->json(['message' => 'Invitation cancelled successfully']);
    }

    public function respond(Request $request, $id)
    {
        Log::info('InvitationController@respond called', [
            'invitation_id_param' => $id,
            'authenticated_user_id' => Auth::id(),
            'request_action' => $request->input('action'),
            'request_color_choice' => $request->input('color_choice'),
        ]);

        $validated = $request->validate([
            'action'        => 'required|in:accept,decline',
            'desired_color' => 'nullable|in:white,black',
        ]);

        $invitation = Invitation::find($id);
        if (!$invitation) {
            return response()->json(['error' => 'Invitation not found'], 404);
        }

        if ((int) $invitation->invited_id !== (int) Auth::id()) {
            return response()->json(['error' => 'Only invited user may respond'], 403);
        }

        if ($invitation->status !== 'pending') {
            return response()->json(['error' => 'Invitation already ' . $invitation->status], 409);
        }

        // Check if this is a championship match invitation
        if ($invitation->championship_match_id) {
            return $this->respondToChampionshipInvitation($request, $invitation, $validated);
        }

        // Handle regular game invitation
        return DB::transaction(function () use ($invitation, $validated) {

            if ($validated['action'] === 'decline') {
                $invitation->update([
                    'status'       => 'declined',
                    'responded_by' => Auth::id(),
                    'responded_at' => now(),
                ]);

                // optional broadcast: broadcast(new InvitationDeclined($invitation->fresh()))->toOthers();
                return response()->json(['message' => 'Declined']);
            }

            // accept
            $acceptorId = Auth::id();                // person accepting the invitation
            $inviterId  = $invitation->inviter_id;   // person who sent the invitation

            // If UI didn't send it, default to "opposite of inviter's wish"
            $inviterWants = $invitation->inviter_preferred_color; // 'white' or 'black'
            $desired = $validated['desired_color']
                ?? ($inviterWants === 'white' ? 'black' : 'white');

            // Assign colors based on what the acceptor wants
            if ($desired === 'white') {
                $whiteId = $acceptorId;
                $blackId = $inviterId;
            } else {
                $whiteId = $inviterId;
                $blackId = $acceptorId;
            }

            Log::info('🎨 Final color assignment', [
                'inviter_id'        => $inviterId,
                'invited_id'        => $invitation->invited_id,
                'inviter_wants'     => $inviterWants,
                'acceptor_desired'  => $desired,
                'white_player_id'   => $whiteId,
                'black_player_id'   => $blackId,
            ]);

            $game = Game::create([
                'white_player_id' => $whiteId,
                'black_player_id' => $blackId,
                'status'          => 'waiting',
                'result'          => 'ongoing',
            ]);

            Log::info('🎮 Game created:', [
                'game_id' => $game->id,
                'white_player_id' => $game->white_player_id,
                'black_player_id' => $game->black_player_id
            ]);

            $invitation->update([
                'status'       => 'accepted',
                'responded_by' => Auth::id(),
                'responded_at' => now(),
                'game_id'      => $game->id,
            ]);

            // Broadcast invitation accepted event to inviter in real-time
            $freshInvitation = $invitation->fresh();
            Log::info('🎉 Broadcasting InvitationAccepted event', [
                'invitation_id' => $freshInvitation->id,
                'game_id' => $game->id,
                'inviter_user_id' => $inviterId,
                'channel' => "App.Models.User.{$inviterId}",
                'event' => 'invitation.accepted'
            ]);
            broadcast(new \App\Events\InvitationAccepted($game, $freshInvitation));

            return response()->json([
                'message'      => 'Accepted',
                'game'         => $game->load(['statusRelation', 'endReasonRelation', 'whitePlayer', 'blackPlayer']),
                'player_color' => Auth::id() === (int) $whiteId ? 'white' : 'black',
            ]);
        }); // 👈 DO NOT delete this closing "});"
    }

    /**
     * Handle championship match invitation responses
     */
    private function respondToChampionshipInvitation(Request $request, Invitation $invitation, array $validated)
    {
        try {
            // Use the championship match invitation service
            $service = new \App\Services\ChampionshipMatchInvitationService();

            $result = $service->handleInvitationResponse(
                $invitation,
                Auth::user(),
                $validated['action'],
                $validated['desired_color'] ?? null
            );

            if ($result['success']) {
                return response()->json([
                    'message' => $validated['action'] === 'accept' ? 'Invitation accepted' : 'Invitation declined',
                    'game' => $result['game'] ?? null,
                    'player_color' => $result['player_color'] ?? null,
                    'championship_context' => $result['championship_context'] ?? null
                ]);
            } else {
                return response()->json([
                    'error' => $result['error'] ?? 'Failed to process invitation response'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Failed to handle championship invitation response', [
                'invitation_id' => $invitation->id,
                'user_id' => Auth::id(),
                'action' => $validated['action'],
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to process championship invitation: ' . $e->getMessage()
            ], 500);
        }
    }
}