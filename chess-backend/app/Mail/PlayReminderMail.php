<?php

namespace App\Mail;

use App\Models\User;
use App\Services\EmailPreferenceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PlayReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $daysSinceLastGame;
    public string $unsubscribeUrl;
    public string $preferencesUrl;

    public function __construct(
        public User $user,
    ) {
        $this->queue = 'emails';

        $lastActivity = $user->last_activity_at ?? $user->last_login_at;
        $this->daysSinceLastGame = $lastActivity ? (int) $lastActivity->diffInDays(now()) : 0;

        $prefService = app(EmailPreferenceService::class);
        $this->unsubscribeUrl = $prefService->unsubscribeUrl($user);
        $this->preferencesUrl = $prefService->preferencesUrl($user);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your board is waiting, {$this->user->name}!",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.play-reminder',
        );
    }
}
