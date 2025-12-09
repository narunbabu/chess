<?php

namespace App\Events;

use App\Models\Invitation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InvitationDeclined implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $invitation;

    public function __construct(Invitation $invitation)
    {
        $this->invitation = $invitation->load(['inviter', 'invited']);
    }

    public function broadcastOn()
    {
        // Broadcast to the inviter (the person who sent the invitation)
        return new PrivateChannel('App.Models.User.' . $this->invitation->inviter_id);
    }

    public function broadcastWith()
    {
        return [
            'invitation' => $this->invitation,
            'declined_by' => $this->invitation->invited->name,
            'message' => "{$this->invitation->invited->name} declined your invitation"
        ];
    }

    public function broadcastAs()
    {
        return 'invitation.declined';
    }
}