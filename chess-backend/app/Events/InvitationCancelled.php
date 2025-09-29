<?php

namespace App\Events;

use App\Models\Invitation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InvitationCancelled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $invitation;

    public function __construct(Invitation $invitation)
    {
        $this->invitation = $invitation;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->invitation->invited_id);
    }

    public function broadcastWith()
    {
        return [
            'invitation' => $this->invitation->load('inviter', 'invited')
        ];
    }

    public function broadcastAs()
    {
        return 'invitation.cancelled';
    }
}