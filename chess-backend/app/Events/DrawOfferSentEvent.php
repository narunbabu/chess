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

class DrawOfferSentEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $offerer;
    public $opponent;

    public function __construct(Game $game, User $offerer, User $opponent)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->offerer = $offerer;
        $this->opponent = $opponent;
    }

    public function broadcastOn(): array
    {
        // Broadcast on the game channel so both players receive it reliably.
        // The frontend filters by offerer_id to avoid showing the dialog to the sender.
        return [new PrivateChannel('game.' . $this->game->id)];
    }

    public function broadcastWith(): array
    {
        return [
            'type' => 'draw_offer',
            'game_id' => $this->game->id,
            'offerer_id' => $this->offerer->id,
            'offerer' => [
                'id' => $this->offerer->id,
                'name' => $this->offerer->name,
            ],
            'opponent_id' => $this->opponent->id,
        ];
    }

    public function broadcastAs()
    {
        return 'draw.offer.sent';
    }
}
