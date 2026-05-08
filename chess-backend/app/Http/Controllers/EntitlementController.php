<?php

namespace App\Http\Controllers;

use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntitlementController extends Controller
{
    public function __construct(
        protected EntitlementService $entitlements
    ) {}

    /**
     * GET /api/entitlements/me
     * GET /api/v1/entitlements/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->entitlements->summary($request->user()),
        ]);
    }
}
