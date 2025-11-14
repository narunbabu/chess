<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipMatchStatusChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $match;
    public $oldStatus;
    public $newStatus;
    public $changedBy;

    public function __construct(ChampionshipMatch $match, $oldStatus, $newStatus, $changedBy = null)
    {
        $this->match = $match->load(['championship', 'whitePlayer', 'blackPlayer']);
        $this->oldStatus = $oldStatus;
        $this->newStatus = $newStatus;
        $this->changedBy = $changedBy;
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
            'old_status' => $this->oldStatus,
            'new_status' => $this->newStatus,
            'changed_by' => $this->changedBy,
            'championship' => $this->match->championship,
            'round' => $this->match->round,
            'white_player' => $this->match->whitePlayer,
            'black_player' => $this->match->blackPlayer,
            'message' => "Match status changed from {$this->oldStatus} to {$this->newStatus}" .
                        ($this->changedBy ? " by {$this->changedBy->name}" : "")
        ];
    }

    public function broadcastAs()
    {
        return 'championship.match.status_changed';
    }
}