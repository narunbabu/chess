<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * GameClockUpdated Event - TURN_UPDATE message
 *
 * Broadcasts server-authoritative clock snapshots to all players in a game.
 * This is the primary synchronization mechanism for chess clocks.
 *
 * Event Types:
 * - TURN_UPDATE: Regular move or heartbeat update
 * - GAME_OVER: Game ended (checkmate, flag, resignation, etc.)
 * - GAME_PAUSED: Game paused by player
 * - GAME_RESUMED: Game resumed after pause
 */
class GameClockUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $gameId;
    public array $clock;
    public string $turn;
    public string $eventType;
    public ?string $winner;
    public ?array $metadata;

    /**
     * Create a new event instance.
     *
     * @param int $gameId Game ID
     * @param array $clock Clock snapshot from ClockService
     * @param string $turn Current turn ('white' or 'black')
     * @param string $eventType Event type (TURN_UPDATE, GAME_OVER, etc.)
     * @param string|null $winner Winner if game over ('white', 'black', or null for draw)
     * @param array|null $metadata Additional metadata (move notation, end reason, etc.)
     */
    public function __construct(
        int $gameId,
        array $clock,
        string $turn,
        string $eventType = 'TURN_UPDATE',
        ?string $winner = null,
        ?array $metadata = null
    ) {
        $this->gameId = $gameId;
        $this->clock = $clock;
        $this->turn = $turn;
        $this->eventType = $eventType;
        $this->winner = $winner;
        $this->metadata = $metadata ?? [];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("game.{$this->gameId}"),
        ];
    }

    /**
     * The event's broadcast name.
     *
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'clock.updated';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array
     */
    public function broadcastWith(): array
    {
        $payload = [
            'type' => $this->eventType,
            'game_id' => $this->gameId,
            'revision' => $this->clock['revision'] ?? 0,
            'clock' => [
                'white_ms' => $this->clock['white_ms'] ?? 0,
                'black_ms' => $this->clock['black_ms'] ?? 0,
                'running' => $this->clock['running'] ?? null,
                'last_server_ms' => $this->clock['last_server_ms'] ?? 0,
                'increment_ms' => $this->clock['increment_ms'] ?? 0,
                'status' => $this->clock['status'] ?? 'active',
                'reason' => $this->clock['reason'] ?? null,
            ],
            'server_ms' => (int) (microtime(true) * 1000),
            'turn' => $this->turn,
        ];

        // Add winner for game over events
        if ($this->eventType === 'GAME_OVER' && $this->winner !== null) {
            $payload['winner'] = $this->winner;
        }

        // Add metadata if present
        if (!empty($this->metadata)) {
            $payload['metadata'] = $this->metadata;
        }

        return $payload;
    }
}
