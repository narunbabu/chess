<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use App\Models\Game;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipGameCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $championshipMatch;
    public $user;
    public $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(Game $game, ChampionshipMatch $championshipMatch, User $user)
    {
        $this->game = $game;
        $this->championshipMatch = $championshipMatch;
        $this->user = $user;
        $this->timestamp = now()->toISOString();
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // Broadcast to both players in the game
        $channels = [
            new PrivateChannel('user.' . $this->game->white_player_id),
        ];

        if ($this->game->black_player_id) {
            $channels[] = new PrivateChannel('user.' . $this->game->black_player_id);
        }

        // Also broadcast to game channel for real-time game updates
        $channels[] = new PrivateChannel('game.' . $this->game->id);

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.game.created';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'game' => [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'status' => $this->game->status,
                'fen' => $this->game->fen,
                'turn' => $this->game->turn,
                'created_at' => $this->game->created_at->toISOString(),
            ],
            'championship_match' => [
                'id' => $this->championshipMatch->id,
                'championship_id' => $this->championshipMatch->championship_id,
                'round_number' => $this->championshipMatch->round_number,
                'round_type' => $this->championshipMatch->round_type,
                'deadline' => $this->championshipMatch->deadline,
            ],
            'players' => [
                'white' => [
                    'id' => $this->game->whitePlayer->id,
                    'name' => $this->game->whitePlayer->name,
                ],
                'black' => $this->game->blackPlayer ? [
                    'id' => $this->game->blackPlayer->id,
                    'name' => $this->game->blackPlayer->name,
                ] : null,
            ],
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'redirect_url' => "/play/{$this->game->id}",
            'timestamp' => $this->timestamp,
        ];
    }
}