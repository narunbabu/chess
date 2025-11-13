<?php

namespace App\Jobs;

use App\Models\ChampionshipMatch;
use App\Models\Championship;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Carbon\Carbon;
use App\Notifications\MatchReminderNotification;
use App\Mail\MatchReminderMail;

class SendMatchReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 120;

    /**
     * The hours before deadline to send reminders.
     *
     * @var array
     */
    private $reminderIntervals = [24, 12, 4, 1]; // hours before deadline

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Starting match reminder job");

        $pendingMatches = $this->getPendingMatches();
        $remindersSent = 0;

        foreach ($pendingMatches as $match) {
            try {
                if ($this->shouldSendReminder($match)) {
                    $this->sendReminders($match);
                    $remindersSent++;

                    Log::info("Sent match reminders", [
                        'match_id' => $match->id,
                        'championship_id' => $match->championship_id,
                        'deadline' => $match->deadline,
                        'player1_id' => $match->player1_id,
                        'player2_id' => $match->player2_id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error("Failed to send match reminders", [
                    'match_id' => $match->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        Log::info("Completed match reminder job", [
            'total_pending' => $pendingMatches->count(),
            'reminders_sent' => $remindersSent,
        ]);
    }

    /**
     * Get pending matches that need reminders
     */
    private function getPendingMatches(): \Illuminate\Database\Eloquent\Collection
    {
        return ChampionshipMatch::where('status', ChampionshipMatchStatus::PENDING->value)
            ->where('deadline', '>', now())
            ->where('scheduled_at', '<=', now())
            ->with(['championship', 'player1', 'player2'])
            ->get();
    }

    /**
     * Check if reminder should be sent for this match
     */
    private function shouldSendReminder(ChampionshipMatch $match): bool
    {
        $deadline = $match->deadline;
        $now = now();

        foreach ($this->reminderIntervals as $hours) {
            $reminderTime = $deadline->copy()->subHours($hours);

            // Check if current time is within 15 minutes of reminder time
            if ($now->diffInMinutes($reminderTime) <= 15 && $now->lessThanOrEqualTo($reminderTime)) {
                // Check if we haven't already sent a reminder for this interval
                if (!$this->hasReminderBeenSent($match, $hours)) {
                    $this->markReminderAsSent($match, $hours);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if reminder has already been sent for specific interval
     */
    private function hasReminderBeenSent(ChampionshipMatch $match, int $hours): bool
    {
        $reminderKey = "match_reminder_{$match->id}_{$hours}h";

        // You could store this in cache or database
        // For now, using cache with expiration
        return cache()->has($reminderKey);
    }

    /**
     * Mark reminder as sent
     */
    private function markReminderAsSent(ChampionshipMatch $match, int $hours): void
    {
        $reminderKey = "match_reminder_{$match->id}_{$hours}h";

        // Cache for 48 hours to prevent duplicate reminders
        cache()->put($reminderKey, true, now()->addHours(48));
    }

    /**
     * Send reminders to both players
     */
    private function sendReminders(ChampionshipMatch $match): void
    {
        $championship = $match->championship;
        $deadline = $match->deadline;
        $hoursUntilDeadline = now()->diffInHours($deadline, false);
        $urgency = $this->getUrgencyLevel($hoursUntilDeadline);

        // Send to player 1
        $this->sendReminderToPlayer($match, $match->player1, $match->player2, $championship, $urgency);

        // Send to player 2
        $this->sendReminderToPlayer($match, $match->player2, $match->player1, $championship, $urgency);

        // Send notification if there's an associated game
        if ($match->game_id) {
            $this->sendGameReminder($match);
        }
    }

    /**
     * Send reminder to individual player
     */
    private function sendReminderToPlayer(
        ChampionshipMatch $match,
        User $player,
        User $opponent,
        Championship $championship,
        string $urgency
    ): void {
        try {
            // Send database notification
            $player->notify(new MatchReminderNotification($match, $opponent, $championship, $urgency));

            // Send email notification if user has email notifications enabled
            if ($this->shouldSendEmailNotification($player)) {
                Mail::to($player->email)->send(new MatchReminderMail($match, $opponent, $championship, $urgency));
            }

            Log::info("Sent reminder to player", [
                'player_id' => $player->id,
                'match_id' => $match->id,
                'urgency' => $urgency,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send reminder to player", [
                'player_id' => $player->id,
                'match_id' => $match->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send reminder for associated game
     */
    private function sendGameReminder(ChampionshipMatch $match): void
    {
        if (!$match->game) {
            return;
        }

        $game = $match->game;
        $currentPlayer = $this->getCurrentPlayer($game);

        if ($currentPlayer) {
            // Send game-specific notification
            $this->sendGameMoveReminder($match, $game, $currentPlayer);
        }
    }

    /**
     * Get current player whose turn it is
     */
    private function getCurrentPlayer($game): ?User
    {
        $lastMove = $game->moves()->latest()->first();

        if (!$lastMove) {
            // Game hasn't started - white player's turn
            return $game->whitePlayer;
        }

        // It's the other player's turn
        return $lastMove->user_id === $game->white_player_id
            ? $game->blackPlayer
            : $game->whitePlayer;
    }

    /**
     * Send game move reminder
     */
    private function sendGameMoveReminder(ChampionshipMatch $match, $game, User $currentPlayer): void
    {
        try {
            $opponent = $currentPlayer->id === $game->white_player_id
                ? $game->blackPlayer
                : $game->whitePlayer;

            // Create game-specific notification
            $message = "Your move in game against {$opponent->name} for {$match->championship->title}. " .
                      "Match deadline: {$match->deadline->format('M j, Y g:i A')}";

            // You could create a specific GameMoveReminderNotification here

            Log::info("Sent game move reminder", [
                'game_id' => $game->id,
                'player_id' => $currentPlayer->id,
                'match_id' => $match->id,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send game move reminder", [
                'game_id' => $game->id,
                'player_id' => $currentPlayer->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Get urgency level based on hours until deadline
     */
    private function getUrgencyLevel(int $hoursUntilDeadline): string
    {
        if ($hoursUntilDeadline <= 1) {
            return 'critical';
        } elseif ($hoursUntilDeadline <= 4) {
            return 'high';
        } elseif ($hoursUntilDeadline <= 12) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Check if user should receive email notifications
     */
    private function shouldSendEmailNotification(User $user): bool
    {
        // Check user preferences
        return $user->email_notifications_enabled ?? true;
    }

    /**
     * Send summary of upcoming matches to organizers
     */
    public function sendOrganizerSummary(): void
    {
        $upcomingMatches = $this->getUpcomingMatchesForOrganizers();

        if ($upcomingMatches->isEmpty()) {
            return;
        }

        $organizers = $this->getTournamentOrganizers();

        foreach ($organizers as $organizer) {
            try {
                // Send organizer summary notification
                $this->sendOrganizerMatchSummary($organizer, $upcomingMatches);

                Log::info("Sent organizer match summary", [
                    'organizer_id' => $organizer->id,
                    'matches_count' => $upcomingMatches->count(),
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to send organizer summary", [
                    'organizer_id' => $organizer->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Get upcoming matches for organizer summary
     */
    private function getUpcomingMatchesForOrganizers(): \Illuminate\Database\Eloquent\Collection
    {
        return ChampionshipMatch::where('status', ChampionshipMatchStatus::PENDING->value)
            ->where('deadline', '>', now())
            ->where('deadline', '<=', now()->addHours(24))
            ->with(['championship', 'player1', 'player2'])
            ->orderBy('deadline')
            ->limit(20)
            ->get();
    }

    /**
     * Get tournament organizers (users with organizer permissions)
     */
    private function getTournamentOrganizers(): \Illuminate\Database\Eloquent\Collection
    {
        // You could implement this based on your user roles/permissions system
        // For now, returning empty collection
        return collect();
    }

    /**
     * Send organizer match summary
     */
    private function sendOrganizerMatchSummary(User $organizer, \Illuminate\Database\Eloquent\Collection $matches): void
    {
        // Create organizer summary notification
        $summaryData = [
            'organizer' => $organizer,
            'matches' => $matches,
            'total_matches' => $matches->count(),
            'critical_matches' => $matches->filter(fn($m) => now()->diffInHours($m->deadline) <= 4)->count(),
        ];

        // You could create an OrganizerMatchSummaryNotification here
        // $organizer->notify(new OrganizerMatchSummaryNotification($summaryData));
    }

    /**
     * Get reminder statistics for reporting
     */
    public function getReminderStats(): array
    {
        $pendingMatches = ChampionshipMatch::where('status', ChampionshipMatchStatus::PENDING->value)
            ->where('deadline', '>', now())
            ->count();

        $urgentMatches = ChampionshipMatch::where('status', ChampionshipMatchStatus::PENDING->value)
            ->where('deadline', '>', now())
            ->where('deadline', '<=', now()->addHours(4))
            ->count();

        $criticalMatches = ChampionshipMatch::where('status', ChampionshipMatchStatus::PENDING->value)
            ->where('deadline', '>', now())
            ->where('deadline', '<=', now()->addHour())
            ->count();

        return [
            'pending_matches' => $pendingMatches,
            'urgent_matches' => $urgentMatches,
            'critical_matches' => $criticalMatches,
            'reminder_intervals' => $this->reminderIntervals,
        ];
    }

    /**
     * Get the tags that should be assigned to the job.
     */
    public function tags(): array
    {
        return ['championships', 'match-reminders'];
    }
}