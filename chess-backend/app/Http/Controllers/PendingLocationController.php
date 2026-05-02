<?php

namespace App\Http\Controllers;

use App\Models\PendingLocation;
use App\Models\PlaceRelated\Country;
use App\Models\PlaceRelated\District;
use App\Models\PlaceRelated\Mandal;
use App\Models\PlaceRelated\State;
use App\Models\PlaceRelated\Village;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PendingLocationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $locations = PendingLocation::query()
            ->where('status', PendingLocation::STATUS_PENDING)
            ->with([
                'requester:id,name,email',
                'country:id,name',
                'state:id,name',
                'district:id,name',
                'mandal:id,name',
            ])
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json($locations);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        try {
            $pending = PendingLocation::where('status', PendingLocation::STATUS_PENDING)->findOrFail($id);

            DB::beginTransaction();

            $place = $this->findOrCreatePlace($pending);
            $this->backfillMatchingUsers($pending, $place->id);

            $pending->update([
                'status' => PendingLocation::STATUS_APPROVED,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'created_place_id' => $place->id,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Location approved successfully',
                'pending_location' => $pending->fresh()->load('requester:id,name,email'),
                'created_place' => $place,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Pending location not found'], 404);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Pending location approval failed', [
                'pending_location_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to approve location',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        try {
            $pending = PendingLocation::where('status', PendingLocation::STATUS_PENDING)->findOrFail($id);

            $pending->update([
                'status' => PendingLocation::STATUS_REJECTED,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'reject_reason' => $validated['reason'] ?? null,
            ]);

            return response()->json([
                'message' => 'Location request rejected',
                'pending_location' => $pending->fresh()->load('requester:id,name,email'),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Pending location not found'], 404);
        }
    }

    private function findOrCreatePlace(PendingLocation $pending)
    {
        return match ($pending->level) {
            'country' => Country::firstOrCreate(
                ['name' => $pending->name],
                ['initial' => strtoupper(substr($pending->name, 0, 2))]
            ),
            'state' => State::firstOrCreate(
                ['name' => $pending->name, 'country_id' => $pending->country_id],
                ['initial' => strtoupper(substr($pending->name, 0, 2))]
            ),
            'district' => District::firstOrCreate([
                'name' => $pending->name,
                'state_id' => $pending->state_id,
            ]),
            'mandal' => Mandal::firstOrCreate([
                'name' => $pending->name,
                'district_id' => $pending->district_id,
            ]),
            'village' => Village::firstOrCreate([
                'name' => $pending->name,
                'mandal_id' => $pending->mandal_id,
            ]),
            default => throw new \InvalidArgumentException("Unsupported location level {$pending->level}"),
        };
    }

    private function backfillMatchingUsers(PendingLocation $pending, int $placeId): void
    {
        $query = \App\Models\User::query()
            ->where('location_other', $pending->name)
            ->where('location_country_id', $pending->country_id)
            ->where('location_state_id', $pending->state_id)
            ->where('location_district_id', $pending->district_id)
            ->where('location_mandal_id', $pending->mandal_id);

        $updates = ['location_other' => null];

        match ($pending->level) {
            'country' => $updates += ['location_country_id' => $placeId],
            'state' => $updates += ['location_state_id' => $placeId],
            'district' => $updates += ['location_district_id' => $placeId],
            'mandal' => $updates += ['location_mandal_id' => $placeId],
            'village' => $updates += ['location_village_id' => $placeId],
            default => null,
        };

        $query->update($updates);
    }
}
