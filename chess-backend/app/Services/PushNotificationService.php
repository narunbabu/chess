<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    /**
     * Send push notification to a specific user across all their devices.
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::activeForUser($userId)->get();

        foreach ($tokens as $deviceToken) {
            try {
                match ($deviceToken->platform) {
                    'android' => $this->sendFcm($deviceToken->device_token, $title, $body, $data),
                    'ios' => $this->sendFcm($deviceToken->device_token, $title, $body, $data), // FCM supports both
                };
            } catch (\Exception $e) {
                Log::warning('Push notification failed', [
                    'user_id' => $userId,
                    'platform' => $deviceToken->platform,
                    'error' => $e->getMessage(),
                ]);

                // Mark token as inactive if it's invalid
                if ($this->isTokenInvalid($e)) {
                    $deviceToken->update(['is_active' => false]);
                }
            }
        }
    }

    /**
     * Send notification via Firebase Cloud Messaging (supports both Android and iOS).
     */
    private function sendFcm(string $token, string $title, string $body, array $data = []): void
    {
        $serverKey = config('services.fcm.server_key');
        if (!$serverKey) {
            Log::debug('FCM server key not configured, skipping push notification');
            return;
        }

        $payload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                ],
                'data' => array_map('strval', $data),
                'android' => [
                    'priority' => 'high',
                    'notification' => [
                        'sound' => 'default',
                        'channel_id' => 'chess99_game',
                    ],
                ],
                'apns' => [
                    'payload' => [
                        'aps' => [
                            'sound' => 'default',
                            'badge' => 1,
                        ],
                    ],
                ],
            ],
        ];

        $projectId = config('services.fcm.project_id');
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $this->getAccessToken(),
            'Content-Type' => 'application/json',
        ])->post(
            "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send",
            $payload
        );

        if (!$response->successful()) {
            Log::error('FCM send failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'token_prefix' => substr($token, 0, 20),
            ]);
        }
    }

    /**
     * Get OAuth2 access token for FCM v1 API.
     * In production, use a service account key file with google/auth library.
     */
    private function getAccessToken(): string
    {
        // For production, implement proper OAuth2 token exchange using
        // the FCM service account JSON key file.
        // For now, fall back to legacy server key if configured.
        return config('services.fcm.server_key', '');
    }

    /**
     * Send "your turn" notification for multiplayer games.
     */
    public function sendYourTurnNotification(int $userId, string $opponentName, int $gameId): void
    {
        $this->sendToUser($userId, 'Your Turn!', "{$opponentName} made a move. It's your turn.", [
            'type' => 'game_move',
            'game_id' => (string) $gameId,
            'action' => 'open_game',
        ]);
    }

    /**
     * Send game invitation notification.
     */
    public function sendGameInvitationNotification(int $userId, string $inviterName, int $invitationId): void
    {
        $this->sendToUser($userId, 'Game Invitation', "{$inviterName} wants to play chess with you!", [
            'type' => 'invitation',
            'invitation_id' => (string) $invitationId,
            'action' => 'open_invitation',
        ]);
    }

    /**
     * Send tournament notification.
     */
    public function sendTournamentNotification(int $userId, string $title, string $body, int $championshipId): void
    {
        $this->sendToUser($userId, $title, $body, [
            'type' => 'tournament',
            'championship_id' => (string) $championshipId,
            'action' => 'open_tournament',
        ]);
    }

    /**
     * Check if an FCM error indicates the token is permanently invalid.
     */
    private function isTokenInvalid(\Exception $e): bool
    {
        $message = $e->getMessage();
        return str_contains($message, 'NOT_FOUND')
            || str_contains($message, 'INVALID_ARGUMENT')
            || str_contains($message, 'UNREGISTERED');
    }
}
