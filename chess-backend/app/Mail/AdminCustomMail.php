<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Custom one-off email composed by an admin in the dashboard and sent to a
 * single user. Admin-initiated/transactional — not gated by marketing email
 * preferences. The body is plain text authored by the admin; the Blade view
 * escapes it and converts newlines, so no HTML injection is possible.
 */
class AdminCustomMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recipient,
        public string $subjectLine,
        public string $bodyText,
    ) {
        $this->queue = 'emails';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectLine,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin-custom',
            with: [
                'recipient'   => $this->recipient,
                'bodyText'    => $this->bodyText,
                'subjectLine' => $this->subjectLine,
            ],
        );
    }
}
