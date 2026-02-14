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

class WeeklyDigestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $unsubscribeUrl;
    public string $preferencesUrl;

    /**
     * @param User  $user
     * @param array $stats  Keys: games_played, wins, losses, rating_change, best_performance
     */
    public function __construct(
        public User $user,
        public array $stats,
    ) {
        $this->queue = 'emails';

        $prefService = app(EmailPreferenceService::class);
        $this->unsubscribeUrl = $prefService->unsubscribeUrl($user);
        $this->preferencesUrl = $prefService->preferencesUrl($user);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your Chess99 Weekly Digest",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.weekly-digest',
        );
    }
}
