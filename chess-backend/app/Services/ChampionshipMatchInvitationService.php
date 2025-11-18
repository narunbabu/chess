<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\Invitation;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChampionshipMatchInvitationService
{
    /**
     * Enhanced match invitations with batch processing and priority
     */
    public function sendMatchInvitations(Championship $championship, array $matchIds): array
    {
        $invitations = [];

        foreach ($matchIds as $matchId) {
            $match = ChampionshipMatch::find($matchId);
            if (!$match || $match->championship_id !== $championship->id) {
                continue;
            }

            $invitation = $this->createEnhancedMatchInvitation($match);
            if ($invitation) {
                $invitations[] = $invitation;
                $match->markInvitationSent();
            }
        }

        Log::info("Batch championship match invitations sent", [
            'championship_id' => $championship->id,
            'total_matches' => count($matchIds),
            'successful_invitations' => count($invitations),
        ]);

        return $invitations;
    }

    /**
     * Create enhanced match invitation with metadata
     */
    private function createEnhancedMatchInvitation(ChampionshipMatch $match): ?Invitation
    {
        try {
            DB::beginTransaction();

            // Determine which player should be the inviter (lower ID gets to invite)
            $inviterId = min($match->white_player_id ?: $match->player1_id, $match->black_player_id ?: $match->player2_id);
            $invitedId = max($match->white_player_id ?: $match->player1_id, $match->black_player_id ?: $match->player2_id);

            // Check if invitation already exists
            $existingInvitation = $this->findExistingInvitation($inviterId, $invitedId, $match->id);

            if ($existingInvitation) {
                Log::info("Invitation already exists for championship match", [
                    'match_id' => $match->id,
                    'invitation_id' => $existingInvitation->id
                ]);
                DB::rollBack();
                return $existingInvitation;
            }

            // Determine invitation priority based on round and scheduling
            $priority = $this->calculateInvitationPriority($match);

            // Create the enhanced invitation
            $invitation = Invitation::create([
                'inviter_id' => $inviterId,
                'invited_id' => $invitedId,
                'status' => 'pending',
                'type' => 'championship_match',
                'inviter_preferred_color' => $this->getInviterPreferredColor($match, $inviterId),
                'priority' => $priority,
                'expires_at' => now()->addMinutes($match->championship->getInvitationTimeoutMinutes()),
                'championship_match_id' => $match->id,
                'auto_generated' => $match->auto_generated,
                'metadata' => [
                    'championship_id' => $match->championship_id,
                    'round_number' => $match->round_number,
                    'board_number' => $this->getBoardNumber($match),
                    'color_assignment_method' => $match->color_assignment_method,
                    'scheduled_at' => $match->scheduled_at?->toISOString(),
                    'deadline' => $match->deadline->toISOString(),
                ],
            ]);

            // Update match status to pending_invitation
            $match->update([
                'status' => ChampionshipMatchStatus::PENDING_INVITATION,
                'invitation_sent_at' => now(),
            ]);

            DB::commit();

            Log::info("Enhanced championship match invitation created", [
                'match_id' => $match->id,
                'invitation_id' => $invitation->id,
                'inviter_id' => $inviterId,
                'invited_id' => $invitedId,
                'priority' => $priority,
                'expires_at' => $invitation->expires_at
            ]);

            // Broadcast the invitation
            broadcast(new \App\Events\ChampionshipMatchInvitationSent($match, $invitation));

            return $invitation;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to create enhanced championship match invitation", [
                'match_id' => $match->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Find existing invitation for championship match
     */
    private function findExistingInvitation(int $inviterId, int $invitedId, int $matchId): ?Invitation
    {
        return Invitation::where([
            ['type', 'championship_match'],
            ['status', 'pending'],
        ])
        ->where(function ($query) use ($inviterId, $invitedId) {
            $query->where(function ($q) use ($inviterId, $invitedId) {
                $q->where('inviter_id', $inviterId)
                  ->where('invited_id', $invitedId);
            })->orWhere(function ($q) use ($inviterId, $invitedId) {
                $q->where('inviter_id', $invitedId)
                  ->where('invited_id', $inviterId);
            });
        })
        ->where('championship_match_id', $matchId)
        ->first();
    }

    /**
     * Calculate invitation priority based on match context
     */
    private function calculateInvitationPriority(ChampionshipMatch $match): string
    {
        $championship = $match->championship;

        // High priority for elimination rounds
        if ($match->round_type === 'elimination' || $match->round_type === 'final') {
            return 'urgent';
        }

        // High priority for later Swiss rounds
        if ($match->round_number >= $championship->swiss_rounds - 2) {
            return 'high';
        }

        // Normal priority for regular rounds
        return 'normal';
    }

    /**
     * Get board number for match
     */
    private function getBoardNumber(ChampionshipMatch $match): int
    {
        return $match->championship->matches()
            ->where('round_number', $match->round_number)
            ->where('id', '<=', $match->id)
            ->count();
    }

    /**
     * Create a match invitation for a championship match
     */
    private function createMatchInvitation(ChampionshipMatch $match): ?Invitation
    {
        try {
            DB::beginTransaction();

            // Determine which player should be the inviter (lower ID gets to invite)
            $inviterId = min($match->player1_id, $match->player2_id);
            $invitedId = max($match->player1_id, $match->player2_id);

            // Check if invitation already exists
            $existingInvitation = Invitation::where([
                ['type', 'championship_match'],
                ['status', 'pending'],
            ])
            ->where(function ($query) use ($inviterId, $invitedId) {
                $query->where(function ($q) use ($inviterId, $invitedId) {
                    $q->where('inviter_id', $inviterId)
                      ->where('invited_id', $invitedId);
                })->orWhere(function ($q) use ($inviterId, $invitedId) {
                    $q->where('inviter_id', $invitedId)
                      ->where('invited_id', $inviterId);
                });
            })
            ->first();

            if ($existingInvitation) {
                Log::info("Invitation already exists for championship match", [
                    'match_id' => $match->id,
                    'invitation_id' => $existingInvitation->id
                ]);
                DB::rollBack();
                return $existingInvitation;
            }

            // Create the invitation
            $invitation = Invitation::create([
                'inviter_id' => $inviterId,
                'invited_id' => $invitedId,
                'status' => 'pending',
                'type' => 'championship_match',
                'inviter_preferred_color' => $this->getInviterPreferredColor($match, $inviterId),
                'expires_at' => now()->addHours($match->championship->match_time_window_hours),
            ]);

            // Update match status to pending_invitation
            $match->update([
                'status' => ChampionshipMatchStatus::PENDING_INVITATION
            ]);

            // Link invitation to match via game_id (reusing existing column)
            $invitation->update(['game_id' => $match->id]);

            DB::commit();

            Log::info("Championship match invitation created", [
                'match_id' => $match->id,
                'invitation_id' => $invitation->id,
                'inviter_id' => $inviterId,
                'invited_id' => $invitedId,
                'expires_at' => $invitation->expires_at
            ]);

            // Broadcast the invitation
            broadcast(new \App\Events\ChampionshipMatchInvitationSent($match, $invitation));

            return $invitation;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to create championship match invitation", [
                'match_id' => $match->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Get the inviter's preferred color based on enhanced Swiss pairing color assignment
     */
    private function getInviterPreferredColor(ChampionshipMatch $match, int $inviterId): string
    {
        // Use enhanced color assignment if available
        if ($match->white_player_id && $match->black_player_id) {
            return $match->white_player_id === $inviterId ? 'white' : 'black';
        }

        // Fallback to legacy player1/player2 for backward compatibility
        if ($match->player1_id === $inviterId) {
            return 'white';
        } else {
            return 'black';
        }
    }

    /**
     * Handle match invitation response (accept/decline)
     */
    public function handleInvitationResponse(Invitation $invitation, string $action, ?string $desiredColor = null): array
    {
        if ($invitation->type !== 'championship_match') {
            throw new \InvalidArgumentException('Not a championship match invitation');
        }

        $match = ChampionshipMatch::find($invitation->game_id);
        if (!$match) {
            throw new \InvalidArgumentException('Match not found');
        }

        try {
            DB::beginTransaction();

            if ($action === 'decline') {
                $invitation->update([
                    'status' => 'declined',
                    'responded_by' => auth()->id(),
                    'responded_at' => now(),
                ]);

                // Update match status back to pending
                $match->update(['status' => ChampionshipMatchStatus::PENDING]);

                DB::commit();

                // Broadcast the decline
                $user = auth()->user();
                broadcast(new \App\Events\ChampionshipMatchInvitationDeclined($match, $user));

                return ['message' => 'Match invitation declined', 'match' => $match];
            }

            if ($action === 'accept') {
                // Use pre-assigned colors from Swiss pairing, respect preferences if possible
                $colors = $this->assignFinalColors($match, $invitation, $desiredColor);

                // Create actual game like lobby system does
                $game = \App\Models\Game::create([
                    'white_player_id' => $colors['white'],
                    'black_player_id' => $colors['black'],
                    'status' => 'waiting',
                    'result' => 'ongoing',
                    'championship_match_id' => $match->id,
                ]);

                Log::info('🎮 Championship game created:', [
                    'game_id' => $game->id,
                    'championship_match_id' => $match->id,
                    'white_player_id' => $game->white_player_id,
                    'black_player_id' => $game->black_player_id
                ]);

                // Update match with final player assignments and game link
                $match->update([
                    'player1_id' => $colors['white'], // Legacy support
                    'player2_id' => $colors['black'], // Legacy support
                    'white_player_id' => $colors['white'], // Enhanced color assignment
                    'black_player_id' => $colors['black'], // Enhanced color assignment
                    'status' => ChampionshipMatchStatus::IN_PROGRESS,
                    'game_id' => $game->id,
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($match->championship->match_time_window_hours),
                    'invitation_status' => 'accepted',
                    'invitation_accepted_at' => now(),
                ]);

                // Update invitation with game reference and metadata
                $invitation->update([
                    'status' => 'accepted',
                    'responded_by' => auth()->id(),
                    'responded_at' => now(),
                    'game_id' => $game->id,
                    'desired_color' => $desiredColor,
                    'metadata' => array_merge($invitation->metadata ?? [], [
                        'final_colors' => $colors,
                        'acceptance_time' => now()->toISOString(),
                        'championship_id' => $match->championship_id,
                        'round_number' => $match->round_number,
                    ]),
                ]);

                DB::commit();

                // Broadcast the same InvitationAccepted event as lobby system
                $freshInvitation = $invitation->fresh(['inviter', 'invited']);
                Log::info('🎉 Broadcasting Championship InvitationAccepted event (same as lobby)', [
                    'invitation_id' => $freshInvitation->id,
                    'game_id' => $game->id,
                    'championship_match_id' => $match->id,
                    'inviter_user_id' => $invitation->inviter_id,
                    'channel' => "App.Models.User.{$invitation->inviter_id}",
                    'event' => 'invitation.accepted'
                ]);
                broadcast(new \App\Events\InvitationAccepted($game, $freshInvitation));

                return [
                    'message' => 'Match invitation accepted',
                    'game' => $game->load(['statusRelation', 'endReasonRelation', 'whitePlayer', 'blackPlayer']),
                    'match' => $match->fresh()->load(['whitePlayer', 'blackPlayer']),
                    'player_color' => auth()->id() === $colors['white'] ? 'white' : 'black',
                    'colors' => $colors,
                    'championship_context' => [
                        'championship_id' => $match->championship_id,
                        'round_number' => $match->round_number,
                        'match_id' => $match->id,
                    ]
                ];
            }

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to handle championship match invitation response", [
                'invitation_id' => $invitation->id,
                'match_id' => $match->id,
                'action' => $action,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Enhanced final color assignment based on invitation response and Swiss pairing
     */
    private function assignFinalColors(ChampionshipMatch $match, Invitation $invitation, ?string $desiredColor): array
    {
        $inviterId = $invitation->inviter_id;
        $invitedId = $invitation->invited_id;
        $acceptorId = auth()->id();

        // Check if Swiss pairing already assigned colors (preferred)
        if ($match->white_player_id && $match->black_player_id) {
            $preassignedColors = ['white' => $match->white_player_id, 'black' => $match->black_player_id];

            // Respect desired color if tournament allows preferences and doesn't break balance
            if ($this->shouldRespectColorPreference($match, $desiredColor, $acceptorId)) {
                return $this->adjustColorsForPreference($preassignedColors, $desiredColor, $acceptorId);
            }

            return $preassignedColors;
        }

        // Fallback to legacy assignment with preference handling
        if (!$desiredColor) {
            $desiredColor = $invitation->inviter_preferred_color === 'white' ? 'black' : 'white';
        }

        // Assign colors based on what the acceptor wants
        if ($acceptorId === $invitedId) {
            if ($desiredColor === 'white') {
                return ['white' => $invitedId, 'black' => $inviterId];
            } else {
                return ['white' => $inviterId, 'black' => $invitedId];
            }
        } else {
            // Inviter is accepting (shouldn't happen normally, but handle it)
            if ($desiredColor === 'white') {
                return ['white' => $inviterId, 'black' => $invitedId];
            } else {
                return ['white' => $invitedId, 'black' => $inviterId];
            }
        }
    }

    /**
     * Check if tournament respects color preferences
     */
    private function shouldRespectColorPreference(ChampionshipMatch $match, ?string $desiredColor, int $acceptorId): bool
    {
        if (!$desiredColor) {
            return false;
        }

        $championship = $match->championship;
        return $championship->getSetting('allow_color_preferences', false);
    }

    /**
     * Adjust preassigned colors if preference can be accommodated
     */
    private function adjustColorsForPreference(array $preassignedColors, string $desiredColor, int $acceptorId): array
    {
        $whitePlayerId = $preassignedColors['white'];
        $blackPlayerId = $preassignedColors['black'];

        // If acceptor already has their desired color, no change needed
        if (($desiredColor === 'white' && $whitePlayerId === $acceptorId) ||
            ($desiredColor === 'black' && $blackPlayerId === $acceptorId)) {
            return $preassignedColors;
        }

        // If the other player has the desired color, swap if reasonable
        // This is simplified - in practice you'd want to check color balance impact
        if (($desiredColor === 'white' && $blackPlayerId === $acceptorId) ||
            ($desiredColor === 'black' && $whitePlayerId === $acceptorId)) {
            // Swap colors
            return ['white' => $blackPlayerId, 'black' => $whitePlayerId];
        }

        return $preassignedColors;
    }

    /**
     * Auto-expire pending invitations with event broadcasting
     */
    public function expirePendingInvitations(): int
    {
        $expiredInvitations = Invitation::where('type', 'championship_match')
            ->where('status', 'pending')
            ->where('expires_at', '<', now())
            ->get();

        if ($expiredInvitations->count() > 0) {
            foreach ($expiredInvitations as $invitation) {
                $match = $invitation->championshipMatch;
                if ($match) {
                    // Update invitation status
                    $invitation->update([
                        'status' => 'expired',
                        'responded_at' => now()
                    ]);

                    // Update match status back to pending
                    $match->update(['status' => ChampionshipMatchStatus::PENDING]);

                    // Broadcast expiration event
                    $timeoutMinutes = $match->championship->getInvitationTimeoutMinutes();
                    broadcast(new \App\Events\ChampionshipMatchInvitationExpired($match, $timeoutMinutes));
                }
            }

            Log::info("Expired championship match invitations", ['count' => $expiredInvitations->count()]);
        }

        return $expiredInvitations->count();
    }
}