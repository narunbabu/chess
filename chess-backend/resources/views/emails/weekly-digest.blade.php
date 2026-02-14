@extends('emails.layouts.base')

@section('title', 'Your Chess99 Weekly Digest')

@section('content')
    <h2>Your Week in Chess</h2>
    <p>Hi {{ $user->name }}, here's how you did this week on Chess99.</p>

    <div style="text-align: center; margin: 24px 0;">
        <div class="stat-card">
            <span class="stat-value">{{ $stats['games_played'] ?? 0 }}</span>
            <span class="stat-label">Games</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">{{ $stats['wins'] ?? 0 }}</span>
            <span class="stat-label">Wins</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">{{ $stats['losses'] ?? 0 }}</span>
            <span class="stat-label">Losses</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">
                @php $change = $stats['rating_change'] ?? 0; @endphp
                {{ $change >= 0 ? '+' . $change : $change }}
            </span>
            <span class="stat-label">Rating</span>
        </div>
    </div>

    @if(($stats['rating_change'] ?? 0) > 0)
        <p>Great progress! You gained <strong>{{ $stats['rating_change'] }}</strong> rating points this week. Keep it up!</p>
    @elseif(($stats['rating_change'] ?? 0) < 0)
        <p>Tough week, but every game is a learning opportunity. Jump back in and turn things around!</p>
    @else
        <p>Solid week of chess. Ready for another round?</p>
    @endif

    @if($stats['best_performance'] ?? null)
        <hr class="divider">
        <p><strong>Best Performance:</strong> {{ $stats['best_performance'] }}</p>
    @endif

    <div style="text-align: center; margin: 24px 0;">
        <a href="{{ config('app.frontend_url', config('app.url')) }}" class="btn">Play More Games</a>
    </div>
@endsection
