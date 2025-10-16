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

    public function broadcastOn()
    {
        // Send to the opponent who will receive the draw offer
        return new PrivateChannel('App.Models.User.' . $this->opponent->id);
    }

    public function broadcastWith()
    {
        return [
            'type' => 'draw_offer',
            'game_id' => $this->game->id,
            'game' => [
                'id' => $this->game->id,
                'white_player_id' => $this->game->white_player_id,
                'black_player_id' => $this->game->black_player_id,
                'status' => $this->game->status,
                'whitePlayer' => [
                    'id' => $this->game->whitePlayer->id,
                    'name' => $this->game->whitePlayer->name
                ],
                'blackPlayer' => [
                    'id' => $this->game->blackPlayer->id,
                    'name' => $this->game->blackPlayer->name
                ]
            ],
            'offerer' => [
                'id' => $this->offerer->id,
                'name' => $this->offerer->name
            ],
            'opponent_id' => $this->opponent->id
        ];
    }

    public function broadcastAs()
    {
        return 'draw.offer.sent';
    }
}
