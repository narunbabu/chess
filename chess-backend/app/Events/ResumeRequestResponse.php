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

class ResumeRequestResponse implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $response;
    public $respondingUser;

    public function __construct(Game $game, $response, $respondingUserId)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->response = $response; // 'accepted' or 'declined'
        $this->respondingUser = \App\Models\User::find($respondingUserId);
    }

    public function broadcastOn()
    {
        // Send to the original requester
        return new PrivateChannel('App.Models.User.' . $this->game->resume_requested_by);
    }

    public function broadcastWith()
    {
        return [
            'type' => 'resume_response',
            'game_id' => $this->game->id,
            'response' => $this->response,
            'responding_user' => [
                'id' => $this->respondingUser->id,
                'name' => $this->respondingUser->name
            ],
            'game_status' => $this->game->status,
            'resume_status' => $this->game->resume_status,
            'message' => $this->response === 'accepted'
                ? 'Your resume request was accepted. The game has been resumed.'
                : 'Your resume request was declined.'
        ];
    }

    public function broadcastAs()
    {
        return 'resume.request.response';
    }
}