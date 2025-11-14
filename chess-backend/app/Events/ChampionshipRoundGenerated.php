<?php

namespace App\Events;

use App\Models\Championship;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipRoundGenerated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $championship;
    public $round;
    public $matches;
    public $byePlayers;

    public function __construct(Championship $championship, $round, $matches, $byePlayers = [])
    {
        $this->championship = $championship;
        $this->round = $round;
        $this->matches = $matches;
        $this->byePlayers = $byePlayers;
    }

    public function broadcastOn()
    {
        return [
            // Broadcast to all participants in this championship
            new PrivateChannel('championship.' . $this->championship->id . '.participants'),
            // Also broadcast to tournament organizers
            new PrivateChannel('championship.' . $this->championship->id . '.organizers'),
        ];
    }

    public function broadcastWith()
    {
        return [
            'championship' => $this->championship,
            'round' => $this->round,
            'matches' => $this->matches->map(function ($match) {
                return [
                    'id' => $match->id,
                    'round' => $match->round,
                    'white_player' => $match->whitePlayer,
                    'black_player' => $match->blackPlayer,
                    'board_number' => $match->board_number,
                    'status' => $match->status,
                ];
            }),
            'bye_players' => $this->byePlayers,
            'total_matches' => $this->matches->count(),
            'total_byes' => count($this->byePlayers),
            'message' => "Round {$this->round} pairings generated for {$this->championship->name}"
        ];
    }

    public function broadcastAs()
    {
        return 'championship.round.generated';
    }
}