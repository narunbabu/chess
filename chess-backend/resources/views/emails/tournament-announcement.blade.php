@extends('emails.layouts.base')

@section('title', 'New Tournament on Chess99')

@section('content')
    <h2>{{ $tournament->name }}</h2>

    <p>Hi {{ $user->name }}, a new tournament is open for registration!</p>

    <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Format:</strong> {{ ucfirst($tournament->format ?? 'Swiss') }}</p>
        <p style="margin: 4px 0;"><strong>Players:</strong> {{ $tournament->current_participants ?? 0 }} / {{ $tournament->max_participants ?? '∞' }}</p>
        @if($tournament->registration_deadline)
            <p style="margin: 4px 0;"><strong>Registration Deadline:</strong> {{ \Carbon\Carbon::parse($tournament->registration_deadline)->format('M j, Y \a\t g:i A') }}</p>
        @endif
        @if($tournament->start_date)
            <p style="margin: 4px 0;"><strong>Starts:</strong> {{ \Carbon\Carbon::parse($tournament->start_date)->format('M j, Y \a\t g:i A') }}</p>
        @endif
        @if($tournament->entry_fee && $tournament->entry_fee > 0)
            <p style="margin: 4px 0;"><strong>Entry Fee:</strong> {{ $tournament->entry_fee }}</p>
        @else
            <p style="margin: 4px 0;"><strong>Entry Fee:</strong> Free</p>
        @endif
    </div>

    @if($tournament->description)
        <p>{{ $tournament->description }}</p>
    @endif

    <div style="text-align: center; margin: 24px 0;">
        <a href="{{ config('app.frontend_url', config('app.url')) }}/championships/{{ $tournament->id }}" class="btn">Register Now</a>
    </div>
@endsection
