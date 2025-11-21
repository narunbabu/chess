<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipGameStartNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $match;
    public $startingPlayer;
    public $opponent;

    /**
     * Create a new event instance.
     */
    public function __construct(ChampionshipMatch $match, User $startingPlayer, User $opponent)
    {
        $this->match = $match;
        $this->startingPlayer = $startingPlayer;
        $this->opponent = $opponent;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->opponent->id),
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'type' => 'championship_game_start',
            'message' => "{$this->startingPlayer->name} is joining the game!",
            'match_id' => $this->match->id,
            'game_id' => $this->match->game_id,
            'championship_id' => $this->match->championship_id,
            'starting_player' => [
                'id' => $this->startingPlayer->id,
                'name' => $this->startingPlayer->name,
                'avatar_url' => $this->startingPlayer->avatar_url,
            ],
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.game.start';
    }
}
