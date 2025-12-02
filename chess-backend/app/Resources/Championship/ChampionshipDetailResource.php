<?php

namespace App\Resources\Championship;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Championship Detail Resource
 *
 * Comprehensive resource for championship detail views.
 * Includes all necessary information with optimized loading strategies.
 */
class ChampionshipDetailResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array
     */
    public function toArray($request): array
    {
        return [
            // Core identifiers
            'id' => $this->id,
            'name' => $this->title,
            'title' => $this->title, // Frontend compatibility

            // Championship details
            'description' => $this->description,
            'format' => $this->format,
            'status' => $this->status,
            'visibility' => $this->visibility,

            // Timing information
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'registration_start_date' => $this->registration_start_date ?? $this->created_at,
            'registration_deadline' => $this->registration_deadline,
            'start_date' => $this->starts_at,
            'starts_at' => $this->starts_at, // Frontend compatibility
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,

            // Championship structure
            'max_participants' => $this->max_participants,
            'min_participants' => $this->min_participants,
            'total_rounds' => $this->total_rounds,
            'swiss_rounds' => $this->swiss_rounds,
            'top_qualifiers' => $this->top_qualifiers,
            'current_round' => $this->current_round,

            // Registration information
            'participants_count' => $this->participants_count,
            'registered_count' => $this->participants_count, // Frontend compatibility
            'available_spots' => max(0, $this->max_participants - $this->participants_count),
            'is_registration_open' => $this->is_registration_open,
            'allow_public_registration' => $this->allow_public_registration,
            'registration_closed' => $this->registration_deadline && now()->greaterThan($this->registration_deadline),

            // Time control
            'time_control' => [
                'minutes' => $this->time_control_minutes,
                'increment' => $this->time_control_increment,
                'type' => $this->getTimeControlType(),
                'display' => $this->getTimeControlDisplay(),
                'estimated_game_duration' => $this->getEstimatedGameDuration(),
            ],

            // Entry fee
            'entry_fee' => [
                'amount' => $this->entry_fee,
                'currency' => $this->currency ?? 'USD',
                'display' => $this->getEntryFeeDisplay(),
                'required' => $this->entry_fee > 0,
            ],

            // Organization information
            'organization' => $this->whenLoaded('organization', function () {
                return [
                    'id' => $this->organization_id,
                    'name' => $this->organization->name,
                    'description' => $this->organization->description,
                    'website' => $this->organization->website,
                ];
            }),

            // Creator information
            'creator' => $this->whenLoaded('creator', function () {
                return [
                    'id' => $this->created_by,
                    'name' => $this->creator->name,
                    'email' => $this->creator->email,
                ];
            }),

            // Scheduling settings
            'scheduling' => [
                'match_time_window_hours' => $this->match_time_window_hours,
                'scheduling_instructions' => $this->scheduling_instructions,
                'play_instructions' => $this->play_instructions,
                'default_grace_period_minutes' => $this->default_grace_period_minutes,
                'allow_early_play' => $this->allow_early_play,
                'require_confirmation' => $this->require_confirmation,
                'auto_invitations' => $this->auto_invitations,
                'round_interval_minutes' => $this->round_interval_minutes,
                'invitation_timeout_minutes' => $this->invitation_timeout_minutes,
                'match_start_buffer_minutes' => $this->match_start_buffer_minutes,
            ],

            // Championship rules and settings
            'rules' => [
                'color_assignment_method' => $this->color_assignment_method,
                'pairing_method' => $this->pairing_method,
                'bye_points' => $this->bye_points ?? 1.0,
                'allow_byes' => $this->allow_byes ?? true,
                'max_concurrent_matches' => $this->max_concurrent_matches,
                'auto_progression' => $this->auto_progression,
                'pairing_optimization' => $this->pairing_optimization,
                'tiebreak_rules' => $this->tiebreak_rules ?? ['points', 'buchholz', 'sonneborn_berger'],
                'requires_rating_verification' => $this->requires_rating_verification ?? false,
                'requires_code_of_conduct' => true,
            ],

            // Tournament configuration
            'tournament_config' => $this->tournament_config ?? [],
            'tournament_settings' => $this->tournament_settings ?? [],
            'tournament_generated' => $this->tournament_generated ?? false,
            'tournament_generated_at' => $this->tournament_generated_at,

            // Progress information
            'progress' => $this->when($this->status === 'in_progress', function () {
                return [
                    'current_round' => $this->current_round,
                    'total_rounds' => $this->total_rounds,
                    'completed_rounds' => max(0, $this->current_round - 1),
                    'progress_percentage' => $this->getProgressPercentage(),
                    'estimated_completion' => $this->getEstimatedCompletionDate(),
                    'is_final_round' => $this->current_round === $this->total_rounds,
                ];
            }),

            // Statistics
            'statistics' => $this->whenLoaded('matches', function () {
                return [
                    'total_matches' => $this->matches->count(),
                    'completed_matches' => $this->matches->where('status', 'completed')->count(),
                    'pending_matches' => $this->matches->where('status', 'pending')->count(),
                    'in_progress_matches' => $this->matches->where('status', 'in_progress')->count(),
                    'total_games' => $this->matches->sum(function ($match) {
                        return $match->game_id ? 1 : 0;
                    }),
                    'average_game_duration' => $this->getAverageGameDuration(),
                ];
            }),

            // Participants (with pagination support)
            'participants' => $this->when($request->has('include_participants'), function () use ($request) {
                $participants = $this->participants;

                if ($request->has('participants_page')) {
                    $page = $request->input('participants_page', 1);
                    $perPage = $request->input('participants_per_page', 20);

                    $participants = $participants->slice(($page - 1) * $perPage, $perPage);

                    return [
                        'data' => $participants->map(function ($participant) {
                            return [
                                'id' => $participant->id,
                                'user' => [
                                    'id' => $participant->user->id,
                                    'name' => $participant->user->name,
                                    'rating' => $participant->user->rating,
                                ],
                                'status' => $participant->status,
                                'rating_at_registration' => $participant->rating_at_registration,
                                'registered_at' => $participant->registered_at,
                                'points' => $participant->points ?? 0,
                                'rank' => $participant->rank ?? null,
                            ];
                        }),
                        'pagination' => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => $this->participants->count(),
                            'last_page' => ceil($this->participants->count() / $perPage),
                        ],
                    ];
                }

                return $participants->map(function ($participant) {
                    return [
                        'id' => $participant->id,
                        'user' => [
                            'id' => $participant->user->id,
                            'name' => $participant->user->name,
                            'rating' => $participant->user->rating,
                        ],
                        'status' => $participant->status,
                        'rating_at_registration' => $participant->rating_at_registration,
                        'registered_at' => $participant->registered_at,
                        'points' => $participant->points ?? 0,
                        'rank' => $participant->rank ?? null,
                    ];
                });
            }),

            // Recent matches (with pagination support)
            'matches' => $this->when($request->has('include_matches'), function () use ($request) {
                $matches = $this->matches->sortByDesc('created_at');

                if ($request->has('matches_page')) {
                    $page = $request->input('matches_page', 1);
                    $perPage = $request->input('matches_per_page', 10);

                    $matches = $matches->slice(($page - 1) * $perPage, $perPage);

                    return [
                        'data' => $matches->map(function ($match) {
                            return [
                                'id' => $match->id,
                                'round_number' => $match->round_number,
                                'round_type' => $match->round_type,
                                'white_player' => $match->whitePlayer ? [
                                    'id' => $match->whitePlayer->id,
                                    'name' => $match->whitePlayer->name,
                                ] : null,
                                'black_player' => $match->blackPlayer ? [
                                    'id' => $match->blackPlayer->id,
                                    'name' => $match->blackPlayer->name,
                                ] : null,
                                'status' => $match->status,
                                'result_type' => $match->result_type,
                                'scheduled_at' => $match->scheduled_at,
                                'deadline' => $match->deadline,
                            ];
                        }),
                        'pagination' => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => $this->matches->count(),
                            'last_page' => ceil($this->matches->count() / $perPage),
                        ],
                    ];
                }

                return $matches->take(20)->map(function ($match) {
                    return [
                        'id' => $match->id,
                        'round_number' => $match->round_number,
                        'round_type' => $match->round_type,
                        'white_player' => $match->whitePlayer ? [
                            'id' => $match->whitePlayer->id,
                            'name' => $match->whitePlayer->name,
                        ] : null,
                        'black_player' => $match->blackPlayer ? [
                            'id' => $match->blackPlayer->id,
                            'name' => $match->blackPlayer->name,
                        ] : null,
                        'status' => $match->status,
                        'result_type' => $match->result_type,
                        'scheduled_at' => $match->scheduled_at,
                        'deadline' => $match->deadline,
                    ];
                });
            }),

            // Standings
            'standings' => $this->when($request->has('include_standings'), function () {
                return $this->whenLoaded('standings', function () {
                    return $this->standings->sortBy('rank')->values()->map(function ($standing) {
                        return [
                            'rank' => $standing->rank,
                            'user' => [
                                'id' => $standing->user->id,
                                'name' => $standing->user->name,
                                'rating' => $standing->user->rating,
                            ],
                            'points' => $standing->points,
                            'tiebreak_score' => $standing->tiebreak_score,
                            'wins' => $standing->wins,
                            'losses' => $standing->losses,
                            'draws' => $standing->draws,
                        ];
                    });
                });
            }),

            // User-specific information
            'user_info' => $this->when($request->user(), function () use ($request) {
                $user = $request->user();
                $participant = $this->participants->firstWhere('user_id', $user->id);

                return [
                    'is_registered' => (bool) $participant,
                    'registration_status' => $participant?->status,
                    'payment_status' => $participant?->payment_status,
                    'registered_at' => $participant?->registered_at,
                    'can_register' => $this->canUserRegister($user),
                    'can_manage' => $this->canUserManage($user),
                    'current_points' => $participant?->points ?? 0,
                    'current_rank' => $participant?->rank ?? null,
                ];
            }),

            // Metadata
            'metadata' => [
                'auto_generated' => $this->tournament_generated ?? false,
                'has_pairings' => $this->whenLoaded('matches', fn() => $this->matches->isNotEmpty()),
                'has_participants' => $this->whenLoaded('participants', fn() => $this->participants->isNotEmpty()),
                'has_standings' => $this->whenLoaded('standings', fn() => $this->standings->isNotEmpty()),
                'can_be_started' => $this->canBeStarted(),
                'can_be_paused' => $this->canBePaused(),
                'can_be_completed' => $this->canBeCompleted(),
                'can_be_cancelled' => $this->canBeCancelled(),
            ],

            // Permissions
            'permissions' => $this->when($request->user(), function () use ($request) {
                $user = $request->user();

                return [
                    'can_view' => $this->canUserView($user),
                    'can_register' => $this->canUserRegister($user),
                    'can_manage' => $this->canUserManage($user),
                    'can_start' => $this->canUserStart($user),
                    'can_pause' => $this->canUserPause($user),
                    'can_complete' => $this->canUserComplete($user),
                    'can_archive' => $this->canUserArchive($user),
                    'can_edit' => $this->canUserEdit($user),
                    'can_delete' => $this->canUserDelete($user),
                ];
            }),
        ];
    }

    /**
     * Get time control type display
     */
    private function getTimeControlType(): string
    {
        $minutes = $this->time_control_minutes ?? 10;

        if ($minutes <= 3) return 'bullet';
        if ($minutes <= 10) return 'blitz';
        if ($minutes <= 30) return 'rapid';
        return 'classical';
    }

    /**
     * Get time control display string
     */
    private function getTimeControlDisplay(): string
    {
        $minutes = $this->time_control_minutes ?? 10;
        $increment = $this->time_control_increment ?? 0;
        $type = $this->getTimeControlType();

        return $increment > 0 ?
            sprintf('%d+%d %s', $minutes, $increment, $type) :
            sprintf('%d %s', $minutes, $type);
    }

    /**
     * Get entry fee display
     */
    private function getEntryFeeDisplay(): string
    {
        if ($this->entry_fee <= 0) return 'Free';

        $amount = number_format($this->entry_fee, 2);
        $currency = $this->currency ?? 'USD';

        return sprintf('%s %s', $currency, $amount);
    }

    /**
     * Get estimated game duration
     */
    private function getEstimatedGameDuration(): int
    {
        $baseTime = $this->time_control_minutes ?? 10;
        $increment = $this->time_control_increment ?? 0;

        // Add 50% buffer to base time
        return (int) ($baseTime * 1.5) + ($increment * 40); // 40 moves estimated
    }

    /**
     * Get progress percentage
     */
    private function getProgressPercentage(): float
    {
        if (!$this->current_round || !$this->total_rounds) return 0.0;

        return min(($this->current_round / $this->total_rounds) * 100, 100.0);
    }

    /**
     * Get estimated completion date
     */
    private function getEstimatedCompletionDate(): string
    {
        if (!$this->current_round || !$this->total_rounds) return null;

        $remainingRounds = $this->total_rounds - $this->current_round;
        $daysPerRound = $this->round_interval_minutes / 60 / 24; // Convert to days

        return now()->addDays($remainingRounds * $daysPerRound)->toDateString();
    }

    /**
     * Get average game duration
     */
    private function getAverageGameDuration(): ?float
    {
        if (!$this->relationLoaded('matches')) return null;

        $completedMatches = $this->matches->where('status', 'completed');
        if ($completedMatches->isEmpty()) return null;

        $totalDuration = $completedMatches->sum(function ($match) {
            return $match->getDurationMinutes() ?? 0;
        });

        return $totalDuration / $completedMatches->count();
    }

    /**
     * Check if user can register
     */
    private function canUserRegister($user): bool
    {
        if (!$user) return false;

        return $this->is_registration_open &&
               $this->participants_count < $this->max_participants &&
               (!$this->registration_deadline || now()->lessThan($this->registration_deadline));
    }

    /**
     * Check if user can manage championship
     */
    private function canUserManage($user): bool
    {
        if (!$user) return false;

        return $user->hasAnyRole(['platform_admin', 'organization_admin']) ||
               $user->id === $this->created_by ||
               ($this->organization_id && $user->organization_id === $this->organization_id);
    }

    /**
     * Check if relationship is loaded to prevent N+1 queries
     */
    private function whenLoaded(string $relationship, callable $callback)
    {
        return $this->relationLoaded($relationship) ? $callback() : null;
    }
}