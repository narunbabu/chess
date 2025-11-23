<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipMatchInvitationAccepted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $match;
    public $acceptedBy;
    public $game;

    public function __construct(ChampionshipMatch $match, $acceptedBy, $game = null)
    {
        // Load minimal data to avoid "Payload too large" Pusher error
        $this->match = $match->load(['whitePlayer:id,name', 'blackPlayer:id,name']);
        $this->acceptedBy = $acceptedBy;
        $this->game = $game ? $game->load(['whitePlayer:id,name', 'blackPlayer:id,name']) : null;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->match->white_player_id),
            new PrivateChannel('App.Models.User.' . $this->match->black_player_id),
            // Also broadcast to tournament organizers
            new PrivateChannel('championship.' . $this->match->championship_id . '.organizers'),
        ];
    }

    public function broadcastWith()
    {
        // Minimize payload to avoid "Payload too large" error
        return [
            'match' => [
                'id' => $this->match->id,
                'championship_id' => $this->match->championship_id,
                'round_number' => $this->match->round_number,
                'game_id' => $this->match->game_id,
            ],
            'game' => $this->game ? [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'status' => $this->game->status,
            ] : null,
            'accepted_by' => [
                'id' => $this->acceptedBy->id,
                'name' => $this->acceptedBy->name,
            ],
            'white_player' => $this->match->whitePlayer ? [
                'id' => $this->match->whitePlayer->id,
                'name' => $this->match->whitePlayer->name,
            ] : null,
            'black_player' => $this->match->blackPlayer ? [
                'id' => $this->match->blackPlayer->id,
                'name' => $this->match->blackPlayer->name,
            ] : null,
            'message' => "Tournament invitation accepted by {$this->acceptedBy->name}"
        ];
    }

    public function broadcastAs()
    {
        return 'championship.invitation.accepted';
    }
}