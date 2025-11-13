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
            ]);

            // Temporarily bypass visibility scope for debugging
            $query = Championship::query();
            // $query = Championship::visibleTo($user);

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

            $userId = $user?->id;
            $isRegistered = false;
            $hasPaid = false;

            if ($userId) {
                $isRegistered = $championship->isUserRegistered($userId);
                $hasPaid = $championship->hasUserPaid($userId);
            }

            // Get additional tournament information
            $summary = $this->scheduler->getSchedulingSummary($championship);

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
     * Delete championship
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

            // Check if championship can be deleted
            if ($championship->getStatusEnum()->isActive()) {
                return response()->json([
                    'error' => 'Cannot delete active championship',
                    'message' => 'Please complete or pause the championship first',
                ], 400);
            }

            if ($championship->participants()->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())->exists()) {
                return response()->json([
                    'error' => 'Cannot delete championship with paid participants',
                    'message' => 'Please refund all participants before deletion',
                ], 400);
            }

            DB::transaction(function () use ($championship) {
                $title = $championship->title;
                $championshipId = $championship->id;

                // Delete related records
                $championship->matches()->delete();
                $championship->standings()->delete();
                $championship->participants()->delete();
                $championship->delete();

                Log::info("Championship deleted", [
                    'championship_id' => $championshipId,
                    'title' => $title,
                    'deleted_by' => Auth::id(),
                ]);
            });

            return response()->json([
                'message' => 'Championship deleted successfully',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Championship not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'You do not have permission to delete this championship',
            ], 403);
        } catch (\Exception $e) {
            Log::error('Championship deletion failed', [
                'error' => $e->getMessage(),
                'championship_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to delete championship',
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

            if (!$user) {
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
}
