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

class NewGameRequestEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $originalGame;
    public $newGame;
    public $requestingUser;
    public $colorPreference;

    public function __construct(Game $originalGame, Game $newGame, User $requestingUser, string $colorPreference)
    {
        $this->originalGame = $originalGame->load(['whitePlayer', 'blackPlayer']);
        $this->newGame = $newGame->load(['whitePlayer', 'blackPlayer']);
        $this->requestingUser = $requestingUser;
        $this->colorPreference = $colorPreference;

        \Log::info('NewGameRequestEvent constructor called', [
            'original_game_id' => $originalGame->id,
            'new_game_id' => $newGame->id,
            'requester_id' => $requestingUser->id,
            'color_preference' => $colorPreference
        ]);
    }

    public function broadcastOn()
    {
        // Send to the opponent in the original game
        $opponentId = ($this->requestingUser->id === $this->originalGame->white_player_id)
            ? $this->originalGame->black_player_id
            : $this->originalGame->white_player_id;

        $channel = 'App.Models.User.' . $opponentId;

        \Log::info('NewGameRequestEvent broadcastOn called', [
            'channel' => $channel,
            'opponent_id' => $opponentId,
            'requester_id' => $this->requestingUser->id
        ]);

        return new PrivateChannel($channel);
    }

    public function broadcastWith()
    {
        $opponentId = ($this->requestingUser->id === $this->originalGame->white_player_id)
            ? $this->originalGame->black_player_id
            : $this->originalGame->white_player_id;

        // Create color preference message
        $colorMessage = '';
        if ($this->colorPreference === 'random') {
            $colorMessage = ' (random colors)';
        } else {
            $colorMessage = " (wants to play as {$this->colorPreference})";
        }

        $data = [
            'type' => 'new_game_challenge',
            'original_game_id' => $this->originalGame->id,
            'new_game_id' => $this->newGame->id,
            'color_preference' => $this->colorPreference,
            'requester_id' => $this->requestingUser->id,
            'requesting_user' => [
                'id' => $this->requestingUser->id,
                'name' => $this->requestingUser->name,
                'avatar' => $this->requestingUser->avatar ?? null
            ],
            'opponent_id' => $opponentId,
            'new_game' => [
                'id' => $this->newGame->id,
                'status' => $this->newGame->status,
                'white_player' => [
                    'id' => $this->newGame->whitePlayer->id,
                    'name' => $this->newGame->whitePlayer->name,
                    'avatar' => $this->newGame->whitePlayer->avatar ?? null,
                    'rating' => $this->newGame->whitePlayer->rating ?? 1200
                ],
                'black_player' => [
                    'id' => $this->newGame->blackPlayer->id,
                    'name' => $this->newGame->blackPlayer->name,
                    'avatar' => $this->newGame->blackPlayer->avatar ?? null,
                    'rating' => $this->newGame->blackPlayer->rating ?? 1200
                ]
            ],
            'message' => "{$this->requestingUser->name} challenges you to a new game{$colorMessage}!",
            'created_at' => now()->toIso8601String()
        ];

        \Log::info('NewGameRequestEvent broadcastWith data', [
            'event_name' => $this->broadcastAs(),
            'data_keys' => array_keys($data),
            'new_game_id' => $data['new_game_id'],
            'opponent_id' => $data['opponent_id']
        ]);

        return $data;
    }

    public function broadcastAs()
    {
        $eventName = 'new_game.request';

        \Log::info('NewGameRequestEvent broadcastAs called', [
            'event_name' => $eventName
        ]);

        return $eventName;
    }
}
