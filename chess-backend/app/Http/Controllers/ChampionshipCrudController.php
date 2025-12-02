<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Championship CRUD Operations Controller
 *
 * Handles basic Create, Read, Update, Delete operations for championships.
 * Separated from ChampionshipController to maintain single responsibility principle.
 */
class ChampionshipCrudController extends Controller
{
    /**
     * Get list of championships
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            // Refresh user data to get latest organization_id
            if ($user) {
                $user->refresh();
            }

            // Base query - consider visibility for non-authenticated users
            $query = Championship::query();

            // Filter archived championships (admin/organizer only)
            if ($request->boolean('archived')) {
                $this->authorizeArchiveAccess($user);
                $query->onlyTrashed();
            }

            // Apply filters
            $this->applyFilters($query, $request);

            // Apply search
            if ($request->filled('search')) {
                $this->applySearch($query, $request->input('search'));
            }

            // Apply sorting
            $this->applySorting($query, $request);

            // Pagination
            $perPage = min($request->input('per_page', 15), 100);
            $championships = $query->paginate($perPage);

            return response()->json([
                'data' => $championships->items(),
                'pagination' => [
                    'current_page' => $championships->currentPage(),
                    'last_page' => $championships->lastPage(),
                    'per_page' => $championships->perPage(),
                    'total' => $championships->total(),
                    'from' => $championships->firstItem(),
                    'to' => $championships->lastItem(),
                ],
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error fetching championships', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to fetch championships',
            ], 500);
        }
    }

    /**
     * Get a specific championship
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if ($user) {
                $user->refresh();
            }

            $championship = Championship::with([
                'participants.user',
                'matches.whitePlayer',
                'matches.blackPlayer',
                'standings.user',
                'organization',
                'creator'
            ])->findOrFail($id);

            // Authorization check for private championships
            $this->authorizeViewAccess($championship, $user);

            return response()->json([
                'championship' => $championship,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error fetching championship', [
                'id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to fetch championship',
            ], 500);
        }
    }

    /**
     * Create a new championship
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $this->authorizeCreateAccess($user);

            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'description' => 'nullable|string|max:2000',
                'format' => 'required|string|in:swiss_only,single_elimination,double_elimination,round_robin,hybrid',
                'max_participants' => 'required|integer|min:2|max:10000',
                'min_participants' => 'nullable|integer|min:2|max:max_participants',
                'time_control_minutes' => 'required|integer|min:1|max:480',
                'time_control_increment' => 'nullable|integer|min:0|max:60',
                'total_rounds' => 'required|integer|min:1|max:100',
                'registration_deadline' => 'nullable|date|after:now',
                'start_date' => 'nullable|date|after_or_equal:registration_deadline',
                'organization_id' => 'nullable|exists:organizations,id',
                'visibility' => 'required|string|in:public,private,unlisted',
                'allow_public_registration' => 'boolean',
                'entry_fee' => 'nullable|numeric|min:0|max:999999.99',
                // Scheduling settings
                'match_time_window_hours' => 'nullable|integer|min:1|max:168',
                'scheduling_instructions' => 'nullable|string|max:1000',
                'play_instructions' => 'nullable|string|max:1000',
                'default_grace_period_minutes' => 'nullable|integer|min:0|max:1440',
                'allow_early_play' => 'boolean',
                'require_confirmation' => 'boolean',
                // Tournament configuration
                'tournament_settings' => 'nullable|array',
                'tournament_config' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Prepare championship data
            $championshipData = [
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'format' => $validated['format'],
                'max_participants' => $validated['max_participants'],
                'min_participants' => $validated['min_participants'] ?? 2,
                'time_control_minutes' => $validated['time_control_minutes'],
                'time_control_increment' => $validated['time_control_increment'] ?? 0,
                'total_rounds' => $validated['total_rounds'],
                'registration_deadline' => $validated['registration_deadline'] ?? null,
                'start_date' => $validated['start_date'] ?? null,
                'organization_id' => $validated['organization_id'] ?? $user->organization_id,
                'visibility' => $validated['visibility'],
                'allow_public_registration' => $validated['allow_public_registration'] ?? true,
                'entry_fee' => $validated['entry_fee'] ?? 0,
                'created_by' => $user->id,
                // Scheduling settings
                'match_time_window_hours' => $validated['match_time_window_hours'] ?? 48,
                'scheduling_instructions' => $validated['scheduling_instructions'] ?? null,
                'play_instructions' => $validated['play_instructions'] ?? null,
                'default_grace_period_minutes' => $validated['default_grace_period_minutes'] ?? 30,
                'allow_early_play' => $validated['allow_early_play'] ?? false,
                'require_confirmation' => $validated['require_confirmation'] ?? false,
                // Tournament configuration
                'tournament_settings' => $validated['tournament_settings'] ?? [],
                'tournament_config' => $validated['tournament_config'] ?? [],
                'tournament_generated' => false,
                'status' => 'upcoming',
            ];

            // Set default status based on registration settings
            if ($validated['registration_deadline'] && now()->greaterThan($validated['registration_deadline'])) {
                $championshipData['status'] = 'registration_closed';
            } elseif ($validated['allow_public_registration'] && (!$validated['registration_deadline'] || now()->lessThan($validated['registration_deadline']))) {
                $championshipData['status'] = 'registration_open';
            }

            $championship = Championship::create($championshipData);

            Log::info('Championship created', [
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'title' => $championship->title,
            ]);

            return response()->json([
                'championship' => $championship->fresh([
                    'organization',
                    'creator',
                ]),
                'message' => 'Championship created successfully',
            ], 201);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error creating championship', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to create championship',
            ], 500);
        }
    }

    /**
     * Update a championship
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($id);

            $this->authorizeUpdateAccess($championship, $user);

            // Define validation rules based on championship status
            $rules = $this->getUpdateValidationRules($championship);

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Apply updates based on what can be modified at current status
            $updateData = $this->prepareUpdateData($validated, $championship);

            $championship->update($updateData);

            Log::info('Championship updated', [
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'updated_fields' => array_keys($updateData),
            ]);

            return response()->json([
                'championship' => $championship->fresh([
                    'organization',
                    'creator',
                ]),
                'message' => 'Championship updated successfully',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error updating championship', [
                'id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to update championship',
            ], 500);
        }
    }

    /**
     * Delete a championship (soft delete)
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($id);

            $this->authorizeDeleteAccess($championship, $user);

            // Check if championship can be deleted
            if (!$championship->canBeDeleted()) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => $championship->getDeletionRestriction(),
                ], 422);
            }

            $championship->deleted_by = $user->id;
            $championship->save();

            $championship->delete();

            Log::info('Championship deleted', [
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'title' => $championship->title,
            ]);

            return response()->json([
                'message' => 'Championship deleted successfully',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error deleting championship', [
                'id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to delete championship',
            ], 500);
        }
    }

    // Helper Methods

    /**
     * Apply filters to championship query
     */
    private function applyFilters($query, Request $request): void
    {
        // Status filter
        if ($request->filled('status')) {
            $status = $request->input('status');
            match ($status) {
                'active' => $query->active(),
                'upcoming' => $query->upcoming(),
                'registration_open' => $query->registrationOpen(),
                'in_progress' => $query->inProgress(),
                'completed' => $query->completed(),
                default => $query->where('status', $status),
            };
        }

        // Format filter
        if ($request->filled('format')) {
            $query->where('format', $request->input('format'));
        }

        // Organization filter
        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->input('organization_id'));
        }

        // Creator filter
        if ($request->filled('creator_id')) {
            $query->where('created_by', $request->input('creator_id'));
        }

        // Entry fee filter
        if ($request->filled('free_only')) {
            $query->where(function ($q) {
                $q->whereNull('entry_fee')->orWhere('entry_fee', '<=', 0);
            });
        }

        // Registration deadline filter
        if ($request->filled('registration_open')) {
            $query->where(function ($q) {
                $q->whereNull('registration_deadline')
                  ->orWhere('registration_deadline', '>', now());
            });
        }
    }

    /**
     * Apply search to championship query
     */
    private function applySearch($query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('title', 'LIKE', "%{$search}%")
              ->orWhere('description', 'LIKE', "%{$search}%");
        });
    }

    /**
     * Apply sorting to championship query
     */
    private function applySorting($query, Request $request): void
    {
        $sortField = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');

        $allowedSortFields = [
            'title', 'created_at', 'start_date', 'registration_deadline',
            'max_participants', 'status', 'entry_fee'
        ];

        if (in_array($sortField, $allowedSortFields)) {
            $query->orderBy($sortField, $sortDirection);
        }
    }

    /**
     * Authorize access to archived championships
     */
    private function authorizeArchiveAccess($user): void
    {
        if (!$user || !$user->hasAnyRole(['platform_admin', 'organization_admin'])) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Only administrators can view archived championships'
            );
        }
    }

    /**
     * Authorize view access to championship
     */
    private function authorizeViewAccess(Championship $championship, $user): void
    {
        // Public championships can be viewed by anyone
        if ($championship->visibility === 'public') {
            return;
        }

        // Private championships require authentication
        if (!$user) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Authentication required to view this championship'
            );
        }

        // Unlisted championships require authentication
        if ($championship->visibility === 'unlisted') {
            return;
        }

        // Private championships require authorization
        if ($championship->visibility === 'private') {
            $isAuthorized = $user->hasAnyRole(['platform_admin', 'organization_admin']) ||
                           $user->id === $championship->created_by ||
                           $user->id === $championship->organization_id ||
                           $championship->participants()->where('user_id', $user->id)->exists();

            if (!$isAuthorized) {
                throw new \Illuminate\Auth\Access\AuthorizationException(
                    'You do not have permission to view this championship'
                );
            }
        }
    }

    /**
     * Authorize create access
     */
    private function authorizeCreateAccess($user): void
    {
        if (!$user) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Authentication required to create championships'
            );
        }

        if (!$user->hasAnyRole(['platform_admin', 'organization_admin', 'tournament_organizer'])) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'You do not have permission to create championships'
            );
        }
    }

    /**
     * Authorize update access
     */
    private function authorizeUpdateAccess(Championship $championship, $user): void
    {
        if (!$user) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Authentication required to update championships'
            );
        }

        $canUpdate = $user->hasAnyRole(['platform_admin']) ||
                     ($user->hasAnyRole(['organization_admin']) && $user->organization_id === $championship->organization_id) ||
                     $user->id === $championship->created_by;

        if (!$canUpdate) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'You do not have permission to update this championship'
            );
        }
    }

    /**
     * Authorize delete access
     */
    private function authorizeDeleteAccess(Championship $championship, $user): void
    {
        if (!$user) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Authentication required to delete championships'
            );
        }

        $canDelete = $user->hasAnyRole(['platform_admin']) ||
                    ($user->hasAnyRole(['organization_admin']) && $user->organization_id === $championship->organization_id) ||
                    $user->id === $championship->created_by;

        if (!$canDelete) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'You do not have permission to delete this championship'
            );
        }
    }

    /**
     * Get validation rules for updates based on championship status
     */
    private function getUpdateValidationRules(Championship $championship): array
    {
        $baseRules = [
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:2000',
            'organization_id' => 'nullable|exists:organizations,id',
            'visibility' => 'sometimes|string|in:public,private,unlisted',
            'max_participants' => 'sometimes|integer|min:2|max:10000',
            'min_participants' => 'nullable|integer|min:2|max:max_participants',
        ];

        // Different rules based on status
        if (in_array($championship->status, ['upcoming', 'registration_open'])) {
            $baseRules = array_merge($baseRules, [
                'format' => 'sometimes|string|in:swiss_only,single_elimination,double_elimination,round_robin,hybrid',
                'time_control_minutes' => 'sometimes|integer|min:1|max:480',
                'time_control_increment' => 'sometimes|integer|min:0|max:60',
                'total_rounds' => 'sometimes|integer|min:1|max:100',
                'registration_deadline' => 'sometimes|date|after:now',
                'start_date' => 'sometimes|date|after_or_equal:registration_deadline',
                'allow_public_registration' => 'sometimes|boolean',
                'entry_fee' => 'sometimes|numeric|min:0|max:999999.99',
            ]);
        }

        // Scheduling settings can be updated until championship starts
        if (!in_array($championship->status, ['in_progress', 'completed'])) {
            $baseRules = array_merge($baseRules, [
                'match_time_window_hours' => 'sometimes|integer|min:1|max:168',
                'scheduling_instructions' => 'sometimes|string|max:1000',
                'play_instructions' => 'sometimes|string|max:1000',
                'default_grace_period_minutes' => 'sometimes|integer|min:0|max:1440',
                'allow_early_play' => 'sometimes|boolean',
                'require_confirmation' => 'sometimes|boolean',
            ]);
        }

        return $baseRules;
    }

    /**
     * Prepare update data based on championship status
     */
    private function prepareUpdateData(array $validated, Championship $championship): array
    {
        $updateData = [];

        // Always allowed fields
        $alwaysAllowed = ['title', 'description', 'organization_id', 'visibility'];
        foreach ($alwaysAllowed as $field) {
            if (array_key_exists($field, $validated)) {
                $updateData[$field] = $validated[$field];
            }
        }

        // Status-dependent fields
        if (in_array($championship->status, ['upcoming', 'registration_open'])) {
            $statusDependent = [
                'format', 'time_control_minutes', 'time_control_increment',
                'total_rounds', 'registration_deadline', 'start_date',
                'allow_public_registration', 'entry_fee'
            ];
            foreach ($statusDependent as $field) {
                if (array_key_exists($field, $validated)) {
                    $updateData[$field] = $validated[$field];
                }
            }
        }

        // Scheduling settings
        if (!in_array($championship->status, ['in_progress', 'completed'])) {
            $schedulingFields = [
                'match_time_window_hours', 'scheduling_instructions',
                'play_instructions', 'default_grace_period_minutes',
                'allow_early_play', 'require_confirmation'
            ];
            foreach ($schedulingFields as $field) {
                if (array_key_exists($field, $validated)) {
                    $updateData[$field] = $validated[$field];
                }
            }
        }

        return $updateData;
    }
}