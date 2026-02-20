<?php

namespace App\Exceptions;

/**
 * Thrown when a ChampionshipParticipant payment status transition is not permitted
 * by the registered state machine rules.
 */
class InvalidStateTransitionException extends \RuntimeException
{
    public function __construct(string $from, string $to)
    {
        $allowed = \App\Models\ChampionshipParticipant::ALLOWED_TRANSITIONS[$from] ?? [];
        $allowedList = empty($allowed) ? 'none (terminal state)' : implode(', ', $allowed);

        parent::__construct(
            "Invalid payment status transition: '{$from}' → '{$to}'. " .
            "Allowed transitions from '{$from}': {$allowedList}."
        );
    }
}
