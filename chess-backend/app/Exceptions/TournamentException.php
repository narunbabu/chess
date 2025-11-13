<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TournamentException extends Exception
{
    /**
     * The error type
     */
    protected string $errorType;

    /**
     * Additional context data
     */
    protected array $context;

    /**
     * HTTP status code
     */
    protected int $statusCode;

    /**
     * Create a new tournament exception
     */
    public function __construct(
        string $message,
        string $errorType = 'tournament_error',
        array $context = [],
        int $statusCode = 400,
        ?Exception $previous = null
    ) {
        parent::__construct($message, 0, $previous);

        $this->errorType = $errorType;
        $this->context = $context;
        $this->statusCode = $statusCode;
    }

    /**
     * Get the error type
     */
    public function getErrorType(): string
    {
        return $this->errorType;
    }

    /**
     * Get the context data
     */
    public function getContext(): array
    {
        return $this->context;
    }

    /**
     * Get the HTTP status code
     */
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * Render the exception as an HTTP response
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => $this->errorType,
            'message' => $this->getMessage(),
            'context' => $this->context,
            'timestamp' => now()->toISOString(),
        ], $this->statusCode);
    }

    /**
     * Create a championship not found exception
     */
    public static function championshipNotFound(int $id): self
    {
        return new self(
            "Championship with ID {$id} not found",
            'championship_not_found',
            ['championship_id' => $id],
            404
        );
    }

    /**
     * Create a match not found exception
     */
    public static function matchNotFound(int $id): self
    {
        return new self(
            "Match with ID {$id} not found",
            'match_not_found',
            ['match_id' => $id],
            404
        );
    }

    /**
     * Create an access denied exception
     */
    public static function accessDenied(string $action, array $context = []): self
    {
        return new self(
            "Access denied for action: {$action}",
            'access_denied',
            array_merge(['action' => $action], $context),
            403
        );
    }

    /**
     * Create a tournament state exception
     */
    public static function invalidTournamentState(string $expectedState, string $actualState, array $context = []): self
    {
        return new self(
            "Invalid tournament state. Expected: {$expectedState}, Actual: {$actualState}",
            'invalid_tournament_state',
            array_merge([
                'expected_state' => $expectedState,
                'actual_state' => $actualState,
            ], $context),
            400
        );
    }

    /**
     * Create a pairing exception
     */
    public static function pairingFailed(string $reason, array $context = []): self
    {
        return new self(
            "Failed to generate pairings: {$reason}",
            'pairing_failed',
            array_merge(['reason' => $reason], $context),
            500
        );
    }

    /**
     * Create a scheduling exception
     */
    public static function schedulingFailed(string $reason, array $context = []): self
    {
        return new self(
            "Failed to schedule match: {$reason}",
            'scheduling_failed',
            array_merge(['reason' => $reason], $context),
            500
        );
    }

    /**
     * Create a payment exception
     */
    public static function paymentFailed(string $reason, array $context = []): self
    {
        return new self(
            "Payment failed: {$reason}",
            'payment_failed',
            array_merge(['reason' => $reason], $context),
            400
        );
    }

    /**
     * Create a validation exception
     */
    public static function validationFailed(array $errors, array $context = []): self
    {
        return new self(
            "Validation failed",
            'validation_failed',
            array_merge(['errors' => $errors], $context),
            422
        );
    }

    /**
     * Create a registration exception
     */
    public static function registrationFailed(string $reason, array $context = []): self
    {
        return new self(
            "Registration failed: {$reason}",
            'registration_failed',
            array_merge(['reason' => $reason], $context),
            400
        );
    }

    /**
     * Create a result reporting exception
     */
    public static function resultReportingFailed(string $reason, array $context = []): self
    {
        return new self(
            "Failed to report result: {$reason}",
            'result_reporting_failed',
            array_merge(['reason' => $reason], $context),
            400
        );
    }

    /**
     * Create a deadline exception
     */
    public static function deadlinePassed(string $deadlineType, array $context = []): self
    {
        return new self(
            "The {$deadlineType} deadline has passed",
            'deadline_passed',
            array_merge(['deadline_type' => $deadlineType], $context),
            400
        );
    }

    /**
     * Create a participant limit exception
     */
    public static function participantLimitReached(int $maxParticipants, array $context = []): self
    {
        return new self(
            "Championship has reached maximum participant limit of {$maxParticipants}",
            'participant_limit_reached',
            array_merge(['max_participants' => $maxParticipants], $context),
            400
        );
    }

    /**
     * Create an insufficient participants exception
     */
    public static function insufficientParticipants(int $required, int $actual, array $context = []): self
    {
        return new self(
            "Insufficient participants. Required: {$required}, Actual: {$actual}",
            'insufficient_participants',
            array_merge([
                'required' => $required,
                'actual' => $actual,
            ], $context),
            400
        );
    }

    /**
     * Create a service unavailable exception
     */
    public static function serviceUnavailable(string $service, array $context = []): self
    {
        return new self(
            "Service {$service} is currently unavailable",
            'service_unavailable',
            array_merge(['service' => $service], $context),
            503
        );
    }
}