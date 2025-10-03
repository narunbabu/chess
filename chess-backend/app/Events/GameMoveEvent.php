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

class GameMoveEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $user;
    public $move;
    public $fen;
    public $turn;
    public $moveData;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User $user
     * @param array $move
     * @param string $fen
     * @param string $turn
     * @param array $moveData
     */
    public function __construct(Game $game, User $user, array $move, string $fen, string $turn, array $moveData = [])
    {
        $this->game = $game;
        $this->user = $user;
        $this->move = $move;
        $this->fen = $fen;
        $this->turn = $turn;
        $this->moveData = array_merge([
            'timestamp' => now()->toISOString(),
            'user_id' => $user->id,
            'game_id' => $game->id,
            'move_number' => ($game->moves ? count($game->moves) : 0) + 1
        ], $moveData);
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
        return 'game.move';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'move' => $this->move,
            'fen' => $this->fen,
            'turn' => $this->turn,
            'user_id' => $this->user->id,
            'user_name' => $this->user->name,
            'game_id' => $this->game->id,
            'move_number' => $this->moveData['move_number'],
            'timestamp' => $this->moveData['timestamp']
        ];
    }
}
