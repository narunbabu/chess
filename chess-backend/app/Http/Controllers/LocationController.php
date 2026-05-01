<?php

namespace App\Http\Controllers;

use App\Models\PlaceRelated\District;
use App\Models\PlaceRelated\Mandal;
use App\Models\PlaceRelated\State;
use App\Models\PlaceRelated\Village;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function states(): JsonResponse
    {
        return response()->json(
            State::select('id', 'name', 'initial')->orderBy('name')->get()
        );
    }

    public function districts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'state_id' => ['required', 'integer', 'exists:states,id'],
        ]);

        return response()->json(
            District::select('id', 'name', 'state_id')
                ->where('state_id', $validated['state_id'])
                ->orderBy('name')
                ->get()
        );
    }

    public function mandals(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'district_id' => ['required', 'integer', 'exists:districts,id'],
        ]);

        return response()->json(
            Mandal::select('id', 'name', 'district_id')
                ->where('district_id', $validated['district_id'])
                ->orderBy('name')
                ->get()
        );
    }

    public function villages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mandal_id' => ['required', 'integer', 'exists:mandals,id'],
        ]);

        return response()->json(
            Village::select('id', 'name', 'mandal_id')
                ->where('mandal_id', $validated['mandal_id'])
                ->orderBy('name')
                ->get()
        );
    }
}
