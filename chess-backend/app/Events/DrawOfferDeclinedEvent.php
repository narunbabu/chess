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

class DrawOfferDeclinedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $game;
    public $decliner;
    public $offerer;

    public function __construct(Game $game, User $decliner, User $offerer)
    {
        $this->game = $game->load(['whitePlayer', 'blackPlayer']);
        $this->decliner = $decliner;
        $this->offerer = $offerer;
    }

    public function broadcastOn()
    {
        // Send to the offerer who will be notified of the decline
        return new PrivateChannel('App.Models.User.' . $this->offerer->id);
    }

    public function broadcastWith()
    {
        return [
            'type' => 'draw_declined',
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
            'decliner' => [
                'id' => $this->decliner->id,
                'name' => $this->decliner->name
            ],
            'offerer_id' => $this->offerer->id
        ];
    }

    public function broadcastAs()
    {
        return 'draw.offer.declined';
    }
}
