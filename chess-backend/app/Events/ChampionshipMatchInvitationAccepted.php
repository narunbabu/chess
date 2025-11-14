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

    public function __construct(ChampionshipMatch $match, $acceptedBy)
    {
        $this->match = $match->load(['championship', 'whitePlayer', 'blackPlayer']);
        $this->acceptedBy = $acceptedBy;
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
        return [
            'match' => $this->match,
            'accepted_by' => $this->acceptedBy,
            'championship' => $this->match->championship,
            'round' => $this->match->round,
            'white_player' => $this->match->whitePlayer,
            'black_player' => $this->match->blackPlayer,
            'message' => "Tournament invitation accepted by {$this->acceptedBy->name}"
        ];
    }

    public function broadcastAs()
    {
        return 'championship.invitation.accepted';
    }
}