<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class OrganizationController extends Controller
{
    /**
     * Get list of all organizations
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $this->authorize('viewAny', Organization::class);

            $query = Organization::query();

            // Non-admins only see approved orgs
            if (!$request->user()->hasRole('platform_admin')) {
                $query->where('status', 'approved');
            }

            // Filter by active status
            if ($request->has('active')) {
                $query->where('is_active', $request->boolean('active'));
            }

            // Filter by type
            if ($request->has('type')) {
                $query->where('type', $request->input('type'));
            }

            // Search by name
            if ($request->has('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('slug', 'LIKE', "%{$search}%")
                      ->orWhere('description', 'LIKE', "%{$search}%");
                });
            }

            // Include member count
            $query->withCount('users');

            // Include championship count
            $query->withCount('championships');

            // Order by name
            $query->orderBy('name', 'asc');

            // Paginate results
            $organizations = $query->paginate($request->input('per_page', 15));

            return response()->json($organizations);
        } catch (\Exception $e) {
            Log::error('Organization listing failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch organizations',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a single organization
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        try {
            $organization = Organization::with([
                'creator:id,name,email',
                'users:id,name,email,organization_id',
                'championships:id,title,status_id,organization_id,start_date',
            ])->findOrFail($id);

            $this->authorize('view', $organization);

            return response()->json([
                'message' => 'Organization retrieved successfully',
                'organization' => $organization,
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to view this organization',
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Organization not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Organization retrieval failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a new organization
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $this->authorize('create', Organization::class);

            $validator = Validator::make($request->all(), [
                'name' => ['required', 'string', 'max:255', 'unique:organizations,name'],
                'slug' => ['nullable', 'string', 'max:255', 'unique:organizations,slug'],
                'description' => ['nullable', 'string', 'max:1000'],
                'type' => ['required', 'string', 'in:club,school,federation,company,community,other'],
                'website' => ['nullable', 'url', 'max:255'],
                'contact_email' => ['required', 'email', 'max:255'],
                'contact_phone' => ['nullable', 'string', 'max:50'],
                'logo_url' => ['nullable', 'url', 'max:255'],
                'is_active' => ['nullable', 'boolean'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();

            try {
                // Create organization with created_by
                $data = $validator->validated();
                $data['created_by'] = Auth::id();
                $data['is_active'] = $data['is_active'] ?? true;

                $organization = Organization::create($data);

                // Automatically assign creator as organization admin
                $user = Auth::user();
                $user->organization_id = $organization->id;
                $user->save();

                // Assign organization_admin role if not already assigned
                if (!$user->hasRole('organization_admin')) {
                    $user->assignRole('organization_admin');
                }

                DB::commit();

                Log::info('Organization created', [
                    'organization_id' => $organization->id,
                    'name' => $organization->name,
                    'created_by' => Auth::id(),
                ]);

                return response()->json([
                    'message' => 'Organization created successfully',
                    'organization' => $organization->load('creator:id,name,email'),
                ], 201);
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to create organizations',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Organization creation failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'data' => $request->all(),
            ]);

            return response()->json([
                'error' => 'Failed to create organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing organization
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('update', $organization);

            $validator = Validator::make($request->all(), [
                'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('organizations')->ignore($id)],
                'slug' => ['sometimes', 'nullable', 'string', 'max:255', Rule::unique('organizations')->ignore($id)],
                'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
                'type' => ['sometimes', 'required', 'string', 'in:club,school,federation,company,community,other'],
                'website' => ['sometimes', 'nullable', 'url', 'max:255'],
                'contact_email' => ['sometimes', 'required', 'email', 'max:255'],
                'contact_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
                'logo_url' => ['sometimes', 'nullable', 'url', 'max:255'],
                'is_active' => ['sometimes', 'boolean'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            // Prevent tampering with created_by
            $data = $request->except(['created_by']);

            // If name changed, regenerate slug
            if (isset($data['name']) && $data['name'] !== $organization->name) {
                $data['slug'] = Organization::generateSlug($data['name']);
            }

            $organization->update($data);

            Log::info('Organization updated', [
                'organization_id' => $organization->id,
                'updated_by' => Auth::id(),
                'changes' => array_keys($data),
            ]);

            return response()->json([
                'message' => 'Organization updated successfully',
                'organization' => $organization->load('creator:id,name,email'),
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to update this organization',
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Organization not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Organization update failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Failed to update organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an organization (soft delete)
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('delete', $organization);

            // Check if organization has active championships
            $activeChampionships = $organization->championships()
                ->whereHas('statusRelation', function ($query) {
                    $query->whereIn('code', ['upcoming', 'registration', 'active']);
                })
                ->count();

            if ($activeChampionships > 0) {
                return response()->json([
                    'error' => 'Cannot delete organization',
                    'message' => "Organization has {$activeChampionships} active championship(s). Please complete or cancel them first.",
                ], 422);
            }

            $organization->delete();

            Log::info('Organization deleted', [
                'organization_id' => $organization->id,
                'name' => $organization->name,
                'deleted_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Organization deleted successfully',
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to delete this organization',
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Organization not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Organization deletion failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Failed to delete organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get organization members
     *
     * @param int $id
     * @return JsonResponse
     */
    public function members(int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('view', $organization);

            $members = $organization->users()
                ->with('roles:id,name')
                ->select('id', 'name', 'email', 'avatar_url', 'organization_id', 'created_at')
                ->paginate(20);

            return response()->json([
                'message' => 'Organization members retrieved successfully',
                'members' => $members,
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to view this organization',
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Organization not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Organization members retrieval failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch organization members',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add user to organization
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function addMember(Request $request, int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('manageUsers', $organization);

            $validator = Validator::make($request->all(), [
                'user_id' => ['required', 'exists:users,id'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            $user = User::findOrFail($request->user_id);

            // Check if user already belongs to an organization
            if ($user->organization_id && $user->organization_id !== $organization->id) {
                return response()->json([
                    'error' => 'User already belongs to another organization',
                    'message' => 'User must leave their current organization first',
                ], 422);
            }

            $user->organization_id = $organization->id;
            $user->save();

            Log::info('User added to organization', [
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'added_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'User added to organization successfully',
                'user' => $user->only(['id', 'name', 'email']),
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to manage organization users',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Add organization member failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to add user to organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Search for active organizations (public, for users to find & join)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function searchSchools(Request $request): JsonResponse
    {
        $search = $request->input('q', '');

        $query = Organization::query()
            ->where('is_active', true)
            ->select('id', 'name', 'type', 'logo_url', 'slug')
            ->withCount('users');

        if ($request->has('type')) {
            $query->where('type', $request->input('type'));
        }

        if (strlen($search) >= 2) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('slug', 'LIKE', "%{$search}%");
            });
        }

        $organizations = $query->orderBy('name', 'asc')
            ->limit(10)
            ->get();

        return response()->json($organizations);
    }

    /**
     * Join an organization (user self-service)
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function joinSchool(Request $request, int $id): JsonResponse
    {
        try {
            $user = $request->user();
            $organization = Organization::where('is_active', true)->findOrFail($id);

            if ($user->organization_id) {
                return response()->json([
                    'error' => 'You are already affiliated with an organization. Leave it first.',
                ], 422);
            }

            $user->organization_id = $organization->id;
            $user->save();

            Log::info('User joined organization', [
                'user_id' => $user->id,
                'organization_id' => $organization->id,
            ]);

            return response()->json([
                'message' => 'Successfully joined ' . $organization->name,
                'organization' => $organization->only(['id', 'name', 'type', 'logo_url']),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Organization not found'], 404);
        }
    }

    /**
     * Leave current organization (user self-service)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function leaveSchool(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->organization_id) {
            return response()->json(['error' => 'You are not affiliated with any organization'], 422);
        }

        $orgName = $user->organization?->name ?? 'organization';

        // Don't allow creator to leave their own org
        $org = Organization::find($user->organization_id);
        if ($org && $org->created_by === $user->id) {
            return response()->json([
                'error' => 'Organization creators cannot leave. Transfer ownership or delete the organization.',
            ], 422);
        }

        $user->organization_id = null;
        $user->save();

        Log::info('User left organization', [
            'user_id' => $user->id,
            'organization' => $orgName,
        ]);

        return response()->json(['message' => 'Successfully left ' . $orgName]);
    }

    /**
     * Remove user from organization
     *
     * @param int $organizationId
     * @param int $userId
     * @return JsonResponse
     */
    public function removeMember(int $organizationId, int $userId): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($organizationId);
            $this->authorize('manageUsers', $organization);

            $user = User::findOrFail($userId);

            // Cannot remove the organization creator
            if ($user->id === $organization->created_by) {
                return response()->json([
                    'error' => 'Cannot remove organization creator',
                    'message' => 'The organization creator cannot be removed',
                ], 422);
            }

            // Verify user belongs to this organization
            if ($user->organization_id !== $organization->id) {
                return response()->json([
                    'error' => 'User does not belong to this organization',
                ], 422);
            }

            $user->organization_id = null;
            $user->save();

            Log::info('User removed from organization', [
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'removed_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'User removed from organization successfully',
            ]);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have permission to manage organization users',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Remove organization member failed', [
                'organization_id' => $organizationId,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to remove user from organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Invite a user by email to the organization
     */
    public function invite(Request $request, int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('manageUsers', $organization);

            $validator = Validator::make($request->all(), [
                'email' => ['required', 'email', 'max:255'],
                'role' => ['nullable', 'string', 'in:member,organization_admin'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            $email = strtolower($request->input('email'));

            // Don't invite yourself
            if ($email === strtolower(Auth::user()->email)) {
                return response()->json(['error' => 'You cannot invite yourself'], 422);
            }

            // Check for existing pending invitation
            $existing = OrganizationInvitation::where('organization_id', $organization->id)
                ->where('email', $email)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->first();

            if ($existing) {
                return response()->json([
                    'error' => 'An invitation is already pending for this email',
                ], 422);
            }

            // Look up user by email
            $targetUser = User::where('email', $email)->first();

            // Check if user is already a member
            if ($targetUser && $targetUser->organization_id === $organization->id) {
                return response()->json(['error' => 'User is already a member of this organization'], 422);
            }

            // Check if user belongs to another org
            if ($targetUser && $targetUser->organization_id) {
                return response()->json([
                    'error' => 'This user already belongs to another organization',
                ], 422);
            }

            $invitation = OrganizationInvitation::create([
                'organization_id' => $organization->id,
                'invited_by' => Auth::id(),
                'email' => $email,
                'user_id' => $targetUser?->id,
                'role' => $request->input('role', 'member'),
            ]);

            Log::info('Organization invitation sent', [
                'organization_id' => $organization->id,
                'email' => $email,
                'invited_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Invitation sent successfully',
                'invitation' => $invitation->load('inviter:id,name,email'),
            ], 201);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json(['error' => 'You do not have permission to invite members'], 403);
        } catch (\Exception $e) {
            Log::error('Organization invitation failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Failed to send invitation'], 500);
        }
    }

    /**
     * List pending invitations for an organization
     */
    public function invitations(int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('view', $organization);

            $invitations = OrganizationInvitation::where('organization_id', $id)
                ->with('inviter:id,name,email')
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json([
                'invitations' => $invitations,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch invitations'], 500);
        }
    }

    /**
     * Cancel a pending invitation
     */
    public function cancelInvitation(int $id, int $invitationId): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);
            $this->authorize('manageUsers', $organization);

            $invitation = OrganizationInvitation::where('organization_id', $id)
                ->where('id', $invitationId)
                ->where('status', 'pending')
                ->firstOrFail();

            $invitation->update(['status' => 'cancelled', 'responded_at' => now()]);

            return response()->json(['message' => 'Invitation cancelled']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to cancel invitation'], 500);
        }
    }

    /**
     * Get pending invitations for the authenticated user
     */
    public function myInvitations(Request $request): JsonResponse
    {
        $user = $request->user();

        $invitations = OrganizationInvitation::where(function ($q) use ($user) {
            $q->where('user_id', $user->id)
              ->orWhere('email', $user->email);
        })
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->with(['organization:id,name,type,logo_url', 'inviter:id,name,email'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['invitations' => $invitations]);
    }

    /**
     * Accept an organization invitation
     */
    public function acceptInvitation(Request $request, int $invitationId): JsonResponse
    {
        try {
            $user = $request->user();

            $invitation = OrganizationInvitation::where('id', $invitationId)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->orWhere('email', $user->email);
                })
                ->firstOrFail();

            if ($user->organization_id) {
                return response()->json([
                    'error' => 'You already belong to an organization. Leave it first.',
                ], 422);
            }

            DB::beginTransaction();
            $invitation->update(['status' => 'accepted', 'responded_at' => now(), 'user_id' => $user->id]);
            $user->organization_id = $invitation->organization_id;
            $user->save();
            DB::commit();

            Log::info('Organization invitation accepted', [
                'invitation_id' => $invitation->id,
                'user_id' => $user->id,
                'organization_id' => $invitation->organization_id,
            ]);

            return response()->json([
                'message' => 'You have joined ' . $invitation->organization->name,
                'organization' => $invitation->organization->only(['id', 'name', 'type']),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Invitation not found or expired'], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Accept organization invitation failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to accept invitation'], 500);
        }
    }

    /**
     * Reject an organization invitation
     */
    public function rejectInvitation(Request $request, int $invitationId): JsonResponse
    {
        try {
            $user = $request->user();

            $invitation = OrganizationInvitation::where('id', $invitationId)
                ->where('status', 'pending')
                ->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->orWhere('email', $user->email);
                })
                ->firstOrFail();

            $invitation->update(['status' => 'rejected', 'responded_at' => now(), 'user_id' => $user->id]);

            return response()->json(['message' => 'Invitation rejected']);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Invitation not found or expired'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to reject invitation'], 500);
        }
    }

    /**
     * Request a new organization (creates with status=pending)
     */
    public function requestOrganization(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'name' => ['required', 'string', 'max:255', 'unique:organizations,name'],
                'type' => ['required', 'string', 'in:club,school,federation,company,community,other'],
                'city' => ['nullable', 'string', 'max:100'],
                'state' => ['nullable', 'string', 'max:100'],
                'website' => ['nullable', 'url', 'max:255'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            $user = $request->user();

            if ($user->organization_id) {
                return response()->json([
                    'error' => 'You are already affiliated with an organization',
                ], 422);
            }

            $organization = Organization::create([
                'name' => $request->input('name'),
                'type' => $request->input('type'),
                'city' => $request->input('city'),
                'state' => $request->input('state'),
                'website' => $request->input('website'),
                'status' => 'pending',
                'is_active' => false,
                'requested_by' => $user->id,
                'created_by' => $user->id,
            ]);

            Log::info('Organization request submitted', [
                'organization_id' => $organization->id,
                'name' => $organization->name,
                'requested_by' => $user->id,
            ]);

            return response()->json([
                'message' => 'Organization request submitted successfully',
                'organization' => $organization,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Organization request failed', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()?->id,
            ]);

            return response()->json([
                'error' => 'Failed to submit organization request',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * List pending organization requests (admin only)
     */
    public function pendingRequests(Request $request): JsonResponse
    {
        try {
            $organizations = Organization::pending()
                ->with(['requester:id,name,email', 'creator:id,name,email'])
                ->orderBy('created_at', 'desc')
                ->paginate($request->input('per_page', 15));

            return response()->json($organizations);
        } catch (\Exception $e) {
            Log::error('Failed to fetch pending organizations', ['error' => $e->getMessage()]);

            return response()->json([
                'error' => 'Failed to fetch pending organization requests',
            ], 500);
        }
    }

    /**
     * Approve a pending organization request (admin only)
     */
    public function approveRequest(int $id): JsonResponse
    {
        try {
            $organization = Organization::where('status', 'pending')->findOrFail($id);

            DB::beginTransaction();

            $organization->update([
                'status' => 'approved',
                'is_active' => true,
            ]);

            // Auto-assign requester as org admin
            $requester = User::find($organization->requested_by);
            if ($requester) {
                $requester->organization_id = $organization->id;
                $requester->save();

                if (!$requester->hasRole('organization_admin')) {
                    $requester->assignRole('organization_admin');
                }
            }

            DB::commit();

            Log::info('Organization request approved', [
                'organization_id' => $organization->id,
                'name' => $organization->name,
                'approved_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Organization approved successfully',
                'organization' => $organization->fresh()->load('requester:id,name,email'),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Pending organization not found'], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Organization approval failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to approve organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject a pending organization request (admin only)
     */
    public function rejectRequest(Request $request, int $id): JsonResponse
    {
        try {
            $organization = Organization::where('status', 'pending')->findOrFail($id);

            $organization->update([
                'status' => 'rejected',
                'is_active' => false,
            ]);

            Log::info('Organization request rejected', [
                'organization_id' => $organization->id,
                'name' => $organization->name,
                'rejected_by' => Auth::id(),
                'reason' => $request->input('reason'),
            ]);

            return response()->json([
                'message' => 'Organization request rejected',
                'organization' => $organization->fresh(),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Pending organization not found'], 404);
        } catch (\Exception $e) {
            Log::error('Organization rejection failed', [
                'organization_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to reject organization',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
