<?php

namespace App\Http\Controllers;

use App\Models\Organization;
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
}
