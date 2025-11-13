<?php

namespace App\Handlers;

use App\Exceptions\TournamentException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class TournamentExceptionHandler
{
    /**
     * Handle tournament exceptions
     */
    public static function handle(Throwable $exception): array
    {
        if ($exception instanceof TournamentException) {
            return self::handleTournamentException($exception);
        }

        if ($exception instanceof ValidationException) {
            return self::handleValidationException($exception);
        }

        // Handle other exceptions
        return self::handleGenericException($exception);
    }

    /**
     * Handle specific tournament exceptions
     */
    private static function handleTournamentException(TournamentException $exception): array
    {
        // Log the error
        Log::error("Tournament error: {$exception->getErrorType()}", [
            'message' => $exception->getMessage(),
            'error_type' => $exception->getErrorType(),
            'context' => $exception->getContext(),
            'trace' => $exception->getTraceAsString(),
        ]);

        return [
            'error' => $exception->getErrorType(),
            'message' => $exception->getMessage(),
            'context' => $exception->getContext(),
            'status_code' => $exception->getStatusCode(),
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle validation exceptions
     */
    private static function handleValidationException(ValidationException $exception): array
    {
        Log::warning("Validation error in tournament operation", [
            'message' => $exception->getMessage(),
            'errors' => $exception->errors(),
        ]);

        return [
            'error' => 'validation_failed',
            'message' => 'The given data was invalid.',
            'errors' => $exception->errors(),
            'status_code' => 422,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle generic exceptions
     */
    private static function handleGenericException(Throwable $exception): array
    {
        Log::error("Unexpected error in tournament operation", [
            'message' => $exception->getMessage(),
            'class' => get_class($exception),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ]);

        // Don't expose sensitive error details in production
        $shouldExposeDetails = config('app.debug', false);

        return [
            'error' => 'internal_server_error',
            'message' => $shouldExposeDetails ? $exception->getMessage() : 'An unexpected error occurred',
            'context' => $shouldExposeDetails ? [
                'class' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ] : [],
            'status_code' => 500,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle service-specific errors
     */
    public static function handleServiceError(string $service, Throwable $exception): array
    {
        Log::error("Service error in {$service}", [
            'message' => $exception->getMessage(),
            'service' => $service,
            'trace' => $exception->getTraceAsString(),
        ]);

        return [
            'error' => 'service_error',
            'message' => "An error occurred in {$service} service",
            'service' => $service,
            'context' => config('app.debug', false) ? [
                'original_error' => $exception->getMessage(),
            ] : [],
            'status_code' => 500,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle database errors
     */
    public static function handleDatabaseError(Throwable $exception, array $context = []): array
    {
        Log::error("Database error in tournament operation", [
            'message' => $exception->getMessage(),
            'context' => $context,
            'trace' => $exception->getTraceAsString(),
        ]);

        return [
            'error' => 'database_error',
            'message' => 'A database error occurred while processing your request',
            'context' => config('app.debug', false) ? [
                'original_error' => $exception->getMessage(),
            ] : [],
            'status_code' => 500,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle authorization errors
     */
    public static function handleAuthorizationError(string $action, $user = null): array
    {
        Log::warning("Authorization error", [
            'action' => $action,
            'user_id' => $user?->id,
            'user_email' => $user?->email,
        ]);

        return [
            'error' => 'authorization_error',
            'message' => 'You are not authorized to perform this action',
            'action' => $action,
            'status_code' => 403,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle rate limiting errors
     */
    public static function handleRateLimitError(string $action, int $remainingSeconds): array
    {
        Log::info("Rate limit exceeded", [
            'action' => $action,
            'retry_after' => $remainingSeconds,
        ]);

        return [
            'error' => 'rate_limit_exceeded',
            'message' => 'Too many requests. Please try again later.',
            'action' => $action,
            'retry_after' => $remainingSeconds,
            'status_code' => 429,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle timeout errors
     */
    public static function handleTimeoutError(string $operation, int $timeoutSeconds): array
    {
        Log::warning("Operation timeout", [
            'operation' => $operation,
            'timeout_seconds' => $timeoutSeconds,
        ]);

        return [
            'error' => 'timeout_error',
            'message' => 'The operation timed out. Please try again.',
            'operation' => $operation,
            'timeout_seconds' => $timeoutSeconds,
            'status_code' => 408,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Handle external service errors (e.g., payment providers)
     */
    public static function handleExternalServiceError(
        string $service,
        string $error,
        array $serviceContext = []
    ): array {
        Log::error("External service error", [
            'service' => $service,
            'error' => $error,
            'context' => $serviceContext,
        ]);

        return [
            'error' => 'external_service_error',
            'message' => "An error occurred while communicating with {$service}",
            'service' => $service,
            'context' => config('app.debug', false) ? $serviceContext : [],
            'status_code' => 502,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Create a standardized success response
     */
    public static function successResponse(
        string $message,
        array $data = [],
        array $meta = []
    ): array {
        return [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => array_merge([
                'timestamp' => now()->toISOString(),
            ], $meta),
        ];
    }

    /**
     * Create a standardized error response
     */
    public static function errorResponse(
        string $error,
        string $message,
        array $context = [],
        int $statusCode = 400
    ): array {
        return [
            'success' => false,
            'error' => $error,
            'message' => $message,
            'context' => $context,
            'status_code' => $statusCode,
            'timestamp' => now()->toISOString(),
        ];
    }
}