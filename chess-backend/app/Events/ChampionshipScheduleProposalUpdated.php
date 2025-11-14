<?php

namespace App\Events;

use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChampionshipScheduleProposalUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $championshipMatch;
    public $schedule;
    public $action;
    public $user;
    public $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(ChampionshipMatch $championshipMatch, ChampionshipMatchSchedule $schedule, string $action, User $user)
    {
        $this->championshipMatch = $championshipMatch;
        $this->schedule = $schedule;
        $this->action = $action; // 'proposed', 'accepted', 'alternative_proposed', 'rejected'
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
        return 'championship.schedule.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'championship_match_id' => $this->championshipMatch->id,
            'championship_id' => $this->championshipMatch->championship_id,
            'schedule' => [
                'id' => $this->schedule->id,
                'proposed_time' => $this->schedule->proposed_time,
                'alternative_time' => $this->schedule->alternative_time,
                'status' => $this->schedule->status,
                'proposer' => [
                    'id' => $this->schedule->proposer->id,
                    'name' => $this->schedule->proposer->name,
                ],
                'responder' => $this->schedule->responder ? [
                    'id' => $this->schedule->responder->id,
                    'name' => $this->schedule->responder->name,
                ] : null,
                'proposer_message' => $this->schedule->proposer_message,
                'responder_message' => $this->schedule->responder_message,
                'alternative_message' => $this->schedule->alternative_message,
            ],
            'action' => $this->action,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'timestamp' => $this->timestamp,
        ];
    }
}