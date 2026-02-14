@extends('emails.layouts.base')

@section('title', 'We miss you on Chess99!')

@section('content')
    <h2>Hey {{ $user->name }}, your board awaits!</h2>

    <p>It's been a while since your last game on Chess99. The pieces are lined up and ready for your next move.</p>

    @if($daysSinceLastGame ?? false)
        <p>It's been <strong>{{ $daysSinceLastGame }} days</strong> since your last game. Your rating is <strong>{{ $user->rating }}</strong> — let's keep it climbing!</p>
    @endif

    <div style="text-align: center; margin: 24px 0;">
        <a href="{{ config('app.frontend_url', config('app.url')) }}" class="btn">Play Now</a>
    </div>

    <hr class="divider">

    <p style="font-size: 13px; color: #888;">Here's what you can do today:</p>
    <ul style="color: #666; font-size: 14px;">
        <li>Challenge the computer at your skill level</li>
        <li>Play a quick game with a friend</li>
        <li>Check out the latest tournaments</li>
        <li>Continue your tutorial lessons</li>
    </ul>
@endsection
