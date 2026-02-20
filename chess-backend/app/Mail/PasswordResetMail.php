<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PasswordResetMail extends Mailable
{
    public string $resetUrl;

    public function __construct(
        public User $user,
        string $token,
    ) {
        $this->resetUrl = config('app.frontend_url')
            . '/reset-password?token=' . $token
            . '&email=' . urlencode($user->email);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset your Chess99 password',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset',
        );
    }
}
