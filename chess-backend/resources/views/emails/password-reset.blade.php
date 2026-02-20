@extends('emails.layouts.base')

@section('title', 'Reset your Chess99 password')

@section('content')
    <h2>Reset your password</h2>

    <p>Hi {{ $user->name }},</p>

    <p>We received a request to reset the password for your Chess99 account. Click the button below to choose a new password.</p>

    <div style="text-align: center; margin: 28px 0;">
        <a href="{{ $resetUrl }}" class="btn">Reset Password</a>
    </div>

    <p style="font-size: 13px; color: #888;">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>

    <hr class="divider">

    <p style="font-size: 12px; color: #aaa;">If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p style="font-size: 12px; color: #888; word-break: break-all;">{{ $resetUrl }}</p>
@endsection
