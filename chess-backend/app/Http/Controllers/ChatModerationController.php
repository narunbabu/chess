<?php

namespace App\Http\Controllers;

use App\Models\ChatMessageReport;
use App\Models\Game;
use App\Models\GameChatMessage;
use App\Models\Organization;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\ChatSafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChatModerationController extends Controller
{
    public function reportMessage(Request $request, int $gameId, int $messageId): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', Rule::in(ChatSafetyService::REPORT_REASONS)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        $game = Game::findOrFail($gameId);

        if (!$this->isGameParticipant($game, $user)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $message = GameChatMessage::where('game_id', $gameId)->findOrFail($messageId);
        if ($message->user_id === $user->id) {
            return response()->json(['error' => 'You cannot report your own message'], 422);
        }

        $report = ChatMessageReport::firstOrNew([
            'game_chat_message_id' => $message->id,
            'reporter_id' => $user->id,
        ]);

        if (!$report->exists || $report->status === 'pending') {
            $report->fill([
                'game_id' => $game->id,
                'reported_user_id' => $message->user_id,
                'reason' => $data['reason'],
                'note' => $data['note'] ?? null,
                'status' => 'pending',
            ]);
            $report->save();
        }

        return response()->json([
            'message' => 'Report submitted',
            'report' => $report->load(['message:id,message,filtered', 'reportedUser:id,name']),
        ], $report->wasRecentlyCreated ? 201 : 200);
    }

    public function blockUser(Request $request, int $userId): JsonResponse
    {
        $user = $request->user();
        $blockedUser = User::findOrFail($userId);

        if ($blockedUser->id === $user->id) {
            return response()->json(['error' => 'You cannot block yourself'], 422);
        }

        $block = UserBlock::firstOrCreate([
            'blocker_id' => $user->id,
            'blocked_user_id' => $blockedUser->id,
        ]);

        return response()->json([
            'message' => 'User blocked',
            'block' => $block,
        ], $block->wasRecentlyCreated ? 201 : 200);
    }

    public function unblockUser(Request $request, int $userId): JsonResponse
    {
        $user = $request->user();

        UserBlock::where('blocker_id', $user->id)
            ->where('blocked_user_id', $userId)
            ->delete();

        return response()->json(['message' => 'User unblocked']);
    }

    public function indexReports(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['pending', 'reviewed', 'dismissed', 'actioned'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = ChatMessageReport::query()
            ->with([
                'message:id,game_id,user_id,message,original_message,message_type,safety_action,filtered,created_at',
                'game:id,white_player_id,black_player_id',
                'reporter:id,name,email,organization_id',
                'reportedUser:id,name,email,organization_id,social_access_disabled',
                'reviewer:id,name,email',
            ])
            ->latest();

        if (!empty($data['status'])) {
            $query->where('status', $data['status']);
        } else {
            $query->where('status', 'pending');
        }

        $this->scopeReportsForModerator($query, $request->user());

        return response()->json($query->paginate($data['per_page'] ?? 20));
    }

    public function updateReport(Request $request, ChatMessageReport $report): JsonResponse
    {
        if (!$this->canModerateReport($request->user(), $report)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(['pending', 'reviewed', 'dismissed', 'actioned'])],
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $report->update([
            'status' => $data['status'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'resolution_note' => $data['resolution_note'] ?? null,
        ]);

        return response()->json([
            'message' => 'Report updated',
            'report' => $report->fresh()->load([
                'message:id,message,filtered',
                'reporter:id,name,email,organization_id',
                'reportedUser:id,name,email,organization_id,social_access_disabled',
                'reviewer:id,name,email',
            ]),
        ]);
    }

    public function setUserSocialAccess(Request $request, User $user): JsonResponse
    {
        if (!$this->canModerateUser($request->user(), $user)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'disabled' => ['required', 'boolean'],
        ]);

        $disabled = (bool) $data['disabled'];
        $user->forceFill([
            'social_access_disabled' => $disabled,
            'social_access_disabled_at' => $disabled ? now() : null,
        ])->save();

        return response()->json([
            'message' => $disabled ? 'User chat disabled' : 'User chat enabled',
            'user' => $user->fresh(['organization:id,name,social_access_disabled']),
        ]);
    }

    public function setOrganizationSocialAccess(Request $request, Organization $organization): JsonResponse
    {
        if (!$this->canModerateOrganization($request->user(), $organization)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'disabled' => ['required', 'boolean'],
        ]);

        $disabled = (bool) $data['disabled'];
        $organization->update([
            'social_access_disabled' => $disabled,
            'social_access_disabled_at' => $disabled ? now() : null,
        ]);

        return response()->json([
            'message' => $disabled ? 'Organization chat disabled' : 'Organization chat enabled',
            'organization' => $organization->fresh(),
        ]);
    }

    private function isGameParticipant(Game $game, User $user): bool
    {
        return $game->white_player_id === $user->id || $game->black_player_id === $user->id;
    }

    private function isPlatformModerator(User $user): bool
    {
        return $user->email === 'ab@ameyem.com' || $user->hasRole('platform_admin');
    }

    private function scopeReportsForModerator($query, User $moderator): void
    {
        if ($this->isPlatformModerator($moderator)) {
            return;
        }

        $orgId = $moderator->organization_id;
        if ($orgId === null) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->where(function ($reportQuery) use ($orgId) {
            $reportQuery->whereHas('reporter', fn($userQuery) => $userQuery->where('organization_id', $orgId))
                ->orWhereHas('reportedUser', fn($userQuery) => $userQuery->where('organization_id', $orgId));
        });
    }

    private function canModerateReport(User $moderator, ChatMessageReport $report): bool
    {
        if ($this->isPlatformModerator($moderator)) {
            return true;
        }

        $report->loadMissing(['reporter:id,organization_id', 'reportedUser:id,organization_id']);

        return $moderator->organization_id !== null
            && (
                $report->reporter?->organization_id === $moderator->organization_id
                || $report->reportedUser?->organization_id === $moderator->organization_id
            );
    }

    private function canModerateUser(User $moderator, User $target): bool
    {
        if ($this->isPlatformModerator($moderator)) {
            return true;
        }

        return $moderator->organization_id !== null
            && $target->organization_id === $moderator->organization_id;
    }

    private function canModerateOrganization(User $moderator, Organization $organization): bool
    {
        if ($this->isPlatformModerator($moderator)) {
            return true;
        }

        return $moderator->organization_id === $organization->id
            && $moderator->hasRole('organization_admin');
    }
}
