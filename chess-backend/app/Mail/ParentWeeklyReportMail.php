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

class ParentWeeklyReportMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $unsubscribeUrl;
    public string $preferencesUrl;

    public function __construct(
        public User $guardian,
        public User $child,
        public array $report,
    ) {
        $this->queue = 'emails';

        $prefService = app(EmailPreferenceService::class);
        $this->unsubscribeUrl = $prefService->unsubscribeUrl($guardian);
        $this->preferencesUrl = $prefService->preferencesUrl($guardian);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->child->name}'s Chess99 Weekly Report",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.parent-weekly-report',
        );
    }
}
