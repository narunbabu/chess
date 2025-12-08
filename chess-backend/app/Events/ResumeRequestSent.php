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

    /**
     * Handle broadcast failures
     */
    public function broadcastFailed(\Throwable $e)
    {
        \Log::error('ResumeRequestSent broadcast failed', [
            'error_message' => $e->getMessage(),
            'error_trace' => $e->getTraceAsString(),
            'game_id' => $this->game->id,
            'requesting_user_id' => $this->requestingUser->id,
            'timestamp' => now()->toISOString()
        ]);
    }

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

        // Log broadcast details for debugging
        \Log::info('ResumeRequestSent broadcast preparation', [
            'game_id' => $this->game->id,
            'resume_requested_by' => $this->game->resume_requested_by,
            'white_player_id' => $this->game->white_player_id,
            'black_player_id' => $this->game->black_player_id,
            'opponent_id' => $opponentId,
            'channel_name' => 'App.Models.User.' . $opponentId,
            'requesting_user_id' => $this->requestingUser->id,
            'broadcast_timestamp' => now()->toISOString()
        ]);

        return new PrivateChannel('App.Models.User.' . $opponentId);
    }

  
    public function broadcastAs()
    {
        return 'resume.request.sent';
    }

    /**
     * Log successful broadcast
     */
    public function broadcastWith()
    {
        $opponentId = ($this->game->resume_requested_by === $this->game->white_player_id)
            ? $this->game->black_player_id
            : $this->game->white_player_id;

        $data = [
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

        // Log successful broadcast data preparation
        \Log::info('ResumeRequestSent broadcast data prepared', [
            'game_id' => $this->game->id,
            'opponent_id' => $opponentId,
            'event_name' => 'resume.request.sent',
            'broadcast_timestamp' => now()->toISOString()
        ]);

        return $data;
    }
}