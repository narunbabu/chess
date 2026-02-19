<?php

namespace App\Events;

use App\Models\Game;
use App\Models\MatchRequest;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MatchRequestAccepted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public MatchRequest $matchRequest;
    public Game $game;

    public function __construct(MatchRequest $matchRequest, Game $game)
    {
        $this->matchRequest = $matchRequest->load('acceptedBy');
        $this->game = $game;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('App.Models.User.' . $this->matchRequest->requester_id);
    }

    public function broadcastWith()
    {
        $acceptor = $this->matchRequest->acceptedBy;

        return [
            'game' => [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'time_control_minutes' => $this->game->time_control_minutes,
                'increment_seconds' => $this->game->increment_seconds,
            ],
            'match_request' => [
                'token' => $this->matchRequest->token,
                'accepted_by' => [
                    'id' => $acceptor->id,
                    'name' => $acceptor->name,
                    'rating' => $acceptor->rating ?? 1200,
                ],
            ],
        ];
    }

    public function broadcastAs()
    {
        return 'match.request.accepted';
    }
}
