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

class OpponentPingedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $pingedBy;
    public $pingedByUser;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User $pingedByUser User who sent the ping
     * @return void
     */
    public function __construct(Game $game, User $pingedByUser)
    {
        $this->game = $game;
        $this->pingedBy = $pingedByUser->id;
        $this->pingedByUser = $pingedByUser;
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
        return 'opponent.pinged';
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
            'pinged_by_user_id' => $this->pingedBy,
            'pinged_by_user_name' => $this->pingedByUser->name,
            'pinged_at' => now()->toIso8601String(),
            'message' => $this->pingedByUser->name . ' is waiting for your move!'
        ];
    }
}
