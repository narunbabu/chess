<?php

namespace App\Events;

use App\Models\Game;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ResumeRequestExpired implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $requestingUser;
    public $respondingUser;

    public function __construct(Game $game, $requestingUserId, $respondingUserId)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->requestingUser = \App\Models\User::find($requestingUserId);
        $this->respondingUser = \App\Models\User::find($respondingUserId);
    }

    public function broadcastOn()
    {
        // Send to both players
        return [
            new PrivateChannel('App.Models.User.' . $this->requestingUser->id),
            new PrivateChannel('App.Models.User.' . $this->respondingUser->id)
        ];
    }

    public function broadcastWith()
    {
        return [
            'type' => 'resume_expired',
            'game_id' => $this->game->id,
            'game' => [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'resume_status' => $this->game->resume_status,
                'whitePlayer' => [
                    'id' => $this->game->whitePlayer->id,
                    'name' => $this->game->whitePlayer->name
                ],
                'blackPlayer' => [
                    'id' => $this->game->blackPlayer->id,
                    'name' => $this->game->blackPlayer->name
                ]
            ],
            'requesting_user' => [
                'id' => $this->requestingUser->id,
                'name' => $this->requestingUser->name
            ],
            'responding_user' => [
                'id' => $this->respondingUser->id,
                'name' => $this->respondingUser->name
            ],
            'expired_at' => now()->toISOString(),
            'message' => 'Resume request expired after 10 seconds'
        ];
    }

    public function broadcastAs()
    {
        return 'resume.request.expired';
    }
}