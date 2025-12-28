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

class UndoAcceptedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $acceptedBy;
    public $acceptedByUser;
    public $newFen;
    public $newMoves;
    public $newTurn;
    public $undoWhiteRemaining;
    public $undoBlackRemaining;

    /**
     * Create a new event instance.
     *
     * @param Game $game Updated game after undo
     * @param User $acceptedByUser User who accepted the undo
     * @return void
     */
    public function __construct(Game $game, User $acceptedByUser)
    {
        $this->game = $game;
        $this->acceptedBy = $acceptedByUser->id;
        $this->acceptedByUser = $acceptedByUser;
        $this->newFen = $game->fen;
        $this->newMoves = $game->moves;
        $this->newTurn = $game->turn;
        $this->undoWhiteRemaining = $game->undo_white_remaining;
        $this->undoBlackRemaining = $game->undo_black_remaining;
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
        return 'game.undo.accepted';
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
            'accepted_by_user_id' => $this->acceptedBy,
            'accepted_by_user_name' => $this->acceptedByUser->name,
            'fen' => $this->newFen,
            'moves' => $this->newMoves,
            'turn' => $this->newTurn,
            'move_count' => count($this->newMoves),
            'undo_white_remaining' => $this->undoWhiteRemaining,
            'undo_black_remaining' => $this->undoBlackRemaining,
        ];
    }
}
