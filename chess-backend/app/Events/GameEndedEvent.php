<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GameEndedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $gameId;
    public $gameData;

    /**
     * Create a new event instance.
     */
    public function __construct(int $gameId, array $gameData)
    {
        $this->gameId = $gameId;
        $this->gameData = $gameData;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("game.{$this->gameId}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'game.ended';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'game_id' => $this->gameId,
            'game_over' => $this->gameData['game_over'] ?? true,
            'result' => $this->gameData['result'] ?? null,
            'end_reason' => $this->gameData['end_reason'] ?? null,
            'winner_user_id' => $this->gameData['winner_user_id'] ?? null,
            'winner_player' => $this->gameData['winner_player'] ?? null,
            'fen_final' => $this->gameData['fen_final'] ?? null,
            'move_count' => $this->gameData['move_count'] ?? 0,
            'ended_at' => $this->gameData['ended_at'] ?? null,
            'white_player' => $this->gameData['white_player'] ?? null,
            'black_player' => $this->gameData['black_player'] ?? null,
            'timestamp' => now()->toISOString(),
        ];
    }
}