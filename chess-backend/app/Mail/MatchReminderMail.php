<?php

namespace App\Mail;

use App\Models\ChampionshipMatch;
use App\Models\User;
use App\Models\Championship;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MatchReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public ChampionshipMatch $match,
        public User $opponent,
        public Championship $championship,
        public string $urgency = 'medium'
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $urgencyPrefix = match($this->urgency) {
            'critical' => '⚠️ URGENT - ',
            'high' => '⏰ High Priority - ',
            'medium' => '',
            'low' => '',
            default => '',
        };

        return new Envelope(
            subject: "{$urgencyPrefix}Championship Match Reminder",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $deadline = $this->match->deadline->format('M j, Y g:i A');
        $hoursUntilDeadline = now()->diffInHours($this->match->deadline, false);

        return new Content(
            view: 'emails.championships.match-reminder',
            with: [
                'match' => $this->match,
                'opponent' => $this->opponent,
                'championship' => $this->championship,
                'urgency' => $this->urgency,
                'deadline' => $deadline,
                'hoursUntilDeadline' => $hoursUntilDeadline,
                'timeRemaining' => $this->formatTimeRemaining($hoursUntilDeadline),
                'urgencyMessage' => $this->getUrgencyMessage($hoursUntilDeadline),
                'urgencyColor' => $this->getUrgencyColor(),
            ]
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
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
            return "{$minutes} " . str_plural('minute', $minutes);
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
            return "This match is almost due! Complete it immediately to avoid automatic forfeiture.";
        } elseif ($hoursUntilDeadline <= 4) {
            return "This match is urgent! Please prioritize completing it soon.";
        } elseif ($hoursUntilDeadline <= 12) {
            return "This match is due soon. Please plan to complete it today.";
        } else {
            return "This match is scheduled. Please coordinate with your opponent to find a suitable time.";
        }
    }

    /**
     * Get urgency color for styling
     */
    private function getUrgencyColor(): string
    {
        return match($this->urgency) {
            'critical' => '#dc3545', // red
            'high' => '#fd7e14', // orange
            'medium' => '#ffc107', // yellow
            'low' => '#28a745', // green
            default => '#6c757d', // gray
        };
    }
}