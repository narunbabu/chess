<?php

namespace App\Validators;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Enums\ChampionshipStatus;
use App\Enums\ChampionshipFormat;
use App\Enums\PaymentStatus;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ChampionshipValidator
{
    /**
     * Validate championship creation data
     */
    public static function validateCreate(array $data): array
    {
        $validator = Validator::make($data, [
            'title' => 'required|string|max:255|min:3',
            'description' => 'nullable|string|max:5000',
            'entry_fee' => 'required|numeric|min:0|max:10000',
            'max_participants' => 'nullable|integer|min:2|max:1024',
            'registration_deadline' => 'required|date|after:now|before:start_date',
            'start_date' => 'required|date|after:registration_deadline',
            'match_time_window_hours' => 'required|integer|min:1|max:168',
            'time_control_minutes' => 'nullable|integer|min:1|max:180',
            'time_control_increment' => 'nullable|integer|min:0|max:60',
            'total_rounds' => 'nullable|integer|min:1|max:20',
            'format' => 'required|string|in:swiss_only,elimination_only,hybrid',
            'swiss_rounds' => 'nullable|integer|min:1|max:20',
            'top_qualifiers' => 'nullable|integer',
            'organization_id' => 'nullable|integer|exists:organizations,id',
            'visibility' => 'nullable|string|in:public,private,organization',
            'allow_public_registration' => 'nullable|boolean',
        ], [
            'title.required' => 'Championship title is required',
            'title.min' => 'Championship title must be at least 3 characters',
            'entry_fee.max' => 'Entry fee cannot exceed ₹10,000',
            'max_participants.power_of_two' => 'Max participants must be a power of 2 for elimination tournaments',
            'registration_deadline.before' => 'Registration deadline must be before start date',
            'swiss_rounds.required_if' => 'Swiss rounds are required for Swiss and Hybrid formats',
            'top_qualifiers.required_if' => 'Top qualifiers are required for Hybrid format',
            'top_qualifiers.even' => 'Top qualifiers must be an even number',
            'top_qualifiers.power_of_two' => 'Top qualifiers must be a power of 2',
        ]);

        // Custom validation for format-specific rules
        $validator->after(function ($validator) use ($data) {
            self::validateFormatSpecificRules($validator, $data);
        });

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate championship update data
     */
    public static function validateUpdate(array $data, Championship $championship): array
    {
        $rules = [
            'title' => 'sometimes|required|string|max:255|min:3',
            'description' => 'sometimes|nullable|string|max:5000',
            'max_participants' => 'sometimes|nullable|integer|min:2|max:1024',
            'registration_deadline' => 'sometimes|required|date|after:now|before:start_date',
            'start_date' => 'sometimes|required|date|after:registration_deadline',
            'match_time_window_hours' => 'sometimes|required|integer|min:1|max:168',
            'time_control_minutes' => 'sometimes|nullable|integer|min:1|max:180',
            'time_control_increment' => 'sometimes|nullable|integer|min:0|max:60',
            'total_rounds' => 'sometimes|nullable|integer|min:1|max:20',
            'visibility' => 'sometimes|nullable|string|in:public,private,organization',
            'allow_public_registration' => 'sometimes|nullable|boolean',
        ];

        // Allow format changes only if championship hasn't started
        if ($championship->getStatusEnum()->isUpcoming()) {
            $rules = array_merge($rules, [
                'format' => 'sometimes|required|string|in:swiss_only,elimination_only,hybrid',
                'swiss_rounds' => 'sometimes|required_if:format,swiss_only,hybrid|nullable|integer|min:1|max:20',
                'top_qualifiers' => 'sometimes|required_if:format,hybrid|nullable|integer|min:2|max:64|even|power_of_two',
            ]);
        }

        $validator = Validator::make($data, $rules);

        // Custom validation for championship state
        $validator->after(function ($validator) use ($data, $championship) {
            self::validateUpdatePermissions($validator, $data, $championship);
        });

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate match creation
     */
    public static function validateMatchCreation(array $data, Championship $championship): array
    {
        $validator = Validator::make($data, [
            'player1_id' => 'required|integer|exists:users,id',
            'player2_id' => 'required|integer|exists:users,id|different:player1_id',
            'round_number' => 'required|integer|min:1',
            'round_type' => 'required|string|in:swiss,elimination',
            'scheduled_at' => 'nullable|date|after:now',
            'deadline' => 'required|date|after:scheduled_at',
        ]);

        $validator->after(function ($validator) use ($data, $championship) {
            self::validateMatchParticipants($validator, $data, $championship);
            self::validateMatchRound($validator, $data, $championship);
            self::validateDuplicateMatch($validator, $data, $championship);
        });

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate match result reporting
     */
    public static function validateMatchResult(array $data, ChampionshipMatch $match, User $reporter): array
    {
        $validator = Validator::make($data, [
            'result' => 'required|string|in:win,draw,loss',
            'opponent_agreed' => 'boolean',
            'game_id' => 'nullable|integer|exists:games,id',
        ]);

        $validator->after(function ($validator) use ($match, $reporter) {
            self::validateResultPermission($validator, $match, $reporter);
            self::validateMatchStatus($validator, $match);
        });

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    /**
     * Validate round scheduling
     */
    public static function validateRoundScheduling(Championship $championship): void
    {
        $errors = [];

        // Check championship status
        if (!$championship->getStatusEnum()->isActive() && !$championship->getStatusEnum()->isUpcoming()) {
            $errors[] = 'Championship must be active or upcoming to schedule rounds';
        }

        // Check if previous round is complete
        $currentRound = $championship->matches()->max('round_number') ?? 0;
        if ($currentRound > 0) {
            $previousRoundComplete = $championship->matches()
                ->where('round_number', $currentRound)
                ->whereNotCompleted() // Use model scope instead of direct status query
                ->count() === 0;

            if (!$previousRoundComplete) {
                $errors[] = 'Previous round must be complete before scheduling next round';
            }
        }

        // Check minimum participants
        $participantCount = $championship->participants()
            ->where('payment_status_id', PaymentStatus::COMPLETED->getId())
            ->where('dropped', false)
            ->count();

        if ($participantCount < 2) {
            $errors[] = 'At least 2 paid participants are required to schedule rounds';
        }

        // Check tournament completion
        if (self::isTournamentComplete($championship)) {
            $errors[] = 'Tournament is already complete';
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Validate participant registration
     */
    public static function validateRegistration(Championship $championship, User $user): void
    {
        $errors = [];

        // Check registration period
        if (!$championship->is_registration_open) {
            $errors[] = 'Registration is not open for this championship';
        }

        if (now()->greaterThan($championship->registration_deadline)) {
            $errors[] = 'Registration deadline has passed';
        }

        // Check if championship is full
        if ($championship->isFull()) {
            $errors[] = 'Championship is full';
        }

        // Check if already registered
        if ($championship->isUserRegistered($user->id)) {
            $errors[] = 'You are already registered for this championship';
        }

        // Check eligibility
        if (!self::isUserEligible($championship, $user)) {
            $errors[] = 'You are not eligible to participate in this championship';
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Validate format-specific rules
     */
    private static function validateFormatSpecificRules($validator, array $data): void
    {
        $format = $data['format'] ?? null;

        if ($format === 'hybrid') {
            $swissRounds = $data['swiss_rounds'] ?? 0;
            $topQualifiers = $data['top_qualifiers'] ?? 0;

            // For hybrid, ensure top qualifiers doesn't exceed reasonable limit
            $maxParticipants = $data['max_participants'] ?? 64;
            if ($topQualifiers > $maxParticipants) {
                $validator->errors()->add('top_qualifiers', 'Top qualifiers cannot exceed max participants');
            }

            // Ensure swiss rounds provide enough games for meaningful qualification
            if ($swissRounds < 3) {
                $validator->errors()->add('swiss_rounds', 'Hybrid tournaments should have at least 3 Swiss rounds for proper qualification');
            }
        } elseif ($format === 'elimination_only') {
            // For pure elimination, ensure max participants is power of 2
            $maxParticipants = $data['max_participants'] ?? null;
            if ($maxParticipants && !self::isPowerOfTwo($maxParticipants)) {
                $validator->errors()->add('max_participants', 'Max participants must be a power of 2 for elimination tournaments');
            }
        }
    }

    /**
     * Validate update permissions based on championship state
     */
    private static function validateUpdatePermissions($validator, array $data, Championship $championship): void
    {
        $status = $championship->getStatusEnum();

        // Restrict certain changes when championship is active
        if ($status->isActive()) {
            $restrictedFields = ['format', 'swiss_rounds', 'top_qualifiers', 'entry_fee'];
            foreach ($restrictedFields as $field) {
                if (isset($data[$field]) && $data[$field] != $championship->$field) {
                    $validator->errors()->add($field, "Cannot change {$field} when championship is active");
                }
            }

            // Cannot reduce max participants below current active participants
            if (isset($data['max_participants'])) {
                $currentParticipants = $championship->participants()->active()->count();
                if ($data['max_participants'] < $currentParticipants) {
                    $validator->errors()->add('max_participants', 'Cannot reduce max participants below current participant count');
                }
            }
        }

        // Cannot move start date earlier if there are paid participants
        if (isset($data['start_date']) && $championship->participants()->where('payment_status_id', PaymentStatus::COMPLETED->getId())->exists()) {
            if ($data['start_date']->lt($championship->start_date)) {
                $validator->errors()->add('start_date', 'Cannot move start date earlier when participants have paid');
            }
        }
    }

    /**
     * Validate match participants
     */
    private static function validateMatchParticipants($validator, array $data, Championship $championship): void
    {
        $player1Id = $data['player1_id'];
        $player2Id = $data['player2_id'];

        // Check if players are registered and paid
        $player1Participant = $championship->participants()
            ->where('user_id', $player1Id)
            ->where('payment_status_id', PaymentStatus::COMPLETED->getId())
            ->where('dropped', false)
            ->first();

        $player2Participant = $championship->participants()
            ->where('user_id', $player2Id)
            ->where('payment_status_id', PaymentStatus::COMPLETED->getId())
            ->where('dropped', false)
            ->first();

        if (!$player1Participant) {
            $validator->errors()->add('player1_id', 'Player 1 is not a paid participant in this championship');
        }

        if (!$player2Participant) {
            $validator->errors()->add('player2_id', 'Player 2 is not a paid participant in this championship');
        }
    }

    /**
     * Validate match round
     */
    private static function validateMatchRound($validator, array $data, Championship $championship): void
    {
        $roundNumber = $data['round_number'];
        $roundType = $data['round_type'];
        $format = $championship->getFormatEnum();

        // Validate round type consistency
        if ($format->isSwiss() && $roundType !== 'swiss') {
            $validator->errors()->add('round_type', 'Swiss tournaments can only have Swiss rounds');
        }

        if ($format->isElimination() && $roundType !== 'elimination') {
            $validator->errors()->add('round_type', 'Elimination tournaments can only have elimination rounds');
        }

        // Validate round number
        $maxRound = $championship->matches()->max('round_number') ?? 0;
        if ($roundNumber <= $maxRound) {
            $validator->errors()->add('round_number', 'Round number must be greater than existing rounds');
        }
    }

    /**
     * Validate no duplicate matches
     */
    private static function validateDuplicateMatch($validator, array $data, Championship $championship): void
    {
        $player1Id = $data['player1_id'];
        $player2Id = $data['player2_id'];

        $existingMatch = $championship->matches()
            ->where(function ($query) use ($player1Id, $player2Id) {
                $query->where(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player1Id)
                      ->where('player2_id', $player2Id);
                })->orWhere(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player2Id)
                      ->where('player2_id', $player1Id);
                });
            })
            ->whereNotCompleted() // Use model scope instead of direct status query
            ->first();

        if ($existingMatch) {
            $validator->errors()->add('player1_id', 'These players already have a scheduled match');
        }
    }

    /**
     * Validate result permission
     */
    private static function validateResultPermission($validator, ChampionshipMatch $match, User $reporter): void
    {
        if (!$match->hasPlayer($reporter->id)) {
            $validator->errors()->add('result', 'You are not a participant in this match');
        }

        if ($match->getStatusEnum()->isFinished()) {
            $validator->errors()->add('result', 'Match is already finished');
        }
    }

    /**
     * Validate match status for result reporting
     */
    private static function validateMatchStatus($validator, ChampionshipMatch $match): void
    {
        if ($match->getStatusEnum()->isFinished()) {
            $validator->errors()->add('match', 'Match is already finished');
        }

        if ($match->getStatusEnum()->isPending() && !$match->game_id) {
            $validator->errors()->add('match', 'Game must be created before reporting result');
        }
    }

    /**
     * Check if user is eligible for championship
     */
    private static function isUserEligible(Championship $championship, User $user): bool
    {
        // Add any eligibility checks here
        // For example: rating requirements, age restrictions, etc.
        return true;
    }

    /**
     * Check if tournament is complete
     */
    private static function isTournamentComplete(Championship $championship): bool
    {
        $format = $championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                $currentRound = $championship->matches()->max('round_number') ?? 0;
                return $currentRound >= $championship->swiss_rounds;

            case 'elimination_only':
            case 'hybrid':
                $activeParticipants = $championship->participants()
                    ->where('dropped', false)
                    ->where('payment_status_id', PaymentStatus::COMPLETED->getId())
                    ->count();
                return $activeParticipants <= 1;

            default:
                return false;
        }
    }

    /**
     * Check if number is power of 2
     */
    private static function isPowerOfTwo(int $n): bool
    {
        return $n > 0 && ($n & ($n - 1)) === 0;
    }
}