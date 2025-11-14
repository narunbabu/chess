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

class ChampionshipMatchForfeited implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public ChampionshipMatch $match,
        public ?User $winner,
        public ?User $loser
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new Channel('championship.' . $this->match->championship_id),
        ];

        // Broadcast to both players
        if ($this->match->player1) {
            $channels[] = new PrivateChannel('user.' . $this->match->player1_id);
        }
        if ($this->match->player2) {
            $channels[] = new PrivateChannel('user.' . $this->match->player2_id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'championship.match.forfeited';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'match_id' => $this->match->id,
            'championship_id' => $this->match->championship_id,
            'round_number' => $this->match->round_number,
            'result_type' => $this->match->result_type,
            'winner' => $this->winner ? [
                'id' => $this->winner->id,
                'username' => $this->winner->username,
            ] : null,
            'loser' => $this->loser ? [
                'id' => $this->loser->id,
                'username' => $this->loser->username,
            ] : null,
            'players' => [
                'player1' => $this->match->player1 ? [
                    'id' => $this->match->player1->id,
                    'username' => $this->match->player1->username,
                ] : null,
                'player2' => $this->match->player2 ? [
                    'id' => $this->match->player2->id,
                    'username' => $this->match->player2->username,
                ] : null,
            ],
            'message' => $this->getForfeitMessage(),
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Get appropriate forfeit message
     */
    private function getForfeitMessage(): string
    {
        if (!$this->winner && !$this->loser) {
            return 'Match resulted in a double forfeit due to timeout.';
        }

        $winnerName = $this->winner?->username ?? 'Unknown';
        $loserName = $this->loser?->username ?? 'Unknown';

        return "Match forfeited. {$winnerName} wins by default over {$loserName}.";
    }
}