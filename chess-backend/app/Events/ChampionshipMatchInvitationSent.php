<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipMatchInvitationSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $match;
    public $invitation;

    public function __construct(ChampionshipMatch $match, $invitation)
    {
        $this->match = $match->load(['championship', 'whitePlayer', 'blackPlayer']);
        $this->invitation = $invitation;
    }

    public function broadcastOn()
    {
        // Broadcast to both players in the match
        return [
            new PrivateChannel('App.Models.User.' . $this->match->white_player_id),
            new PrivateChannel('App.Models.User.' . $this->match->black_player_id),
        ];
    }

    public function broadcastWith()
    {
        return [
            'match' => $this->match,
            'invitation' => $this->invitation,
            'championship' => $this->match->championship,
            'round' => $this->match->round,
            'white_player' => $this->match->whitePlayer,
            'black_player' => $this->match->blackPlayer,
            'message' => "Tournament invitation: Round {$this->match->round} match in {$this->match->championship->name}"
        ];
    }

    public function broadcastAs()
    {
        return 'championship.invitation.sent';
    }
}