<?php

namespace App\Events;

use App\Models\Game;
use App\Models\GameChatMessage;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GameChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Game $game,
        public User $sender,
        public GameChatMessage $chatMessage
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('game.' . $this->game->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'game.chat';
    }

    public function broadcastWith(): array
    {
        return [
            'id'           => $this->chatMessage->id,
            'game_id'      => $this->game->id,
            'sender_id'    => $this->sender->id,
            'sender_name'  => $this->sender->name,
            'message'      => $this->chatMessage->message,
            'created_at'   => $this->chatMessage->created_at->toISOString(),
        ];
    }
}
