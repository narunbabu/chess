<?php

namespace App\Events;

use App\Models\Game;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GameConnectionEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $user;
    public $connectionType;
    public $connectionData;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User $user
     * @param string $connectionType ('join', 'leave', 'reconnect', 'disconnect')
     * @param array $connectionData
     */
    public function __construct(Game $game, User $user, string $connectionType, array $connectionData = [])
    {
        $this->game = $game;
        $this->user = $user;
        $this->connectionType = $connectionType;
        $this->connectionData = array_merge([
            'timestamp' => now()->toISOString(),
            'user_id' => $user->id,
            'game_id' => $game->id,
            'connection_id' => uniqid('conn_', true)
        ], $connectionData);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('game.' . $this->game->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'game.connection';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'type' => $this->connectionType,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'avatar' => $this->user->avatar ?? null,
                'color' => $this->game->getPlayerColor($this->user->id),
            ],
            'game' => [
                'id' => $this->game->id,
                'status' => $this->game->status,
                'turn' => $this->game->turn,
                'players_online' => $this->getOnlinePlayersCount(),
            ],
            'data' => $this->connectionData,
            'timestamp' => $this->connectionData['timestamp']
        ];
    }

    /**
     * Get count of online players for this game
     */
    private function getOnlinePlayersCount(): int
    {
        // This would be implemented with a presence tracking system
        // For now, return estimated count
        return 1;
    }
}
