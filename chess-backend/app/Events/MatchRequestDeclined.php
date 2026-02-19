<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MatchRequestDeclined implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $matchRequestToken;
    public int $requesterId;
    public int $remainingTargets;

    public function __construct(string $matchRequestToken, int $requesterId, int $remainingTargets)
    {
        $this->matchRequestToken = $matchRequestToken;
        $this->requesterId = $requesterId;
        $this->remainingTargets = $remainingTargets;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->requesterId);
    }

    public function broadcastWith()
    {
        return [
            'match_request_token' => $this->matchRequestToken,
            'remaining_targets' => $this->remainingTargets,
        ];
    }

    public function broadcastAs()
    {
        return 'match.request.declined';
    }
}
