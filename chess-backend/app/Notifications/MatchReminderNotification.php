<?php

namespace App\Notifications;

use App\Models\ChampionshipMatch;
use App\Models\Championship;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Messages\MailMessage;

class MatchReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public ChampionshipMatch $match,
        public User $opponent,
        public Championship $championship,
        public string $urgency = 'medium'
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $deadline = $this->match->deadline->format('M j, Y g:i A');
        $hoursUntilDeadline = now()->diffInHours($this->match->deadline, false);

        $urgencyText = match($this->urgency) {
            'critical' => '⚠️ URGENT - Less than 1 hour remaining!',
            'high' => '⏰ High Priority - Less than 4 hours remaining',
            'medium' => '📅 Friendly Reminder',
            'low' => '📋 Match Schedule Reminder',
            default => '📋 Match Reminder',
        };

        return (new MailMessage)
            ->subject("{$urgencyText}: Championship Match Reminder")
            ->greeting("Hello {$notifiable->name}!")
            ->line("This is a reminder about your upcoming championship match.")
            ->line("")
            ->line("**Match Details:**")
            ->line("• Championship: {$this->championship->title}")
            ->line("• Opponent: {$this->opponent->name}")
            ->line("• Deadline: {$deadline}")
            ->line("• Time Remaining: {$this->formatTimeRemaining($hoursUntilDeadline)}")
            ->line("")
            ->action('View Match', route('championships.matches.show', $this->match->id))
            ->line("")
            ->line($this->getUrgencyMessage($hoursUntilDeadline))
            ->line("Please make sure to complete your match before the deadline to avoid forfeiture.")
            ->line("Good luck with your game!");
    }

    /**
     * Get the array representation of the notification.
     *
     * @param  object  $notifiable
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'match_id' => $this->match->id,
            'championship_id' => $this->championship->id,
            'championship_title' => $this->championship->title,
            'opponent_id' => $this->opponent->id,
            'opponent_name' => $this->opponent->name,
            'deadline' => $this->match->deadline,
            'urgency' => $this->urgency,
            'hours_until_deadline' => now()->diffInHours($this->match->deadline, false),
            'type' => 'match_reminder',
        ];
    }

    /**
     * Get the database representation of the notification.
     */
    public function toDatabase(object $notifiable): DatabaseMessage
    {
        $hoursUntilDeadline = now()->diffInHours($this->match->deadline, false);

        return new DatabaseMessage([
            'title' => 'Championship Match Reminder',
            'message' => "Your match against {$this->opponent->name} in {$this->championship->title} is due in {$this->formatTimeRemaining($hoursUntilDeadline)}.",
            'match_id' => $this->match->id,
            'championship_id' => $this->championship->id,
            'opponent_name' => $this->opponent->name,
            'deadline' => $this->match->deadline->toDateTimeString(),
            'urgency' => $this->urgency,
            'type' => 'match_reminder',
        ]);
    }

    /**
     * Format time remaining in human readable format
     */
    private function formatTimeRemaining(int $hours): string
    {
        if ($hours <= 0) {
            return 'Past due';
        } elseif ($hours < 1) {
            $minutes = now()->diffInMinutes($this->match->deadline);
            return "{$minutes} minutes";
        } elseif ($hours == 1) {
            return '1 hour';
        } elseif ($hours < 24) {
            return "{$hours} hours";
        } else {
            $days = floor($hours / 24);
            $remainingHours = $hours % 24;

            if ($remainingHours == 0) {
                return "{$days} " . str_plural('day', $days);
            } else {
                return "{$days} " . str_plural('day', $days) . " {$remainingHours} " . str_plural('hour', $remainingHours);
            }
        }
    }

    /**
     * Get urgency-specific message
     */
    private function getUrgencyMessage(int $hoursUntilDeadline): string
    {
        if ($hoursUntilDeadline <= 1) {
            return "⚠️ **This match is almost due!** Complete it immediately to avoid automatic forfeiture.";
        } elseif ($hoursUntilDeadline <= 4) {
            return "⏰ **This match is urgent!** Please prioritize completing it soon.";
        } elseif ($hoursUntilDeadline <= 12) {
            return "📅 **This match is due soon.** Please plan to complete it today.";
        } else {
            return "📋 **This match is scheduled.** Please coordinate with your opponent to find a suitable time.";
        }
    }
}