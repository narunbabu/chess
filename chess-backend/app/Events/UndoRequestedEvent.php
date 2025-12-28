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

class UndoRequestedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $requestedBy;
    public $requestedByUser;
    public $undoRemaining;

    /**
     * Create a new event instance.
     *
     * @param Game $game
     * @param User $requestedByUser User who requested the undo
     * @param int $undoRemaining Number of undo chances remaining for requester
     * @return void
     */
    public function __construct(Game $game, User $requestedByUser, int $undoRemaining)
    {
        $this->game = $game;
        $this->requestedBy = $requestedByUser->id;
        $this->requestedByUser = $requestedByUser;
        $this->undoRemaining = $undoRemaining;
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
        return 'game.undo.request';
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
            'requested_by_user_id' => $this->requestedBy,
            'requested_by_user_name' => $this->requestedByUser->name,
            'undo_remaining' => $this->undoRemaining,
        ];
    }
}
