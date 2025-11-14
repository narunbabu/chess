<?php

namespace App\Events;

use App\Models\Championship;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipRoundCompleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $championship;
    public $roundNumber;
    public $user;
    public $timestamp;
    public $standings;

    /**
     * Create a new event instance.
     */
    public function __construct(Championship $championship, int $roundNumber, array $standings, User $user = null)
    {
        $this->championship = $championship;
        $this->roundNumber = $roundNumber;
        $this->standings = $standings;
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
        $channels = [
            new PrivateChannel('championship.' . $this->championship->id),
        ];

        // Broadcast to all participants
        foreach ($this->championship->participants as $participant) {
            $channels[] = new PrivateChannel('user.' . $participant->user_id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.round.completed';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'championship_id' => $this->championship->id,
            'championship_title' => $this->championship->title,
            'round_number' => $this->roundNumber,
            'standings' => $this->standings,
            'total_participants' => $this->championship->participants->count(),
            'next_round_ready' => $this->isNextRoundReady(),
            'user' => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ] : null,
            'timestamp' => $this->timestamp,
        ];
    }

    /**
     * Check if the next round is ready to be generated
     */
    private function isNextRoundReady(): bool
    {
        // Check if all matches in the current round are completed
        $currentRoundMatches = $this->championship->matches()
            ->where('round_number', $this->roundNumber)
            ->get();

        $completedMatches = $currentRoundMatches->where('status', 'completed');

        return $currentRoundMatches->count() === $completedMatches->count();
    }
}