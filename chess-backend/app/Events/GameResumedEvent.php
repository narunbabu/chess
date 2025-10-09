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

class GameResumedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $resumedBy;
    public $whiteTimeRemaining;
    public $blackTimeRemaining;
    public $turn;
    public $graceTimeApplied;

    /**
     * Create a new event instance.
     *
     * @return void
     */
    public function __construct(Game $game, int $resumedBy, array $resumeData)
    {
        $this->game = $game;
        $this->resumedBy = $resumedBy;
        $this->whiteTimeRemaining = $resumeData['white_time_remaining_ms'] ?? null;
        $this->blackTimeRemaining = $resumeData['black_time_remaining_ms'] ?? null;
        $this->turn = $resumeData['turn'] ?? $game->turn;
        $this->graceTimeApplied = $resumeData['grace_time_applied'] ?? [];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return \Illuminate\Broadcasting\Channel|array
     */
    public function broadcastOn()
    {
        return new PrivateChannel('game.' . $this->game->id);
    }

    /**
     * The event's broadcast name.
     *
     * @return string
     */
    public function broadcastAs()
    {
        return 'game.resumed';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array
     */
    public function broadcastWith()
    {
        return [
            'game_id' => $this->game->id,
            'status' => 'active',
            'resumed_by' => $this->resumedBy,
            'resumed_at' => now()->toIso8601String(),
            'white_time_remaining_ms' => $this->whiteTimeRemaining,
            'black_time_remaining_ms' => $this->blackTimeRemaining,
            'turn' => $this->turn,
            'grace_time_applied' => $this->graceTimeApplied,
        ];
    }
}
