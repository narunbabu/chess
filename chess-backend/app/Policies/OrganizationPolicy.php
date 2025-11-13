<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class OrganizationPolicy
{
    use HandlesAuthorization;

    /**
     * Determine if the user can view any organizations
     */
    public function viewAny(User $user): bool
    {
        // All authenticated users can view organizations list
        return true;
    }

    /**
     * Determine if the user can view the organization
     */
    public function view(User $user, Organization $organization): bool
    {
        // Platform admins can view all
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization members can view their org
        if ($organization->id === $user->organization_id) {
            return true;
        }

        // Only show active organizations to others
        return $organization->is_active;
    }

    /**
     * Determine if the user can create organizations
     */
    public function create(User $user): bool
    {
        return $user->hasPermission('create_organization');
    }

    /**
     * Determine if the user can update the organization
     */
    public function update(User $user, Organization $organization): bool
    {
        // Platform admins can update any
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization creator can update
        if ($organization->created_by === $user->id &&
            $user->hasPermission('manage_organization')) {
            return true;
        }

        // Organization admins can update their org
        if ($user->hasRole('organization_admin') &&
            $organization->id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can delete the organization
     */
    public function delete(User $user, Organization $organization): bool
    {
        // Platform admins can delete any
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization creator can delete
        if ($organization->created_by === $user->id &&
            $user->hasPermission('delete_organization')) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can manage organization users
     */
    public function manageUsers(User $user, Organization $organization): bool
    {
        // Must have permission
        if (!$user->hasPermission('manage_organization_users')) {
            return false;
        }

        // Platform admins can manage any
        if ($user->hasRole('platform_admin')) {
            return true;
        }

        // Organization admins can manage their org users
        if ($user->hasRole('organization_admin') &&
            $organization->id === $user->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can restore the organization
     */
    public function restore(User $user, Organization $organization): bool
    {
        return $user->hasRole('platform_admin');
    }

    /**
     * Determine if the user can permanently delete the organization
     */
    public function forceDelete(User $user, Organization $organization): bool
    {
        return $user->hasRole('platform_admin');
    }
}
