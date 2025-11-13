<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class UserPolicy
{
    use HandlesAuthorization;

    /**
     * Determine if the user can view any users
     */
    public function viewAny(User $user): bool
    {
        // Platform admins and org admins can view user lists
        return $user->hasAnyRole(['platform_admin', 'organization_admin']);
    }

    /**
     * Determine if the user can view the user profile
     */
    public function view(User $user, User $model): bool
    {
        // Users can view their own profile
        if ($user->id === $model->id) {
            return true;
        }

        // Platform admins can view all profiles
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization admins can view org members
        if ($user->hasRole('organization_admin') &&
            $model->organization_id === $user->organization_id) {
            return true;
        }

        // Otherwise, users can view public profiles (basic implementation)
        return true; // Will be restricted by what data is returned
    }

    /**
     * Determine if the user can create users
     */
    public function create(User $user): bool
    {
        return $user->hasPermission('manage_users');
    }

    /**
     * Determine if the user can update the user
     */
    public function update(User $user, User $model): bool
    {
        // Users can update their own profile
        if ($user->id === $model->id) {
            return true;
        }

        // Platform admins can update any user
        if ($user->hasPermission('manage_users')) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can delete the user
     */
    public function delete(User $user, User $model): bool
    {
        // Users cannot delete themselves
        if ($user->id === $model->id) {
            return false;
        }

        // Platform admins can delete users
        if ($user->hasPermission('manage_users')) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can assign roles
     */
    public function assignRoles(User $user, User $model): bool
    {
        // Platform admins can assign any roles
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization admins can assign limited roles to org members
        if ($user->hasRole('organization_admin') &&
            $model->organization_id === $user->organization_id) {
            // They can assign: player, tournament_organizer, monitor
            // But NOT: platform_admin, organization_admin
            return $user->hasPermission('manage_organization_users');
        }

        return false;
    }

    /**
     * Determine if the user can manage another user's roles
     */
    public function manageRoles(User $user, User $model): bool
    {
        // Users cannot manage their own roles
        if ($user->id === $model->id) {
            return false;
        }

        return $user->hasPermission('manage_roles');
    }

    /**
     * Determine if the user can view analytics
     */
    public function viewAnalytics(User $user): bool
    {
        return $user->hasPermission('view_analytics');
    }

    /**
     * Determine if the user can restore the user
     */
    public function restore(User $user, User $model): bool
    {
        return $user->hasRole('platform_admin');
    }

    /**
     * Determine if the user can permanently delete the user
     */
    public function forceDelete(User $user, User $model): bool
    {
        return $user->hasRole('platform_admin');
    }
}
