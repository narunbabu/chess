@extends('emails.layouts.base')

@section('title', $subjectLine ?? 'A message from Chess99')

@section('content')
    <h2>Hi {{ $recipient->name }},</h2>

    {{-- Admin-authored plain text: escape first, then convert newlines to <br>. --}}
    <div style="color: #333; font-size: 15px; line-height: 1.6;">
        {!! nl2br(e($bodyText)) !!}
    </div>

    <hr class="divider">

    <p style="font-size: 13px; color: #888;">— The Chess99 Team</p>
@endsection
