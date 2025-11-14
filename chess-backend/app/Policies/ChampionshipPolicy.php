<?php

namespace App\Policies;

use App\Models\Championship;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ChampionshipPolicy
{
    use HandlesAuthorization;

    /**
     * Determine if the user can view any championships
     */
    public function viewAny(?User $user): bool
    {
        // Anyone can view public championships (including guests)
        return true;
    }

    /**
     * Determine if the user can view a specific championship
     */
    public function view(?User $user, Championship $championship): bool
    {
        // Public championships are visible to everyone (including guests)
        if ($championship->visibility === 'public') {
            return true;
        }

        // Allow viewing if public registration is enabled
        // This enables users to view details, register, participate, and view stats
        // Regardless of current status (upcoming, registration_open, etc.)
        if ($championship->allow_public_registration) {
            return true;
        }

        // Use the championship's visibility logic for private championships
        return $championship->isVisibleTo($user);
    }

    /**
     * Determine if the user can create championships
     */
    public function create(User $user): bool
    {
        // Must be authenticated and have permission
        return $user->hasPermission('create_championship');
    }

    /**
     * Determine if the user can update the championship
     */
    public function update(User $user, Championship $championship): bool
    {
        // Platform admins can edit anything
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Users with edit_any_championship permission
        if ($user->hasPermission('edit_any_championship')) {
            return true;
        }

        // Creator can edit their own championship
        if ($championship->created_by === $user->id &&
            $user->hasPermission('edit_own_championship')) {
            return true;
        }

        // Organization admins can edit org championships
        if ($user->hasRole('organization_admin') &&
            $championship->organization_id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can delete the championship
     */
    public function delete(User $user, Championship $championship): bool
    {
        // Platform admins can delete anything
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Users with delete_any_championship permission
        if ($user->hasPermission('delete_any_championship')) {
            return true;
        }

        // Creator can delete their own championship
        if ($championship->created_by === $user->id &&
            $user->hasPermission('delete_own_championship')) {
            return true;
        }

        // Organization admins can delete org championships
        if ($user->hasRole('organization_admin') &&
            $championship->organization_id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can manage participants
     */
    public function manageParticipants(User $user, Championship $championship): bool
    {
        // Must have permission
        if (!$user->hasPermission('manage_championship_participants')) {
            return false;
        }

        // Platform admins can manage any
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Creator can manage their championship participants
        if ($championship->created_by === $user->id) {
            return true;
        }

        // Organization admins can manage org championship participants
        if ($user->hasRole('organization_admin') &&
            $championship->organization_id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can set match results
     */
    public function setMatchResults(User $user, Championship $championship): bool
    {
        // Must have permission
        if (!$user->hasPermission('set_match_results')) {
            return false;
        }

        // Platform admins can set any results
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Monitors can set results
        if ($user->hasRole('monitor')) {
            return true;
        }

        // Tournament organizers can set results
        if ($user->hasRole('tournament_organizer') &&
            $championship->created_by === $user->id) {
            return true;
        }

        // Organization admins can set results for org championships
        if ($user->hasRole('organization_admin') &&
            $championship->organization_id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can register for the championship
     */
    public function register(User $user, Championship $championship): bool
    {
        // Must have permission
        if (!$user->hasPermission('register_for_championship')) {
            return false;
        }

        // Check championship-level registration rules
        if (!$championship->is_registration_open) {
            return false;
        }

        if ($championship->isFull()) {
            return false;
        }

        if ($championship->isUserRegistered($user->id)) {
            return false;
        }

        // Check visibility for private championships
        if ($championship->visibility === 'private') {
            return $championship->created_by === $user->id ||
                   ($championship->organization_id === $user->organization_id &&
                    $user->hasRole('organization_admin'));
        }

        // Check organization membership for org-only championships
        if ($championship->visibility === 'organization_only') {
            return $championship->organization_id === $user->organization_id;
        }

        return true;
    }

    /**
     * Determine if the user can view all matches
     */
    public function viewAllMatches(User $user, Championship $championship): bool
    {
        // Platform admins can view all
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Monitors can view all games
        if ($user->hasPermission('view_all_games')) {
            return true;
        }

        // Championship creator can view all matches
        if ($championship->created_by === $user->id) {
            return true;
        }

        // Registered participants can view matches
        if ($championship->isUserRegistered($user->id)) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can restore the championship
     *
     * Platform admins and original creators can restore
     */
    public function restore(User $user, Championship $championship): bool
    {
        // Platform admins can restore any championship
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Original creator can restore their own championship
        if ($championship->created_by === $user->id) {
            return true;
        }

        // Organization admins can restore org championships
        if ($user->hasRole('organization_admin') &&
            $championship->organization_id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can permanently delete the championship
     *
     * STRICT: Only platform admins can force delete
     * This is the most restrictive permission as it's irreversible
     */
    public function forceDelete(User $user, Championship $championship): bool
    {
        // Only platform admins can permanently delete
        return $user->hasRole('platform_admin');
    }

    /**
     * Determine if the user can archive the championship
     *
     * Allows archiving of empty in_progress championships for cleanup
     */
    public function archive(User $user, Championship $championship): bool
    {
        // Must be able to delete the championship (same permissions)
        if (!$this->delete($user, $championship)) {
            return false;
        }

        // Championship must be archivable
        return $championship->canBeArchived();
    }
}
