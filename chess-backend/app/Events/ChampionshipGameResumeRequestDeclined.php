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

class ChampionshipGameResumeRequestDeclined implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $resumeRequest;

    public function __construct(ChampionshipGameResumeRequest $resumeRequest)
    {
        $this->resumeRequest = $resumeRequest;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->resumeRequest->requester_id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'type' => 'championship_game_resume_declined',
            'request_id' => $this->resumeRequest->id,
            'match_id' => $this->resumeRequest->championship_match_id,
            'recipient' => [
                'id' => $this->resumeRequest->recipient->id,
                'name' => $this->resumeRequest->recipient->name,
            ],
            'message' => "{$this->resumeRequest->recipient->name} declined the request",
        ];
    }

    public function broadcastAs(): string
    {
        return 'championship.game.resume.declined';
    }
}
