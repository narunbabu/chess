<?php

namespace App\Events;

use App\Models\MatchRequest;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MatchRequestReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public MatchRequest $matchRequest;
    public int $targetUserId;

    public function __construct(MatchRequest $matchRequest, int $targetUserId)
    {
        $this->matchRequest = $matchRequest->load('requester');
        $this->targetUserId = $targetUserId;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->targetUserId);
    }

    public function broadcastWith()
    {
        $requester = $this->matchRequest->requester;

        return [
            'match_request' => [
                'token' => $this->matchRequest->token,
                'requester' => [
                    'id' => $requester->id,
                    'name' => $requester->name,
                    'rating' => $requester->rating ?? 1200,
                    'avatar_url' => $requester->google_avatar ?? $requester->avatar,
                ],
                'time_control_minutes' => $this->matchRequest->time_control_minutes,
                'increment_seconds' => $this->matchRequest->increment_seconds,
                'expires_at' => $this->matchRequest->expires_at->toISOString(),
            ],
        ];
    }

    public function broadcastAs()
    {
        return 'match.request.received';
    }
}
