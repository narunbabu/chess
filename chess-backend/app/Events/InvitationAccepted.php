<?php

namespace App\Events;

use App\Models\Game;
use App\Models\Invitation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InvitationAccepted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $invitation;

    public function __construct(Game $game, Invitation $invitation)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->invitation = $invitation->load(['inviter', 'invited']);
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->invitation->inviter_id);
    }

    public function broadcastWith()
    {
        return [
            'game' => $this->game,
            'invitation' => $this->invitation
        ];
    }

    public function broadcastAs()
    {
        return 'invitation.accepted';
    }
}