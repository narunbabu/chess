@extends('emails.layouts.base')

@section('title', $child->name . "'s Chess99 Weekly Report")

@section('content')
    @php
        $week = $report['week'] ?? [];
        $totals = $report['totals'] ?? [];
        $ratingChange = $week['rating_change'] ?? 0;
        $learningMinutes = (int) floor(($week['time_played_seconds'] ?? 0) / 60);
    @endphp

    <h2>{{ $child->name }}'s Week in Chess</h2>
    <p>Hi {{ $guardian->name }}, here is {{ $child->name }}'s weekly Chess99 report card.</p>

    <div style="text-align: center; margin: 24px 0;">
        <div class="stat-card">
            <span class="stat-value">{{ $week['games_played'] ?? 0 }}</span>
            <span class="stat-label">Games</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">{{ $week['wins'] ?? 0 }}W</span>
            <span class="stat-label">Results</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">{{ $week['puzzles_solved'] ?? 0 }}</span>
            <span class="stat-label">Puzzles</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">{{ $week['lessons_completed'] ?? 0 }}</span>
            <span class="stat-label">Lessons</span>
        </div>
    </div>

    <p>
        Rating change:
        <strong>{{ $ratingChange >= 0 ? '+' . $ratingChange : $ratingChange }}</strong>.
        Learning time tracked from lessons and tactics:
        <strong>{{ $learningMinutes }} minutes</strong>.
    </p>

    <hr class="divider">

    <p>
        Lifetime learning totals:
        <strong>{{ $totals['lessons_completed'] ?? 0 }}</strong> lessons completed,
        <strong>{{ $totals['puzzles_solved'] ?? 0 }}</strong> puzzles solved,
        tactical rating <strong>{{ $totals['tactical_rating'] ?? 1000 }}</strong>.
    </p>

    <div style="text-align: center; margin: 24px 0;">
        <a href="{{ rtrim(config('app.frontend_url'), '/') }}/parent" class="btn">Open My Kids Dashboard</a>
    </div>
@endsection
