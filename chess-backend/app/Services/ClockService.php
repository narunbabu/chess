<?php

namespace App\Services;

use App\Models\Game;

/**
 * ClockService - Server-Authoritative Clock Logic
 *
 * Implements the core timing algorithms for chess clocks with server authority.
 * All clock manipulation happens through these methods to ensure consistency.
 *
 * Key principles:
 * - Server decides running side and remaining milliseconds
 * - Lazy timing: elapsed time calculated only on events/heartbeats
 * - No drift: clients render from server snapshots only
 * - No race conditions: server snapshots are authoritative
 */
class ClockService
{
    /**
     * Get current server time in milliseconds (epoch)
     */
    public function nowMs(): int
    {
        return (int) (microtime(true) * 1000);
    }

    /**
     * Apply elapsed time to the running clock
     *
     * This is the core timing function called before every operation.
     * It updates the clock state based on elapsed time since last_server_ms.
     *
     * @param array $clock Clock state (white_ms, black_ms, running, last_server_ms, status)
     * @param int|null $now Current server time in ms (defaults to now)
     * @return array Updated clock state
     */
    public function applyElapsed(array $clock, ?int $now = null): array
    {
        $now = $now ?? $this->nowMs();
        $elapsed = max(0, $now - ($clock['last_server_ms'] ?? 0));

        // Update timestamp even if no time deducted
        $clock['last_server_ms'] = $now;

        // Don't deduct time if game not active, nothing running, or no elapsed time
        if (
            ($clock['status'] ?? 'active') !== 'active' ||
            empty($clock['running']) ||
            $elapsed === 0
        ) {
            return $clock;
        }

        // Deduct elapsed time from the active clock
        $side = $clock['running'];
        $key = $side === 'white' ? 'white_ms' : 'black_ms';
        $clock[$key] = max(0, ($clock[$key] ?? 0) - $elapsed);

        // Check for flag (time's up)
        if ($clock[$key] === 0) {
            $clock['status'] = 'over';
            $clock['reason'] = 'flag';
            $clock['running'] = null;
            $clock['winner'] = $side === 'white' ? 'black' : 'white';
        }

        return $clock;
    }

    /**
     * Process a move: apply elapsed time, flip clock, add increment
     *
     * Called when a valid move is made. This is the primary state transition.
     *
     * @param array $clock Current clock state
     * @param string $mover The player who made the move ('white' or 'black')
     * @return array Updated clock state
     */
    public function onMove(array $clock, string $mover): array
    {
        $now = $this->nowMs();

        // Apply elapsed time first
        $clock = $this->applyElapsed($clock, $now);

        // If game already over, don't flip
        if (($clock['status'] ?? 'active') !== 'active') {
            return $clock;
        }

        // Add increment to mover's clock (Fischer time control)
        $incKey = $mover === 'white' ? 'white_ms' : 'black_ms';
        if (($clock['increment_ms'] ?? 0) > 0) {
            $clock[$incKey] = ($clock[$incKey] ?? 0) + $clock['increment_ms'];
        }

        // Flip the running clock to opponent
        $clock['running'] = $mover === 'white' ? 'black' : 'white';
        $clock['last_server_ms'] = $now;

        return $clock;
    }

    /**
     * Pause the game clock
     *
     * Stops time deduction by setting running to null.
     * Applies any remaining elapsed time first.
     *
     * @param array $clock Current clock state
     * @return array Updated clock state
     */
    public function pause(array $clock): array
    {
        $now = $this->nowMs();

        // Apply any elapsed time before pausing
        $clock = $this->applyElapsed($clock, $now);

        $clock['running'] = null;
        $clock['status'] = 'paused';
        $clock['last_server_ms'] = $now;

        return $clock;
    }

    /**
     * Resume the game clock
     *
     * Restarts time deduction for the specified side.
     *
     * @param array $clock Current clock state
     * @param string $turn Which side's clock should run ('white' or 'black')
     * @return array Updated clock state
     */
    public function resume(array $clock, string $turn): array
    {
        $now = $this->nowMs();

        $clock['running'] = $turn;
        $clock['status'] = 'active';
        $clock['last_server_ms'] = $now;

        return $clock;
    }

    /**
     * Initialize clock state from game model
     *
     * @param Game $game The game model
     * @param int|null $initialMs Initial time per side in milliseconds
     * @param int|null $incrementMs Time increment per move in milliseconds
     * @return array Clock state array
     */
    public function initializeFromGame(Game $game, ?int $initialMs = null, ?int $incrementMs = null): array
    {
        $now = $this->nowMs();

        // Use game's existing values or defaults
        $whiteMs = $game->white_ms ?? $initialMs ?? 600000; // 10 minutes default
        $blackMs = $game->black_ms ?? $initialMs ?? 600000;
        $incrementMs = $incrementMs ?? $game->increment_ms ?? 0;

        return [
            'white_ms' => $whiteMs,
            'black_ms' => $blackMs,
            'running' => $game->turn ?? 'white', // Start with whoever's turn it is
            'last_server_ms' => $now,
            'increment_ms' => $incrementMs,
            'status' => $game->status ?? 'active',
            'reason' => $game->end_reason ?? null,
            'revision' => $game->revision ?? 0,
        ];
    }

    /**
     * Get clock snapshot for broadcasting
     *
     * Applies elapsed time and returns a clean snapshot for WebSocket transmission.
     *
     * @param array $clock Current clock state
     * @return array Snapshot suitable for broadcasting
     */
    public function getSnapshot(array $clock): array
    {
        // Apply elapsed time to get current state
        $clock = $this->applyElapsed($clock);

        return [
            'white_ms' => $clock['white_ms'] ?? 0,
            'black_ms' => $clock['black_ms'] ?? 0,
            'running' => $clock['running'] ?? null,
            'last_server_ms' => $clock['last_server_ms'] ?? $this->nowMs(),
            'increment_ms' => $clock['increment_ms'] ?? 0,
            'status' => $clock['status'] ?? 'active',
            'reason' => $clock['reason'] ?? null,
        ];
    }

    /**
     * Validate clock state integrity
     *
     * @param array $clock Clock state to validate
     * @return bool True if valid
     */
    public function isValid(array $clock): bool
    {
        // Check required keys
        $required = ['white_ms', 'black_ms', 'last_server_ms', 'status'];
        foreach ($required as $key) {
            if (!isset($clock[$key])) {
                return false;
            }
        }

        // Check value constraints
        if ($clock['white_ms'] < 0 || $clock['black_ms'] < 0) {
            return false;
        }

        if (!in_array($clock['running'] ?? null, ['white', 'black', null])) {
            return false;
        }

        return true;
    }
}
