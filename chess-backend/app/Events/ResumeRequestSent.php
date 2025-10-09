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

class ResumeRequestSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $requestingUser;

    public function __construct(Game $game, $requestingUserId)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->requestingUser = \App\Models\User::find($requestingUserId);
    }

    public function broadcastOn()
    {
        // Send to the opponent (user who didn't request the resume)
        $opponentId = ($this->game->resume_requested_by === $this->game->white_player_id)
            ? $this->game->black_player_id
            : $this->game->white_player_id;

        return new PrivateChannel('App.Models.User.' . $opponentId);
    }

    public function broadcastWith()
    {
        $opponentId = ($this->game->resume_requested_by === $this->game->white_player_id)
            ? $this->game->black_player_id
            : $this->game->white_player_id;

        return [
            'type' => 'resume_request',
            'game_id' => $this->game->id,
            'game' => [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'resume_requested_by' => $this->game->resume_requested_by,
                'resume_requested_at' => $this->game->resume_requested_at,
                'resume_request_expires_at' => $this->game->resume_request_expires_at,
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
            'opponent_id' => $opponentId,
            'expires_at' => $this->game->resume_request_expires_at
        ];
    }

    public function broadcastAs()
    {
        return 'resume.request.sent';
    }
}