<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MatchRequestCancelled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $matchRequestToken;
    public int $targetUserId;

    public function __construct(string $matchRequestToken, int $targetUserId)
    {
        $this->matchRequestToken = $matchRequestToken;
        $this->targetUserId = $targetUserId;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->targetUserId);
    }

    public function broadcastWith()
    {
        return [
            'match_request_token' => $this->matchRequestToken,
        ];
    }

    public function broadcastAs()
    {
        return 'match.request.cancelled';
    }
}
