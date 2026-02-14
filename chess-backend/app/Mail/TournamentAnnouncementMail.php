<?php

namespace App\Mail;

use App\Models\User;
use App\Models\Championship;
use App\Services\EmailPreferenceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TournamentAnnouncementMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $unsubscribeUrl;
    public string $preferencesUrl;

    public function __construct(
        public User $user,
        public Championship $tournament,
    ) {
        $this->queue = 'emails';

        $prefService = app(EmailPreferenceService::class);
        $this->unsubscribeUrl = $prefService->unsubscribeUrl($user);
        $this->preferencesUrl = $prefService->preferencesUrl($user);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Tournament: {$this->tournament->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.tournament-announcement',
        );
    }
}
