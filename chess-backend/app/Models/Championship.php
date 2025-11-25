<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipFormat as ChampionshipFormatEnum;

class Championship extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'name',                   // Alias for title (mutator converts to title)
        'description',
        'entry_fee',
        'max_participants',
        'registration_deadline',
        'registration_end_at',    // Alias for registration_deadline
        'start_date',
        'starts_at',              // Alias for start_date
        'match_time_window_hours',
        'time_control_minutes',   // Time control in minutes
        'time_control_increment', // Time control increment in seconds
        'total_rounds',           // Total number of rounds
        'format',                 // Virtual attribute (mutator converts to format_id)
        'format_id',              // FK to championship_formats table
        'swiss_rounds',
        'top_qualifiers',
        'status',                 // Virtual attribute (mutator converts to status_id)
        'status_id',              // FK to championship_statuses table
        'created_by',             // FK to users table
        'organization_id',        // FK to organizations table
        'visibility',
        'allow_public_registration',
        // Scheduling instructions
        'scheduling_instructions',
        'play_instructions',
        'default_grace_period_minutes',
        'allow_early_play',
        'require_confirmation',
        // Tournament configuration
        'color_assignment_method',
        'max_concurrent_matches',
        'auto_progression',
        'pairing_optimization',
        'auto_invitations',
        'round_interval_minutes',
        'invitation_timeout_minutes',
        'match_start_buffer_minutes',
        'tournament_settings',
        // Full tournament generation
        'tournament_config',
        'tournament_generated',
        'tournament_generated_at',
    ];

    protected $casts = [
        'entry_fee' => 'decimal:2',
        'max_participants' => 'integer',
        'registration_deadline' => 'datetime',
        'start_date' => 'datetime',
        'match_time_window_hours' => 'integer',
        'time_control_minutes' => 'integer',
        'time_control_increment' => 'integer',
        'total_rounds' => 'integer',
        'swiss_rounds' => 'integer',
        'top_qualifiers' => 'integer',
        'status_id' => 'integer',
        'format_id' => 'integer',
        'allow_public_registration' => 'boolean',
        'deleted_at' => 'datetime',
        // Scheduling field casts
        'default_grace_period_minutes' => 'integer',
        'allow_early_play' => 'boolean',
        'require_confirmation' => 'boolean',
        // Tournament configuration casts
        'max_concurrent_matches' => 'integer',
        'auto_progression' => 'boolean',
        'pairing_optimization' => 'boolean',
        'auto_invitations' => 'boolean',
        'round_interval_minutes' => 'integer',
        'invitation_timeout_minutes' => 'integer',
        'match_start_buffer_minutes' => 'integer',
        'tournament_settings' => 'array',
        // Full tournament generation casts
        'tournament_config' => 'array',
        'tournament_generated' => 'boolean',
        'tournament_generated_at' => 'datetime',
    ];

    /**
     * The attributes that should be mutated to dates.
     */
    protected $dates = ['deleted_at'];

    /**
     * Append accessor attributes to JSON serialization
     */
    protected $appends = [
        'status',
        'format',
        'registered_count',
        'participants_count',     // Alias for registered_count (frontend compatibility)
        'is_registration_open',
        'name',  // Alias for title (for frontend compatibility)
        'registration_start_at',  // Alias for created_at
        'registration_end_at',    // Alias for registration_deadline
        'starts_at',              // Alias for start_date
        'time_control',           // Time control object for frontend compatibility
    ];

    // Relationships

    /**
     * Participants in this championship
     */
    public function participants()
    {
        return $this->hasMany(ChampionshipParticipant::class);
    }

    /**
     * Matches in this championship
     */
    public function matches()
    {
        return $this->hasMany(ChampionshipMatch::class);
    }

    /**
     * Standings for this championship
     */
    public function standings()
    {
        return $this->hasMany(ChampionshipStanding::class);
    }

    /**
     * Relationship to ChampionshipStatus lookup table
     */
    public function statusRelation()
    {
        return $this->belongsTo(ChampionshipStatus::class, 'status_id');
    }

    /**
     * Relationship to ChampionshipFormat lookup table
     */
    public function formatRelation()
    {
        return $this->belongsTo(ChampionshipFormat::class, 'format_id');
    }

    /**
     * User who created this championship
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Organization hosting this championship
     */
    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * User who archived this championship
     */
    public function deletedBy()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    // Mutators & Accessors

    /**
     * Mutator: Convert status string/enum to status_id FK
     */
    public function setStatusAttribute($value)
    {
        if ($value instanceof ChampionshipStatusEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['status_id'] = ChampionshipStatus::getIdByCode($code);
    }

    /**
     * Accessor: Read status code from relationship
     */
    public function getStatusAttribute(): string
    {
        if (isset($this->attributes['status_id'])) {
            return $this->statusRelation?->code ??
                   ChampionshipStatus::find($this->attributes['status_id'])?->code ??
                   'upcoming';
        }

        return 'upcoming';
    }

    /**
     * Mutator: Convert format string/enum to format_id FK
     */
    public function setFormatAttribute($value)
    {
        if ($value instanceof ChampionshipFormatEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['format_id'] = ChampionshipFormat::getIdByCode($code);
    }

    /**
     * Accessor: Read format code from relationship
     */
    public function getFormatAttribute(): string
    {
        if (isset($this->attributes['format_id'])) {
            return $this->formatRelation?->code ??
                   ChampionshipFormat::find($this->attributes['format_id'])?->code ??
                   'swiss_only';
        }

        return 'swiss_only';
    }

    /**
     * Accessor: Alias 'name' for 'title' (for frontend compatibility)
     */
    public function getNameAttribute(): string
    {
        return $this->attributes['title'] ?? '';
    }

    /**
     * Mutator: Allow setting 'name' which maps to 'title'
     */
    public function setNameAttribute($value)
    {
        $this->attributes['title'] = $value;
    }

    /**
     * Accessor: Alias 'registration_start_at' for 'created_at' (for frontend compatibility)
     */
    public function getRegistrationStartAtAttribute(): ?string
    {
        return $this->created_at?->toISOString();
    }

    /**
     * Accessor: Alias 'registration_end_at' for 'registration_deadline'
     */
    public function getRegistrationEndAtAttribute(): ?string
    {
        return $this->attributes['registration_deadline'] ?? null;
    }

    /**
     * Mutator: Allow setting 'registration_end_at' which maps to 'registration_deadline'
     */
    public function setRegistrationEndAtAttribute($value)
    {
        $this->attributes['registration_deadline'] = $value;
    }

    /**
     * Accessor: Alias 'starts_at' for 'start_date'
     */
    public function getStartsAtAttribute(): ?string
    {
        return $this->attributes['start_date'] ?? null;
    }

    /**
     * Mutator: Allow setting 'starts_at' which maps to 'start_date'
     */
    public function setStartsAtAttribute($value)
    {
        $this->attributes['start_date'] = $value;
    }

    /**
     * Accessor: Get registered participants count
     */
    public function getRegisteredCountAttribute(): int
    {
        return $this->participants()->count();
    }

    /**
     * Accessor: Alias for registered_count (frontend compatibility)
     */
    public function getParticipantsCountAttribute(): int
    {
        return $this->getRegisteredCountAttribute();
    }

    /**
     * Accessor: Check if registration is open
     */
    public function getIsRegistrationOpenAttribute(): bool
    {
        return $this->getStatusEnum()->canRegister() &&
               now()->lessThan($this->registration_deadline);
    }

    /**
     * Accessor: Get time control as object for frontend compatibility
     */
    public function getTimeControlAttribute(): object
    {
        return (object) [
            'minutes' => $this->time_control_minutes ?? 10,
            'increment' => $this->time_control_increment ?? 0,
        ];
    }

    /**
     * Mutator: Calculate total rounds based on format if not set
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($championship) {
            // Auto-calculate total_rounds if not set
            if (!$championship->total_rounds) {
                $format = $championship->getFormatEnum();
                if ($format->isSwiss()) {
                    $championship->total_rounds = $championship->swiss_rounds ?? 5;
                } elseif ($format->isElimination()) {
                    // Calculate elimination rounds based on participants
                    $participants = $championship->max_participants ?? 16;
                    $championship->total_rounds = ceil(log($participants, 2));
                } else {
                    // Hybrid format
                    $championship->total_rounds = ($championship->swiss_rounds ?? 5) +
                                                 ceil(log($championship->top_qualifiers ?? 8, 2));
                }
            }
        });

        static::retrieved(function ($championship) {
            // Set defaults for existing records that don't have these fields
            if (!isset($championship->time_control_minutes)) {
                $championship->time_control_minutes = 10;
            }
            if (!isset($championship->time_control_increment)) {
                $championship->time_control_increment = 0;
            }
            if (!$championship->total_rounds) {
                $format = $championship->getFormatEnum();
                if ($format->isSwiss()) {
                    $championship->total_rounds = $championship->swiss_rounds ?? 5;
                } elseif ($format->isElimination()) {
                    $participants = $championship->max_participants ?? 16;
                    $championship->total_rounds = ceil(log($participants, 2));
                } else {
                    $championship->total_rounds = ($championship->swiss_rounds ?? 5) +
                                                 ceil(log($championship->top_qualifiers ?? 8, 2));
                }
            }
        });
    }

    // Scopes

    /**
     * Scope: Active championships
     */
    public function scopeActive($query)
    {
        return $query->where('status_id', ChampionshipStatusEnum::IN_PROGRESS->getId());
    }

    /**
     * Scope: Upcoming championships
     */
    public function scopeUpcoming($query)
    {
        return $query->where('status_id', ChampionshipStatusEnum::UPCOMING->getId());
    }

    /**
     * Scope: Registration open
     */
    public function scopeRegistrationOpen($query)
    {
        return $query->where('status_id', ChampionshipStatusEnum::REGISTRATION_OPEN->getId())
                    ->where('registration_deadline', '>', now());
    }

    /**
     * Scope: Completed championships
     */
    public function scopeCompleted($query)
    {
        return $query->where('status_id', ChampionshipStatusEnum::COMPLETED->getId());
    }

    // Helper Methods

    /**
     * Get status as enum
     */
    public function getStatusEnum(): ChampionshipStatusEnum
    {
        return ChampionshipStatusEnum::from($this->status);
    }

    /**
     * Get format as enum
     */
    public function getFormatEnum(): ChampionshipFormatEnum
    {
        return ChampionshipFormatEnum::from($this->format);
    }

    /**
     * Check if championship is full
     */
    public function isFull(): bool
    {
        if ($this->max_participants === null) {
            return false;
        }

        return $this->registered_count >= $this->max_participants;
    }

    /**
     * Check if user is registered
     */
    public function isUserRegistered(int $userId): bool
    {
        return $this->participants()
            ->where('user_id', $userId)
            ->exists();
    }

    /**
     * Check if user has paid
     */
    public function hasUserPaid(int $userId): bool
    {
        return $this->participants()
            ->where('user_id', $userId)
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->exists();
    }

    /**
     * Can user register?
     */
    public function canRegister(int $userId): bool
    {
        return $this->is_registration_open &&
               !$this->isFull() &&
               !$this->isUserRegistered($userId);
    }

    /**
     * Auto-update status based on current date and registration periods
     */
    public function autoUpdateStatus(): void
    {
        $now = now();

        // Update from upcoming to registration_open if registration period has started
        if ($this->status === 'upcoming' &&
            $this->registration_start_at &&
            $this->registration_end_at &&
            $now->gte($this->registration_start_at) &&
            $now->lte($this->registration_end_at)) {
            $this->update(['status' => 'registration_open']);
            Log::info('Championship status auto-updated to registration_open', [
                'championship_id' => $this->id,
                'now' => $now,
                'registration_start_at' => $this->registration_start_at,
                'registration_end_at' => $this->registration_end_at,
            ]);
        }

        // Update from registration_open to upcoming if registration period hasn't started yet
        elseif ($this->status === 'registration_open' &&
            $this->registration_start_at &&
            $this->registration_end_at &&
            ($now->lt($this->registration_start_at) || $now->gt($this->registration_end_at))) {
            $this->update(['status' => 'upcoming']);
            Log::info('Championship status auto-updated to upcoming', [
                'championship_id' => $this->id,
                'now' => $now,
                'registration_start_at' => $this->registration_start_at,
                'registration_end_at' => $this->registration_end_at,
            ]);
        }
    }

    /**
     * Check if championship is public
     */
    public function isPublic(): bool
    {
        return $this->visibility === 'public';
    }

    /**
     * Check if championship is visible to user
     */
    public function isVisibleTo(?User $user = null): bool
    {
        // Public championships are visible to everyone
        if ($this->visibility === 'public') {
            return true;
        }

        // Guest users can only see public championships
        if (!$user) {
            return false;
        }

        // Platform admins can see everything
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Private championships are only visible to creator and org admins
        if ($this->visibility === 'private') {
            return $this->created_by === $user->id ||
                   ($user->hasRole('organization_admin') &&
                    $this->organization_id === $user->organization_id);
        }

        // Organization-only championships are visible to org members
        if ($this->visibility === 'organization_only') {
            return $this->organization_id === $user->organization_id;
        }

        return false;
    }

    /**
     * Business rule: Check if championship can be permanently deleted
     *
     * Only allow permanent deletion if:
     * - No participants registered
     * - No matches created
     * - Status is 'upcoming' or 'registration_open' (not started)
     * - No payments made
     *
     * @return bool
     */
    public function canBeDeleted(): bool
    {
        // Check participant count
        if ($this->participants()->count() > 0) {
            Log::info('Cannot delete championship: has participants', [
                'championship_id' => $this->id,
                'participant_count' => $this->participants()->count()
            ]);
            return false;
        }

        // Check match count
        if ($this->matches()->count() > 0) {
            Log::info('Cannot delete championship: has matches', [
                'championship_id' => $this->id,
                'match_count' => $this->matches()->count()
            ]);
            return false;
        }

        // Check status - only allow deletion for upcoming or registration_open
        $allowedStatuses = ['upcoming', 'registration_open'];
        if (!in_array($this->status, $allowedStatuses)) {
            Log::info('Cannot delete championship: invalid status', [
                'championship_id' => $this->id,
                'current_status' => $this->status,
                'allowed_statuses' => $allowedStatuses
            ]);
            return false;
        }

        // Check for paid participants (extra safety check)
        $paidParticipants = $this->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        if ($paidParticipants > 0) {
            Log::info('Cannot delete championship: has paid participants', [
                'championship_id' => $this->id,
                'paid_participants' => $paidParticipants
            ]);
            return false;
        }

        return true;
    }

    /**
     * Scope: Visible championships for user
     */
    public function scopeVisibleTo($query, ?User $user = null)
    {
        Log::info('visibleTo scope called', [
            'has_user' => !is_null($user),
            'user_id' => $user?->id,
        ]);

        if (!$user) {
            Log::info('No user - returning public championships');
            return $query->where('visibility', 'public');
        }

        if ($user->hasRole('platform_admin')) {
            Log::info('User is platform admin - returning all championships');
            return $query;
        }

        return $query->where(function ($q) use ($user) {
            $q->where('visibility', 'public')
              ->orWhere('created_by', $user->id)
              ->orWhere(function ($q2) use ($user) {
                  $q2->where('visibility', 'organization_only')
                     ->where('organization_id', $user->organization_id);
              })
              ->orWhere(function ($q3) use ($user) {
                  $q3->where('visibility', 'private')
                     ->where(function ($q4) use ($user) {
                         $q4->where('created_by', $user->id)
                            ->orWhere(function ($q5) use ($user) {
                                $q5->where('organization_id', $user->organization_id)
                                   ->whereHas('creator', function ($q6) use ($user) {
                                       $q6->whereHas('roles', function ($q7) {
                                           $q7->where('name', 'organization_admin');
                                       });
                                   });
                            });
                     });
                });
        });
    }

    /**
     * Get bye points value from tournament settings
     */
    public function getByePoints(): float
    {
        $settings = $this->tournament_settings ?? [];
        return $settings['bye_points'] ?? 1.0;
    }

    /**
     * Get color assignment method
     */
    public function getColorAssignmentMethod(): string
    {
        return $this->color_assignment_method ?? 'balanced';
    }

    /**
     * Get invitation timeout in minutes
     */
    public function getInvitationTimeoutMinutes(): int
    {
        return $this->invitation_timeout_minutes ?? 60;
    }

    /**
     * Get a specific setting from tournament settings JSON
     */
    public function getSetting(string $key, $default = null)
    {
        $settings = $this->tournament_settings ?? [];
        return $settings[$key] ?? $default;
    }

    /**
     * Get tournament configuration as TournamentConfig object
     */
    public function getTournamentConfig(): ?\App\ValueObjects\TournamentConfig
    {
        if (!$this->tournament_config) {
            return null;
        }

        return \App\ValueObjects\TournamentConfig::fromArray($this->tournament_config);
    }

    /**
     * Set tournament configuration from TournamentConfig object
     */
    public function setTournamentConfig(\App\ValueObjects\TournamentConfig $config): void
    {
        $this->tournament_config = $config->toArray();
    }

    /**
     * Check if tournament has been fully generated
     */
    public function isTournamentGenerated(): bool
    {
        return $this->tournament_generated ?? false;
    }

    /**
     * Mark tournament as generated
     */
    public function markTournamentAsGenerated(): void
    {
        $this->update([
            'tournament_generated' => true,
            'tournament_generated_at' => now(),
        ]);
    }

    /**
     * Get or create default tournament configuration
     */
    public function getOrCreateTournamentConfig(): \App\ValueObjects\TournamentConfig
    {
        if ($this->tournament_config) {
            return $this->getTournamentConfig();
        }

        // Determine preset based on participant count
        $participantCount = $this->participants()->count();
        $preset = $this->determinePreset($participantCount);

        // Create default config using actual participant count for proper pairing
        // This ensures 3-player tournaments use the Option A structure
        $config = \App\ValueObjects\TournamentConfig::fromPreset(
            $preset,
            $this->total_rounds ?? 5,
            $participantCount
        );

        return $config;
    }

    /**
     * Determine appropriate preset based on participant count
     */
    private function determinePreset(int $participantCount): string
    {
        if ($participantCount <= 10) {
            return \App\ValueObjects\TournamentConfig::PRESET_SMALL;
        } elseif ($participantCount <= 30) {
            return \App\ValueObjects\TournamentConfig::PRESET_MEDIUM;
        } else {
            return \App\ValueObjects\TournamentConfig::PRESET_LARGE;
        }
    }

    /**
     * Get recommended tournament structure using universal approach
     * Automatically selects optimal structure based on participant count
     */
    public function getRecommendedTournamentStructure(): array
    {
        $participantCount = $this->getEligibleParticipantCount();

        return \App\ValueObjects\TournamentConfig::generateUniversalTournamentStructure(
            $participantCount,
            $this->total_rounds ?? 5
        );
    }

    /**
     * Get tournament structure with automatic tiebreak integration
     */
    public function getTournamentStructureWithTiebreaks(): array
    {
        $structure = $this->getRecommendedTournamentStructure();
        $participantCount = $this->getEligibleParticipantCount();

        // Add tiebreak configuration to each round
        foreach ($structure as &$roundConfig) {
            $roundConfig['tiebreak_policy'] = [
                'order' => ['points', 'buchholz_score', 'sonneborn_berger', 'head_to_head', 'rating', 'random'],
                'expand_band_for_ties' => $roundConfig['type'] === \App\ValueObjects\TournamentConfig::ROUND_TYPE_SELECTIVE,
                'playoff_for_first_place' => $roundConfig['type'] === \App\ValueObjects\TournamentConfig::ROUND_TYPE_FINAL,
            ];

            // Add K4 calculation info for selective rounds
            if ($roundConfig['type'] === \App\ValueObjects\TournamentConfig::ROUND_TYPE_SELECTIVE) {
                $k4 = \App\ValueObjects\TournamentConfig::calculateK4($participantCount);
                $roundConfig['k4_calculation'] = [
                    'participant_count' => $participantCount,
                    'k4_value' => $k4,
                    'formula' => 'N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12'
                ];
            }
        }

        return $structure;
    }

    /**
     * Get eligible participants count for structure calculation
     */
    public function getEligibleParticipantCount(): int
    {
        return $this->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();
    }

    /**
     * Get top K participants for a selective round using tiebreak policy
     */
    public function getTopKParticipants(int $K, array $options = []): \Illuminate\Support\Collection
    {
        if ($this->standings()->isEmpty()) {
            // If no standings exist, use participants as fallback
            return $this->participants()
                ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
                ->with('user')
                ->take($K)
                ->get();
        }

        $tiebreakService = new \App\Services\TiebreakPolicyService();
        $standings = $this->standings()->with('user')->get();

        return $tiebreakService->selectTopK($standings, $K, $options);
    }

    /**
     * Check if tournament should use universal structure
     */
    public function shouldUseUniversalStructure(): bool
    {
        $participantCount = $this->getEligibleParticipantCount();

        // Use universal structure for 3-100 participants
        return $participantCount >= 3 && $participantCount <= 100;
    }

    /**
     * Generate tournament configuration automatically
     */
    public function generateAutomaticTournamentConfig(): \App\ValueObjects\TournamentConfig
    {
        $participantCount = $this->getEligibleParticipantCount();

        if ($this->shouldUseUniversalStructure()) {
            // Use universal structure
            $config = \App\ValueObjects\TournamentConfig::fromUniversal($participantCount, $this->total_rounds ?? 5);
        } else {
            // Use existing preset logic
            $preset = $this->determinePreset($participantCount);
            $config = \App\ValueObjects\TournamentConfig::fromPreset(
                $preset,
                $this->total_rounds ?? 5,
                $participantCount
            );
        }

        // Store the generated configuration
        $this->setTournamentConfig($config);

        return $config;
    }

    /**
     * Get resolved standings with complete tiebreak calculation
     */
    public function getResolvedStandings(): \Illuminate\Support\Collection
    {
        if ($this->standings()->isEmpty()) {
            return collect();
        }

        $tiebreakService = new \App\Services\TiebreakPolicyService();
        return $tiebreakService->getResolvedStandings($this);
    }

    /**
     * Get tournament structure explanation
     */
    public function getStructureExplanation(): array
    {
        $participantCount = $this->getEligibleParticipantCount();
        $k4 = \App\ValueObjects\TournamentConfig::calculateK4($participantCount);

        return [
            'participant_count' => $participantCount,
            'k4_value' => $k4,
            'k4_formula' => $participantCount <= 4 ? 3 :
                          ($participantCount <= 12 ? 4 :
                          ($participantCount <= 24 ? 6 :
                          ($participantCount <= 48 ? 8 : 12))),
            'structure_type' => $this->shouldUseUniversalStructure() ? 'universal' : 'preset',
            'rounds' => $this->total_rounds ?? 5,
            'pattern' => 'Swiss + Cut + Finals',
            'round_4_contenders' => $k4,
            'final_participants' => 2,
        ];
    }
}
