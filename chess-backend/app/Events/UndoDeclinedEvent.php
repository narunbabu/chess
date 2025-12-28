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

class UndoDeclinedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $declinedBy;
    public $declinedByUser;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User $declinedByUser User who declined the undo
     * @return void
     */
    public function __construct(Game $game, User $declinedByUser)
    {
        $this->game = $game;
        $this->declinedBy = $declinedByUser->id;
        $this->declinedByUser = $declinedByUser;
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
        return 'game.undo.declined';
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
            'declined_by_user_id' => $this->declinedBy,
            'declined_by_user_name' => $this->declinedByUser->name,
        ];
    }
}
