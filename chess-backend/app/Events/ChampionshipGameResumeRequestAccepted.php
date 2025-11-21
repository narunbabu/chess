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

class ChampionshipGameResumeRequestAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $resumeRequest;

    public function __construct(ChampionshipGameResumeRequest $resumeRequest)
    {
        $this->resumeRequest = $resumeRequest;
    }

    public function broadcastOn(): array
    {
        // Broadcast to BOTH players (requester and recipient)
        return [
            new PrivateChannel('App.Models.User.' . $this->resumeRequest->requester_id),
            new PrivateChannel('App.Models.User.' . $this->resumeRequest->recipient_id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'type' => 'championship_game_resume_accepted',
            'request_id' => $this->resumeRequest->id,
            'match_id' => $this->resumeRequest->championship_match_id,
            'game_id' => $this->resumeRequest->game_id,
            'message' => 'Request accepted! Starting game...',
        ];
    }

    public function broadcastAs(): string
    {
        return 'championship.game.resume.accepted';
    }
}
