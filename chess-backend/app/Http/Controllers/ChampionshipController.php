<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Services\MatchSchedulerService;
use App\Services\StandingsCalculatorService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Jobs\GenerateNextRoundJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use App\Enums\PaymentStatus;

class ChampionshipController extends Controller
{
    public function __construct(
        private MatchSchedulerService $scheduler,
        private StandingsCalculatorService $standingsCalculator,
        private SwissPairingService $swissService,
        private EliminationBracketService $eliminationService
    ) {}
    /**
     * Get list of all championships
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // IMPORTANT: For public routes, Auth::user() returns null even with valid token
            // We must use Auth::guard('sanctum')->user() to check for optional authentication
            $user = Auth::guard('sanctum')->user();

            // IMPORTANT: Refresh user data from database to get latest organization_id
            // Sanctum tokens cache user data at login time
            if ($user) {
                $user->refresh();
            }

            // Debug: Check user and scope
            Log::info('Championship index request', [
                'user_id' => $user?->id,
                'user_email' => $user?->email,
                'has_user' => !is_null($user),
                'total_championships' => Championship::count(),
                'show_archived' => $request->boolean('archived'),
            ]);

            // Temporarily bypass visibility scope for debugging
            $query = Championship::query();
            // $query = Championship::visibleTo($user);

            // Show archived championships only for admins/organizers
            if ($request->boolean('archived')) {
                // Check authorization - only admins and organizers can view archived
                if (!$user || !$user->hasAnyRole(['platform_admin', 'organization_admin'])) {
                    return response()->json([
                        'error' => 'Unauthorized',
                        'message' => 'Only administrators can view archived championships',
                    ], 403);
                }
                $query->onlyTrashed();
            }

            // Filter by status
            if ($request->filled('status')) {
                $status = $request->input('status');
                if ($status === 'active') {
                    $query->active();
                } elseif ($status === 'upcoming') {
                    $query->upcoming();
                } elseif ($status === 'registration_open') {
                    $query->registrationOpen();
                } elseif ($status === 'completed') {
                    $query->completed();
                }
            }

            // Filter by format
            if ($request->filled('format')) {
                $query->where('format', $request->input('format'));
            }

            // Search by title
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where('title', 'LIKE', "%{$search}%");
            }

            // Order by start date
            $query->orderBy('start_date', 'desc');

            // Paginate results
            $championships = $query->paginate($request->input('per_page', 15));

            // Auto-update status for all championships in the result
            $championships->getCollection()->each(function ($championship) use ($user) {
                $championship->autoUpdateStatus();

                // Add user participation status for authenticated users
                if ($user) {
                    $userId = $user->id;
                    $isRegistered = $championship->isUserRegistered($userId);
                    $hasPaid = $championship->hasUserPaid($userId);

                    $championship->user_status = [
                        'is_registered' => $isRegistered,
                        'has_paid' => $hasPaid,
                        'can_register' => $championship->canRegister($userId),
                    ];

                    // For backward compatibility with frontend
                    if ($isRegistered) {
                        $participant = $championship->participants()->where('user_id', $userId)->first();
                        $championship->user_participation = [
                            'id' => $participant->id,
                            'registered_at' => $participant->registered_at,
                            'payment_status' => $participant->payment_status, // Use accessor
                            'amount_paid' => $participant->amount_paid,
                        ];
                    } else {
                        $championship->user_participation = null;
                    }
                }
            });

            return response()->json($championships);
        } catch (\Exception $e) {
            Log::error('Championship listing failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch championships',
                'message' => $e->getMessage(),
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
        // Authorization check
        Gate::authorize('create-championship');

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'entry_fee' => 'required|numeric|min:0|max:10000',
            'max_participants' => 'nullable|integer|min:2|max:1024',
            'registration_deadline' => 'required|date|after:now',
            'start_date' => 'required|date|after:registration_deadline',
            'match_time_window_hours' => 'required|integer|min:1|max:168',
            'time_control_minutes' => 'required|integer|min:1|max:180',
            'time_control_increment' => 'required|integer|min:0|max:60',
            'total_rounds' => 'nullable|integer|min:1|max:50',
            'format' => ['required', 'string', Rule::in(['swiss_only', 'elimination_only', 'hybrid'])],
            'swiss_rounds' => 'required_if:format,swiss_only,hybrid|integer|min:1|max:20',
            'top_qualifiers' => 'required_if:format,hybrid|integer|min:2|max:64|even',
            'organization_id' => 'nullable|exists:organizations,id',
            'visibility' => ['nullable', 'string', Rule::in(['public', 'private', 'organization_only'])],
            'allow_public_registration' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors(),
            ], 422);
        }

        try {
            $championship = DB::transaction(function () use ($request) {
                $data = $request->all();

                // Set created_by to current user
                $data['created_by'] = Auth::id();

                // Set defaults if not provided
                $data['visibility'] = $data['visibility'] ?? 'public';
                $data['allow_public_registration'] = $data['allow_public_registration'] ?? true;

                Log::info("Championship creation - request data", [
                    'organization_id_from_request' => $data['organization_id'] ?? 'not set',
                    'user_organization_id' => Auth::user()->organization_id ?? 'not set',
                ]);

                $championship = Championship::create($data);

                Log::info("Championship created", [
                    'championship_id' => $championship->id,
                    'title' => $championship->title,
                    'format' => $championship->format,
                    'created_by' => $championship->created_by,
                    'organization_id' => $championship->organization_id,
                    'visibility' => $championship->visibility,
                ]);

                return $championship;
            });

            return response()->json([
                'message' => 'Championship created successfully',
                'championship' => $championship,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Championship creation failed', [
                'error' => $e->getMessage(),
                'request_data' => $request->except(['created_by']), // Don't log created_by from request
            ]);

            return response()->json([
                'error' => 'Failed to create championship',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship details
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        try {
            $championship = Championship::with([
                'participants.user:id,name,email,avatar_url,rating',
                'standings.user:id,name,email,avatar_url,rating',
            ])->findOrFail($id);

            // Get user using same guard as index method for consistency
            $user = Auth::guard('sanctum')->user();

            // Authorization check - can user view this championship?
            // Get visibility, default to 'public' if column doesn't exist yet
            $visibility = $championship->visibility ?? 'public';

            // For guests (null user), only allow public championships
            if (!$user && $visibility !== 'public') {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You must be logged in to view this championship'
                ], 401);
            }

            // For authenticated users, check authorization via policy
            if ($user && !Gate::forUser($user)->allows('view', $championship)) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You do not have permission to view this championship'
                ], 403);
            }

            // Auto-update status if registration period has started
            $now = now();
            if ($championship->status === 'upcoming' &&
                $now->gte($championship->registration_start_at) &&
                $now->lte($championship->registration_end_at)) {
                $championship->update(['status' => 'registration_open']);
                $championship->refresh();
                Log::info('Championship status auto-updated to registration_open', [
                    'championship_id' => $championship->id,
                    'now' => $now,
                    'registration_start_at' => $championship->registration_start_at,
                    'registration_end_at' => $championship->registration_end_at,
                ]);
            }

            $userId = $user?->id;
            $isRegistered = false;
            $hasPaid = false;

            if ($userId) {
                $isRegistered = $championship->isUserRegistered($userId);
                $hasPaid = $championship->hasUserPaid($userId);
            }

            // Get additional tournament information
            $summary = $this->scheduler->getSchedulingSummary($championship);

            // Add user participation info to championship object for frontend compatibility
            $championship->user_participation = $isRegistered;
            $championship->user_status = $hasPaid ? 'paid' : ($isRegistered ? 'pending' : null);

            return response()->json([
                'championship' => $championship,
                'summary' => $summary,
                'user_status' => [
                    'is_registered' => $isRegistered,
                    'has_paid' => $hasPaid,
                    'can_register' => $userId ? $championship->canRegister($userId) : false,
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to view this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship detail fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to fetch championship details',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update championship details
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);

            // Authorization check
            Gate::authorize('update', $championship);

            // Validate based on championship status
            $rules = [
                'title' => 'sometimes|required|string|max:255',
                'description' => 'sometimes|nullable|string|max:5000',
                'max_participants' => 'sometimes|nullable|integer|min:2|max:1024',
                'registration_deadline' => 'sometimes|required|date|after:now',
                'start_date' => 'sometimes|required|date|after:registration_deadline',
                'match_time_window_hours' => 'sometimes|required|integer|min:1|max:168',
                'time_control_minutes' => 'sometimes|required|integer|min:1|max:180',
                'time_control_increment' => 'sometimes|required|integer|min:0|max:60',
                'total_rounds' => 'sometimes|nullable|integer|min:1|max:50',
                'visibility' => ['sometimes', 'string', Rule::in(['public', 'private', 'organization_only'])],
                'allow_public_registration' => 'sometimes|boolean',
            ];

            // Allow format changes only if championship hasn't started
            if ($championship->getStatusEnum()->isUpcoming()) {
                $rules = array_merge($rules, [
                    'format' => ['sometimes', 'required', 'string', Rule::in(['swiss_only', 'elimination_only', 'hybrid'])],
                    'swiss_rounds' => 'sometimes|required_if:format,swiss_only,hybrid|integer|min:1|max:20',
                    'top_qualifiers' => 'sometimes|required_if:format,hybrid|integer|min:2|max:64|even',
                ]);
            }

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'messages' => $validator->errors(),
                ], 422);
            }

            DB::transaction(function () use ($request, $championship) {
                // Don't allow updating created_by via API
                $data = $request->except(['created_by']);

                $championship->update($data);

                Log::info("Championship updated", [
                    'championship_id' => $championship->id,
                    'updated_fields' => array_keys($data),
                    'updated_by' => Auth::id(),
                ]);
            });

            // Return updated championship
            $championship->refresh();

            return response()->json([
                'message' => 'Championship updated successfully',
                'championship' => $championship,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to update this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship update failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
                'request_data' => $request->except(['created_by']),
            ]);

            return response()->json([
                'error' => 'Failed to update championship',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Archive championship (soft delete)
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);

            // Authorization check
            Gate::authorize('delete', $championship);

            // Check if championship can be archived
            if ($championship->getStatusEnum()->isActive()) {
                return response()->json([
                    'error' => 'Cannot archive active championship',
                    'message' => 'Please complete or pause the championship first',
                ], 400);
            }

            // Soft delete the championship
            $championship->deleted_by = Auth::id();
            $championship->save();
            $championship->delete(); // Soft delete

            Log::info("Championship archived", [
                'championship_id' => $championship->id,
                'title' => $championship->title,
                'archived_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Championship archived successfully',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to archive this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship archive failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to archive championship',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restore archived championship
     *
     * @param int $id
     * @return JsonResponse
     */
    public function restore(int $id): JsonResponse
    {
        try {
            $championship = Championship::onlyTrashed()->findOrFail($id);

            // Authorization check
            Gate::authorize('restore', $championship);

            // Restore the championship
            $championship->deleted_by = null;
            $championship->save();
            $championship->restore();

            Log::info("Championship restored", [
                'championship_id' => $championship->id,
                'title' => $championship->title,
                'restored_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Championship restored successfully',
                'championship' => $championship,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Archived championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to restore this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship restore failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to restore championship',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Permanently delete championship
     *
     * STRICT: Only allow if championship has zero participants
     *
     * @param int $id
     * @return JsonResponse
     */
    public function forceDelete(int $id): JsonResponse
    {
        try {
            // Find championship including trashed
            $championship = Championship::withTrashed()->findOrFail($id);

            // Authorization check - platform admins only
            Gate::authorize('forceDelete', $championship);

            // STRICT business rule validation
            if (!$championship->canBeDeleted()) {
                return response()->json([
                    'error' => 'Cannot permanently delete championship',
                    'message' => 'Championship has participants, matches, or payments. Only empty championships can be permanently deleted.',
                    'details' => [
                        'participant_count' => $championship->participants()->count(),
                        'match_count' => $championship->matches()->count(),
                        'status' => $championship->status,
                    ]
                ], 400);
            }

            DB::transaction(function () use ($championship) {
                $title = $championship->title;
                $championshipId = $championship->id;

                // Permanently delete related records
                $championship->matches()->forceDelete();
                $championship->standings()->forceDelete();
                $championship->participants()->forceDelete();

                // Permanently delete championship
                $championship->forceDelete();

                Log::warning("Championship permanently deleted", [
                    'championship_id' => $championshipId,
                    'title' => $title,
                    'deleted_by' => Auth::id(),
                ]);
            });

            return response()->json([
                'message' => 'Championship permanently deleted',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to permanently delete this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship permanent deletion failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to permanently delete championship',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship participants
     *
     * @param int $id
     * @return JsonResponse
     */
    public function participants(int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);

            $participants = ChampionshipParticipant::where('championship_id', $id)
                ->with('user:id,name,email,avatar_url,rating')
                ->paid() // Only paid participants
                ->orderBy('registered_at')
                ->get();

            return response()->json([
                'championship_id' => $id,
                'total_participants' => $participants->count(),
                'max_participants' => $championship->max_participants,
                'participants' => $participants,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Participants fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to fetch participants',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship matches
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function matches(int $id, Request $request): JsonResponse
    {
        try {
            Championship::findOrFail($id);

            $query = ChampionshipMatch::where('championship_id', $id)
                ->with([
                    'player1:id,name,email,avatar_url,rating',
                    'player2:id,name,email,avatar_url,rating',
                    'winner:id,name,email,avatar_url',
                    'game:id,status,result,pgn',
                ]);

            // Filter by round number
            if ($request->has('round')) {
                $query->forRound($request->input('round'));
            }

            // Filter by round type
            if ($request->has('round_type')) {
                $query->where('round_type', $request->input('round_type'));
            }

            // Order by round number and scheduled time
            $matches = $query->orderBy('round_number')
                ->orderBy('scheduled_at')
                ->get();

            return response()->json([
                'championship_id' => $id,
                'matches' => $matches,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Matches fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to fetch matches',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship standings
     *
     * @param int $id
     * @return JsonResponse
     */
    public function standings(int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);

            $standings = ChampionshipStanding::where('championship_id', $id)
                ->with('user:id,name,email,avatar_url,rating')
                ->ordered()
                ->get();

            // Get enhanced standings if Swiss tournament
            $summary = null;
            if ($championship->getFormatEnum()->isSwiss()) {
                $summary = $this->standingsCalculator->getStandingsSummary($championship);
            }

            return response()->json([
                'championship_id' => $id,
                'standings' => $standings,
                'summary' => $summary,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Standings fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to fetch standings',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get user's championship matches
     *
     * @param int $id
     * @return JsonResponse
     */
    public function myMatches(int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            \Log::info('🔍 myMatches API called', [
                'championship_id' => $id,
                'user_id' => $user?->id,
                'user_authenticated' => !is_null($user),
                'user_email' => $user?->email
            ]);

            if (!$user) {
                \Log::warning('❌ myMatches: No authenticated user');
                return response()->json([
                    'error' => 'Unauthorized',
                ], 401);
            }

            Championship::findOrFail($id);

            $matches = ChampionshipMatch::where('championship_id', $id)
                ->where(function ($query) use ($user) {
                    $query->where('player1_id', $user->id)
                        ->orWhere('player2_id', $user->id);
                })
                ->with([
                    'player1:id,name,email,avatar_url,rating',
                    'player2:id,name,email,avatar_url,rating',
                    'winner:id,name,email,avatar_url',
                    'game:id,status,result,pgn',
                ])
                ->orderBy('round_number')
                ->orderBy('scheduled_at')
                ->get();

            \Log::info('📊 myMatches results', [
                'championship_id' => $id,
                'user_id' => $user->id,
                'matches_found' => $matches->count(),
                'match_ids' => $matches->pluck('id')->toArray()
            ]);

            return response()->json([
                'championship_id' => $id,
                'matches' => $matches,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('User matches fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch your matches',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship statistics and summary
     *
     * @param int $id
     * @return JsonResponse
     */
    public function stats(int $id): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            \Log::info('🔍 Championship stats API called', [
                'championship_id' => $id,
                'user_id' => $user?->id,
                'user_authenticated' => !is_null($user),
                'user_email' => $user?->email
            ]);

            $championship = Championship::with([
                'participants.user',
                'matches'
            ])->findOrFail($id);

            // Get match statistics
            $matches = $championship->matches;
            $matchStats = [
                'pending' => $matches->where('status', 'pending')->count(),
                'active' => $matches->where('status', 'active')->count(),
                'completed' => $matches->where('status', 'completed')->count(),
                'cancelled' => $matches->where('status', 'cancelled')->count(),
                'total' => $matches->count()
            ];

            // Get round statistics
            $roundStats = $matches->groupBy('round_number')->map(function ($roundMatches, $roundNumber) {
                return [
                    'round' => (int)$roundNumber,
                    'matches' => [
                        'pending' => $roundMatches->where('status', 'pending')->count(),
                        'active' => $roundMatches->where('status', 'active')->count(),
                        'completed' => $roundMatches->where('status', 'completed')->count(),
                        'cancelled' => $roundMatches->where('status', 'cancelled')->count(),
                        'total' => $roundMatches->count()
                    ]
                ];
            })->sortBy('round')->values();

            // Calculate current round and completion status
            $currentRound = $matches->where('status', '!=', 'completed')->min('round_number') ?? 0;
            $totalRounds = $championship->total_rounds;
            $isComplete = $currentRound > $totalRounds || ($matchStats['pending'] === 0 && $matchStats['active'] === 0);

            // Get user-specific information if authenticated
            $userStatus = null;
            if ($user) {
                $participant = $championship->participants()->where('user_id', $user->id)->first();
                $userStatus = [
                    'is_registered' => !is_null($participant),
                    'has_paid' => $participant?->payment_status_id === PaymentStatus::Completed,
                    'can_register' => $championship->canRegister($user->id)
                ];
            }

            \Log::info('📊 Championship stats results', [
                'championship_id' => $id,
                'matches_total' => $matchStats['total'],
                'current_round' => $currentRound,
                'is_complete' => $isComplete
            ]);

            return response()->json([
                'championship' => $championship->load('status_relation', 'format_relation'),
                'summary' => [
                    'current_round' => $currentRound,
                    'total_rounds' => $totalRounds,
                    'is_complete' => $isComplete,
                    'matches' => $matchStats,
                    'can_schedule_next' => !$isComplete && $currentRound <= $totalRounds && $matchStats['completed'] > 0,
                    'next_round_number' => $currentRound + 1
                ],
                'rounds' => $roundStats,
                'user_status' => $userStatus
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Championship stats fetch failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
                'user_id' => Auth::guard('sanctum')->id(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch championship statistics',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Register user for championship (without payment)
     *
     * @param int $id
     * @return JsonResponse
     */
    public function register(int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You must be logged in to register for a championship'
                ], 401);
            }

            $championship = Championship::findOrFail($id);

            // Validate registration eligibility
            if (!$championship->canRegister($user->id)) {
                $reasons = [];

                if (!$championship->getStatusEnum()->isRegistrationOpen()) {
                    $reasons[] = 'Registration is not open for this championship';
                }

                if ($championship->isFull()) {
                    $reasons[] = 'Championship is full';
                }

                if ($championship->isUserRegistered($user->id)) {
                    $reasons[] = 'You are already registered for this championship';
                }

                if (!$championship->allow_public_registration && $championship->visibility !== 'public') {
                    $reasons[] = 'This championship does not allow public registration';
                }

                return response()->json([
                    'error' => 'Registration not allowed',
                    'message' => implode('. ', $reasons),
                ], 422);
            }

            // Only allow free registration through this endpoint
            if ($championship->entry_fee > 0) {
                return response()->json([
                    'error' => 'Payment required',
                    'message' => 'This championship requires an entry fee. Please use the payment registration endpoint.',
                    'entry_fee' => $championship->entry_fee,
                ], 422);
            }

            $participant = DB::transaction(function () use ($championship, $user) {
                // Double-check within transaction
                $existing = ChampionshipParticipant::where('championship_id', $championship->id)
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    throw new \Exception('You are already registered for this championship');
                }

                return ChampionshipParticipant::create([
                    'championship_id' => $championship->id,
                    'user_id' => $user->id,
                    'amount_paid' => 0,
                    'payment_status' => PaymentStatus::COMPLETED->value,
                    'registered_at' => now(),
                ]);
            });

            Log::info('User registered for championship', [
                'championship_id' => $championship->id,
                'championship_title' => $championship->title,
                'user_id' => $user->id,
                'user_email' => $user->email,
                'participant_id' => $participant->id,
                'registration_type' => 'free',
            ]);

            return response()->json([
                'message' => 'Registration successful',
                'participant_id' => $participant->id,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'entry_fee' => $championship->entry_fee,
                ],
                'participation' => [
                    'id' => $participant->id,
                    'registered_at' => $participant->registered_at,
                    'payment_status' => $participant->payment_status,
                    'amount_paid' => $participant->amount_paid,
                ],
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
              } catch (\Exception $e) {
            Log::error('Championship registration failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
                'user_id' => Auth::id(),
            ]);

            // Check if it's a duplicate registration error
            if (str_contains($e->getMessage(), 'already registered')) {
                return response()->json([
                    'error' => 'Already Registered',
                    'message' => 'You are already registered for this championship. Check your "My Matches" for details.',
                    'code' => 'ALREADY_REGISTERED'
                ], 409); // 409 Conflict
            }

            return response()->json([
                'error' => 'Registration failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Register user for championship with payment
     * This is an alias to the payment initiation endpoint
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function registerWithPayment(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You must be logged in to register for a championship'
                ], 401);
            }

            $championship = Championship::findOrFail($id);

            // Validate registration eligibility
            if (!$championship->canRegister($user->id)) {
                $reasons = [];

                if (!$championship->getStatusEnum()->isRegistrationOpen()) {
                    $reasons[] = 'Registration is not open for this championship';
                }

                if ($championship->isFull()) {
                    $reasons[] = 'Championship is full';
                }

                if ($championship->isUserRegistered($user->id)) {
                    $reasons[] = 'You are already registered for this championship';
                }

                if (!$championship->allow_public_registration && $championship->visibility !== 'public') {
                    $reasons[] = 'This championship does not allow public registration';
                }

                return response()->json([
                    'error' => 'Registration not allowed',
                    'message' => implode('. ', $reasons),
                ], 422);
            }

            // For free championships, redirect to simple registration
            if ($championship->entry_fee == 0) {
                return $this->register($id);
            }

            // Create participant record with pending payment
            $participant = DB::transaction(function () use ($championship, $user) {
                // Double-check within transaction
                $existing = ChampionshipParticipant::where('championship_id', $championship->id)
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    throw new \Exception('You are already registered for this championship');
                }

                return ChampionshipParticipant::create([
                    'championship_id' => $championship->id,
                    'user_id' => $user->id,
                    'amount_paid' => $championship->entry_fee,
                    'payment_status' => PaymentStatus::PENDING->value,
                    'registered_at' => now(),
                ]);
            });

            // Use RazorpayService to create payment order
            $razorpayService = app(\App\Services\RazorpayService::class);
            $orderDetails = $razorpayService->createOrder(
                $championship->entry_fee,
                $championship->id,
                $user->id
            );

            // Update participant with order ID
            $participant->update([
                'razorpay_order_id' => $orderDetails['order_id'],
            ]);

            Log::info('User initiated payment for championship registration', [
                'championship_id' => $championship->id,
                'championship_title' => $championship->title,
                'user_id' => $user->id,
                'user_email' => $user->email,
                'participant_id' => $participant->id,
                'order_id' => $orderDetails['order_id'],
                'amount' => $championship->entry_fee,
            ]);

            return response()->json([
                'message' => 'Payment order created successfully',
                'participant_id' => $participant->id,
                'payment_required' => true,
                'order_details' => $orderDetails,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'entry_fee' => $championship->entry_fee,
                ],
                'participation' => [
                    'id' => $participant->id,
                    'registered_at' => $participant->registered_at,
                    'payment_status' => $participant->payment_status,
                    'amount_paid' => $participant->amount_paid,
                ],
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
              } catch (\Exception $e) {
            Log::error('Championship payment registration failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
                'user_id' => Auth::id(),
            ]);

            // Check if it's a duplicate registration error
            if (str_contains($e->getMessage(), 'already registered')) {
                return response()->json([
                    'error' => 'Already Registered',
                    'message' => 'You are already registered for this championship. Check your "My Matches" for details.',
                    'code' => 'ALREADY_REGISTERED'
                ], 409); // 409 Conflict
            }

            return response()->json([
                'error' => 'Registration failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship instructions for participants
     *
     * @param int $id
     * @return JsonResponse
     */
    public function getInstructions(int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);

            // Default instructions if none provided
            $defaultSchedulingInstructions = "
                <h3>Match Scheduling Rules</h3>
                <ul>
                    <li><strong>Communication is Key:</strong> Always coordinate with your opponent through the scheduling system.</li>
                    <li><strong>Be Responsive:</strong> Respond to schedule proposals within 24 hours.</li>
                    <li><strong>No Declining:</strong> You cannot decline a schedule proposal - you must either accept or propose an alternative time.</li>
                    <li><strong>Play When Available:</strong> If your opponent is online, you can start the game immediately.</li>
                    <li><strong>Grace Period:</strong> A 10-minute grace period is granted for scheduled matches. Be present or risk forfeit.</li>
                    <li><strong>Deadlines Matter:</strong> All matches must be completed before the round deadline.</li>
                </ul>
            ";

            $defaultPlayInstructions = "
                <h3>Game Play Rules</h3>
                <ul>
                    <li><strong>Standard Chess Rules:</strong> All games follow FIDE chess rules.</li>
                    <li><strong>Draw Conditions:</strong> Draws are automatically detected for: stalemate, insufficient material, 50-move rule, threefold repetition, and 16 consecutive queen moves.</li>
                    <li><strong>No Abandoning:</strong> Leaving a game without proper resignation may result in forfeit.</li>
                    <li><strong>Sportsmanship:</strong> Be respectful to your opponent at all times.</li>
                    <li><strong>Technical Issues:</strong> If you experience connection problems, try to reconnect. The system has built-in protections for brief disconnections.</li>
                </ul>
            ";

            return response()->json([
                'success' => true,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'scheduling_instructions' => $championship->scheduling_instructions ?: $defaultSchedulingInstructions,
                    'play_instructions' => $championship->play_instructions ?: $defaultPlayInstructions,
                    'allow_early_play' => $championship->allow_early_play ?? true,
                    'default_grace_period_minutes' => $championship->default_grace_period_minutes ?? 10,
                    'require_confirmation' => $championship->require_confirmation ?? true,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get championship instructions', [
                'championship_id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve championship instructions'
            ], 500);
        }
    }
}
