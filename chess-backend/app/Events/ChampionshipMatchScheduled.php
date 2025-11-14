<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipMatchScheduled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $championshipMatch;
    public $user;
    public $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(ChampionshipMatch $championshipMatch, User $user)
    {
        $this->championshipMatch = $championshipMatch;
        $this->user = $user;
        $this->timestamp = now()->toISOString();
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // Broadcast to both players in the match
        $channels = [
            new PrivateChannel('user.' . $this->championshipMatch->player1_id),
        ];

        if ($this->championshipMatch->player2_id) {
            $channels[] = new PrivateChannel('user.' . $this->championshipMatch->player2_id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.match.scheduled';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'championship_match_id' => $this->championshipMatch->id,
            'championship_id' => $this->championshipMatch->championship_id,
            'scheduled_time' => $this->championshipMatch->scheduled_time,
            'game_timeout' => $this->championshipMatch->game_timeout,
            'scheduling_status' => $this->championshipMatch->scheduling_status,
            'players' => [
                'player1' => [
                    'id' => $this->championshipMatch->player1->id,
                    'name' => $this->championshipMatch->player1->name,
                ],
                'player2' => $this->championshipMatch->player2 ? [
                    'id' => $this->championshipMatch->player2->id,
                    'name' => $this->championshipMatch->player2->name,
                ] : null,
            ],
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'timestamp' => $this->timestamp,
        ];
    }
}