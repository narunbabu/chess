<?php

namespace App\Resources\Championship;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Championship List Resource
 *
 * Optimized resource for championship list views.
 * Minimizes data payload and prevents N+1 queries by default.
 */
class ChampionshipListResource extends JsonResource
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
            'description' => $this->when($request->has('include_description'), $this->description),
            'format' => $this->format,
            'status' => $this->status,
            'visibility' => $this->visibility,

            // Timing information
            'created_at' => $this->created_at,
            'registration_deadline' => $this->registration_deadline,
            'start_date' => $this->starts_at,
            'starts_at' => $this->starts_at, // Frontend compatibility

            // Registration information
            'participants_count' => $this->participants_count,
            'registered_count' => $this->participants_count, // Frontend compatibility
            'max_participants' => $this->max_participants,
            'min_participants' => $this->min_participants,

            // Status flags for UI
            'is_registration_open' => $this->is_registration_open,
            'is_full' => $this->participants_count >= $this->max_participants,
            'registration_closed' => $this->when(
                $this->registration_deadline && now()->greaterThan($this->registration_deadline),
                $this->registration_deadline && now()->greaterThan($this->registration_deadline)
            ),

            // Time control (minimal for list view)
            'time_control' => $this->when($request->has('include_time_control'), [
                'minutes' => $this->time_control_minutes,
                'increment' => $this->time_control_increment,
                'type' => $this->getTimeControlType(),
                'display' => $this->getTimeControlDisplay(),
            ]),

            // Organization information (only when requested)
            'organization' => $this->when($request->has('include_organization'), function () {
                return [
                    'id' => $this->organization_id,
                    'name' => $this->organization?->name,
                ];
            }),

            // Creator information (only when requested)
            'creator' => $this->when($request->has('include_creator'), function () {
                return [
                    'id' => $this->created_by,
                    'name' => $this->creator?->name,
                ];
            }),

            // Entry fee (only when requested)
            'entry_fee' => $this->when($request->has('include_entry_fee') || $this->entry_fee > 0, [
                'amount' => $this->entry_fee,
                'currency' => $this->currency ?? 'USD',
                'display' => $this->getEntryFeeDisplay(),
            ]),

            // Progress information (only when requested)
            'progress' => $this->when($request->has('include_progress') && $this->status === 'in_progress', function () {
                return [
                    'current_round' => $this->current_round,
                    'total_rounds' => $this->total_rounds,
                    'completed_rounds' => $this->current_round ? $this->current_round - 1 : 0,
                    'progress_percentage' => $this->getProgressPercentage(),
                ];
            }),

            // Quick stats (only when requested)
            'stats' => $this->when($request->has('include_stats'), function () {
                return [
                    'total_matches' => $this->whenLoaded('matches', fn() => $this->matches->count()),
                    'completed_matches' => $this->whenLoaded('matches', fn() => $this->matches->where('status', 'completed')->count()),
                    'active_participants' => $this->participants_count,
                ];
            }),

            // Metadata
            'metadata' => $this->when($request->has('include_metadata'), [
                'auto_generated' => $this->tournament_generated ?? false,
                'has_pairings' => $this->whenLoaded('matches', fn() => $this->matches->isNotEmpty()),
                'requires_payment' => $this->entry_fee > 0,
                'requires_rating' => $this->requires_rating_verification ?? false,
                'color_assignment' => $this->color_assignment_method,
            ]),
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
     * Get progress percentage
     */
    private function getProgressPercentage(): float
    {
        if (!$this->current_round || !$this->total_rounds) return 0.0;

        return min(($this->current_round / $this->total_rounds) * 100, 100.0);
    }

    /**
     * Check if relationship is loaded to prevent N+1 queries
     */
    private function whenLoaded(string $relationship, callable $callback)
    {
        return $this->relationLoaded($relationship) ? $callback() : null;
    }

    /**
     * Custom with method to specify required relationships
     */
    public static function collection($resource)
    {
        return parent::collection($resource)->additional([
            'meta' => [
                'resource_type' => 'championship_list',
                'includes_available' => [
                    'description',
                    'time_control',
                    'organization',
                    'creator',
                    'entry_fee',
                    'progress',
                    'stats',
                    'metadata',
                ],
                'performance_notes' => [
                    'Use ?include= parameter to request additional data',
                    'Default includes optimized for list view performance',
                    'Participant details available via separate endpoint',
                ],
            ],
        ]);
    }
}