<?php

namespace App\Events;

use App\Models\Game;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GamePausedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $pausedBy;
    public $pausedByUser;
    public $reason;
    public $whiteTimePaused;
    public $blackTimePaused;
    public $turnAtPause;
    public $graceTimePlayer;
    public $graceTimeMs;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User|null $pausedByUser User who caused the pause (whose inactivity triggered it)
     * @param string $reason
     * @param array $pauseData
     * @return void
     */
    public function __construct(Game $game, ?User $pausedByUser, string $reason, array $pauseData)
    {
        $this->game = $game;
        $this->pausedBy = $pausedByUser?->id;
        $this->pausedByUser = $pausedByUser;
        $this->reason = $reason;
        $this->whiteTimePaused = $pauseData['white_time_paused_ms'] ?? null;
        $this->blackTimePaused = $pauseData['black_time_paused_ms'] ?? null;
        $this->turnAtPause = $pauseData['turn_at_pause'] ?? null;
        $this->graceTimePlayer = $pauseData['grace_time_player'] ?? null;
        $this->graceTimeMs = $pauseData['grace_time_ms'] ?? null;
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
        return 'game.paused';
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
            'status' => 'paused',
            'paused_at' => $this->game->paused_at?->toIso8601String(),
            'paused_by_user_id' => $this->pausedBy,
            'paused_by_user_name' => $this->pausedByUser?->name,
            'reason' => $this->reason,
            'white_time_paused_ms' => $this->whiteTimePaused,
            'black_time_paused_ms' => $this->blackTimePaused,
            'turn_at_pause' => $this->turnAtPause,
            'grace_time_player' => $this->graceTimePlayer,
            'grace_time_ms' => $this->graceTimeMs,
        ];
    }
}
