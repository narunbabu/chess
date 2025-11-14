<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipMatchInvitationExpired implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $match;
    public $timeoutMinutes;

    public function __construct(ChampionshipMatch $match, $timeoutMinutes)
    {
        $this->match = $match->load(['championship', 'whitePlayer', 'blackPlayer']);
        $this->timeoutMinutes = $timeoutMinutes;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->match->white_player_id),
            new PrivateChannel('App.Models.User.' . $this->match->black_player_id),
            // Also broadcast to tournament organizers
            new PrivateChannel('championship.' . $this->match->championship_id . '.organizers'),
        ];
    }

    public function broadcastWith()
    {
        return [
            'match' => $this->match,
            'timeout_minutes' => $this->timeoutMinutes,
            'championship' => $this->match->championship,
            'round' => $this->match->round,
            'white_player' => $this->match->whitePlayer,
            'black_player' => $this->match->blackPlayer,
            'message' => "Tournament invitation expired after {$this->timeoutMinutes} minutes"
        ];
    }

    public function broadcastAs()
    {
        return 'championship.invitation.expired';
    }
}