<?php

namespace App\Events;

use App\Models\ChampionshipGameResumeRequest;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipGameResumeRequestSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $resumeRequest;

    /**
     * Create a new event instance.
     */
    public function __construct(ChampionshipGameResumeRequest $resumeRequest)
    {
        $this->resumeRequest = $resumeRequest;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->resumeRequest->recipient_id),
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'type' => 'championship_game_resume_request',
            'request_id' => $this->resumeRequest->id,
            'match_id' => $this->resumeRequest->championship_match_id,
            'game_id' => $this->resumeRequest->game_id,
            'requester' => [
                'id' => $this->resumeRequest->requester->id,
                'name' => $this->resumeRequest->requester->name,
                'avatar_url' => $this->resumeRequest->requester->avatar_url,
            ],
            'expires_at' => $this->resumeRequest->expires_at->toISOString(),
            'message' => "{$this->resumeRequest->requester->name} wants to start the game. Accept to begin playing!",
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.game.resume.request';
    }
}
