<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class ChatSafetyService
{
    public const PRESET_MESSAGES = [
        'Good luck!',
        'Good move!',
        'Thanks!',
        'Well played!',
        'Nice tactic!',
        'I need to think.',
        'Good game!',
    ];

    public const EMOJI_MESSAGES = [
        "\u{1F44D}",
        "\u{1F44F}",
        "\u{1F642}",
        "\u{1F91D}",
        "\u{265F}",
    ];

    public const REPORT_REASONS = [
        'unsafe_language',
        'bullying',
        'personal_info',
        'spam_or_link',
        'other',
    ];

    private const PRESET_ONLY_AGE = 13;

    private const URL_PATTERN = '~(?:https?://|www\.|[a-z0-9][a-z0-9.-]*\.(?:com|in|org|net|io|gg|co)(?:/|\b))~i';

    private const PROFANITY = [
        'asshole',
        'bastard',
        'bitch',
        'bloody',
        'crap',
        'damn',
        'dumbass',
        'fuck',
        'idiot',
        'moron',
        'shit',
        'stupid',
    ];

    public function policyFor(User $user, ?Game $game = null): array
    {
        $user->loadMissing('organization');

        $accountDisabled = (bool) ($user->social_access_disabled ?? false);
        $organizationDisabled = (bool) ($user->organization?->social_access_disabled ?? false);
        $blocked = $game ? $this->hasBlockBetweenPlayers($user, $game) : false;
        $presetOnly = $this->requiresPresetOnly($user);

        $reason = null;
        if ($accountDisabled) {
            $reason = 'account_disabled';
        } elseif ($organizationDisabled) {
            $reason = 'organization_disabled';
        } elseif ($blocked) {
            $reason = 'blocked';
        }

        return [
            'enabled' => !$accountDisabled && !$organizationDisabled && !$blocked,
            'mode' => $presetOnly ? 'preset_only' : 'filtered_text',
            'preset_only' => $presetOnly,
            'reason' => $reason,
            'preset_messages' => self::PRESET_MESSAGES,
            'emoji_messages' => self::EMOJI_MESSAGES,
            'report_reasons' => self::REPORT_REASONS,
            'max_length' => 500,
        ];
    }

    /**
     * @return array{message:string, original_message:?string, message_type:string, safety_action:?string, filtered:bool}
     */
    public function processOutgoingMessage(User $user, Game $game, string $message): array
    {
        $message = trim($message);
        if ($message === '') {
            throw ValidationException::withMessages(['message' => 'Message is required.']);
        }

        $policy = $this->policyFor($user, $game);
        if (!$policy['enabled']) {
            throw ValidationException::withMessages([
                'message' => $this->disabledMessage($policy['reason']),
            ]);
        }

        if ($policy['preset_only']) {
            if (!$this->isAllowedPresetMessage($message)) {
                throw ValidationException::withMessages([
                    'message' => 'This account can only send preset chat phrases and approved emoji.',
                ]);
            }

            return [
                'message' => $message,
                'original_message' => null,
                'message_type' => 'preset',
                'safety_action' => null,
                'filtered' => false,
            ];
        }

        $filteredMessage = $this->filterFreeText($message);
        if ($filteredMessage === '') {
            throw ValidationException::withMessages([
                'message' => 'Message was blocked by the safety filter.',
            ]);
        }

        $changed = $filteredMessage !== $message;

        return [
            'message' => $filteredMessage,
            'original_message' => $changed ? $message : null,
            'message_type' => 'free_text',
            'safety_action' => $changed ? 'filtered' : null,
            'filtered' => $changed,
        ];
    }

    public function hasBlockBetweenPlayers(User $user, Game $game): bool
    {
        $opponent = $game->getOpponent($user->id);
        if (!$opponent) {
            return false;
        }

        return UserBlock::query()
            ->where(function ($query) use ($user, $opponent) {
                $query->where('blocker_id', $user->id)
                    ->where('blocked_user_id', $opponent->id);
            })
            ->orWhere(function ($query) use ($user, $opponent) {
                $query->where('blocker_id', $opponent->id)
                    ->where('blocked_user_id', $user->id);
            })
            ->exists();
    }

    public function requiresPresetOnly(User $user): bool
    {
        // Fail closed: on a kid-safe platform, unknown age is treated as a child.
        // New signups collect a birthday; legacy/OAuth accounts without one are
        // prompted to add it (users.needs_birthday) to unlock free-text chat.
        if (!$user->birthday) {
            return true;
        }

        $birthday = $user->birthday instanceof Carbon
            ? $user->birthday
            : Carbon::parse($user->birthday);

        return $birthday->age < self::PRESET_ONLY_AGE;
    }

    public function isAllowedPresetMessage(string $message): bool
    {
        $message = trim($message);

        if (in_array($message, self::PRESET_MESSAGES, true)) {
            return true;
        }

        $parts = preg_split('/\s+/u', $message, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($parts === [] || count($parts) > 5) {
            return false;
        }

        foreach ($parts as $part) {
            if (!in_array($part, self::EMOJI_MESSAGES, true)) {
                return false;
            }
        }

        return true;
    }

    private function filterFreeText(string $message): string
    {
        $message = preg_replace(self::URL_PATTERN, '[link removed]', $message) ?? $message;

        foreach (self::PROFANITY as $word) {
            $message = preg_replace(
                '/\b' . preg_quote($word, '/') . '\b/i',
                str_repeat('*', strlen($word)),
                $message
            ) ?? $message;
        }

        return trim(preg_replace('/\s+/', ' ', $message) ?? $message);
    }

    private function disabledMessage(?string $reason): string
    {
        return match ($reason) {
            'account_disabled' => 'Chat is disabled for this account.',
            'organization_disabled' => 'Chat is disabled by your school or organization.',
            'blocked' => 'Chat is blocked between these players.',
            default => 'Chat is unavailable.',
        };
    }
}
