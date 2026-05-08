<?php

namespace App\Services;

use App\Enums\SubscriptionTier;
use App\Models\Game;
use App\Models\User;

class EntitlementService
{
    public const CAP_PLAY_COMPUTER_UNLIMITED = 'play.computer.unlimited';
    public const CAP_PLAY_ONLINE_UNLIMITED = 'play.online.unlimited';
    public const CAP_PLAY_ONLINE_DAILY_LIMIT = 'play.online.daily_limit';
    public const CAP_TOURNAMENT_PUBLIC_JOIN = 'tournament.public.join';
    public const CAP_TOURNAMENT_SCHOOL_JOIN = 'tournament.school.join';
    public const CAP_TOURNAMENT_CREATE = 'tournament.create';
    public const CAP_LESSON_TRACK_NEWCOMER = 'lesson.track.newcomer';
    public const CAP_LESSON_TRACK_BEGINNER = 'lesson.track.beginner';
    public const CAP_LESSON_TRACK_CLUB = 'lesson.track.club';
    public const CAP_LESSON_TRACK_ADVANCED = 'lesson.track.advanced';
    public const CAP_TRAINING_DRILLS_FREE = 'training.drills.free';
    public const CAP_TRAINING_DRILLS_SILVER = 'training.drills.silver';
    public const CAP_TRAINING_DRILLS_GOLD = 'training.drills.gold';
    public const CAP_TACTICAL_STAGE_0 = 'tactical.stage.0';
    public const CAP_TACTICAL_STAGE_1 = 'tactical.stage.1';
    public const CAP_TACTICAL_STAGE_2 = 'tactical.stage.2';
    public const CAP_TACTICAL_STAGE_3 = 'tactical.stage.3';
    public const CAP_TACTICAL_STAGE_4 = 'tactical.stage.4';
    public const CAP_DAILY_STARTER = 'daily.starter';
    public const CAP_DAILY_IMPROVEMENT = 'daily.improvement';
    public const CAP_DAILY_ENDGAME = 'daily.endgame';
    public const CAP_DAILY_MASTER = 'daily.master';
    public const CAP_ANALYSIS_BASIC = 'analysis.basic';
    public const CAP_ANALYSIS_ENGINE = 'analysis.engine';
    public const CAP_ANALYSIS_OPENING_EXPLORER = 'analysis.opening_explorer';
    public const CAP_REPORT_PARENT_WEEKLY = 'report.parent.weekly';
    public const CAP_SCHOOL_DASHBOARD = 'school.dashboard';
    public const CAP_SCHOOL_ASSIGNMENT_MANAGE = 'school.assignment.manage';
    public const CAP_SCHOOL_CERTIFICATE_ISSUE = 'school.certificate.issue';
    public const CAP_SCHOOL_TOURNAMENT_MANAGE = 'school.tournament.manage';
    public const CAP_CHILD_SAFE_MODE_MANAGE = 'child.safe_mode.manage';

    /**
     * Personal subscription features. School/event grants will layer on top of
     * this service in the next implementation slice.
     */
    private const TIER_CAPABILITIES = [
        'free' => [
            self::CAP_PLAY_COMPUTER_UNLIMITED,
            self::CAP_PLAY_ONLINE_DAILY_LIMIT,
            self::CAP_TOURNAMENT_PUBLIC_JOIN,
            self::CAP_LESSON_TRACK_NEWCOMER,
            self::CAP_LESSON_TRACK_BEGINNER,
            self::CAP_TRAINING_DRILLS_FREE,
            self::CAP_TACTICAL_STAGE_0,
            self::CAP_DAILY_STARTER,
            self::CAP_ANALYSIS_BASIC,
        ],
        'silver' => [
            self::CAP_PLAY_COMPUTER_UNLIMITED,
            self::CAP_PLAY_ONLINE_UNLIMITED,
            self::CAP_PLAY_ONLINE_DAILY_LIMIT,
            self::CAP_TOURNAMENT_PUBLIC_JOIN,
            self::CAP_TOURNAMENT_SCHOOL_JOIN,
            self::CAP_LESSON_TRACK_NEWCOMER,
            self::CAP_LESSON_TRACK_BEGINNER,
            self::CAP_LESSON_TRACK_CLUB,
            self::CAP_TRAINING_DRILLS_FREE,
            self::CAP_TRAINING_DRILLS_SILVER,
            self::CAP_TACTICAL_STAGE_0,
            self::CAP_TACTICAL_STAGE_1,
            self::CAP_TACTICAL_STAGE_2,
            self::CAP_DAILY_STARTER,
            self::CAP_DAILY_IMPROVEMENT,
            self::CAP_DAILY_ENDGAME,
            self::CAP_ANALYSIS_BASIC,
            self::CAP_REPORT_PARENT_WEEKLY,
        ],
        'gold' => [
            self::CAP_PLAY_COMPUTER_UNLIMITED,
            self::CAP_PLAY_ONLINE_UNLIMITED,
            self::CAP_PLAY_ONLINE_DAILY_LIMIT,
            self::CAP_TOURNAMENT_PUBLIC_JOIN,
            self::CAP_TOURNAMENT_SCHOOL_JOIN,
            self::CAP_TOURNAMENT_CREATE,
            self::CAP_LESSON_TRACK_NEWCOMER,
            self::CAP_LESSON_TRACK_BEGINNER,
            self::CAP_LESSON_TRACK_CLUB,
            self::CAP_LESSON_TRACK_ADVANCED,
            self::CAP_TRAINING_DRILLS_FREE,
            self::CAP_TRAINING_DRILLS_SILVER,
            self::CAP_TRAINING_DRILLS_GOLD,
            self::CAP_TACTICAL_STAGE_0,
            self::CAP_TACTICAL_STAGE_1,
            self::CAP_TACTICAL_STAGE_2,
            self::CAP_TACTICAL_STAGE_3,
            self::CAP_TACTICAL_STAGE_4,
            self::CAP_DAILY_STARTER,
            self::CAP_DAILY_IMPROVEMENT,
            self::CAP_DAILY_ENDGAME,
            self::CAP_DAILY_MASTER,
            self::CAP_ANALYSIS_BASIC,
            self::CAP_ANALYSIS_ENGINE,
            self::CAP_ANALYSIS_OPENING_EXPLORER,
            self::CAP_REPORT_PARENT_WEEKLY,
        ],
    ];

    private const ALL_CAPABILITIES = [
        self::CAP_PLAY_COMPUTER_UNLIMITED,
        self::CAP_PLAY_ONLINE_UNLIMITED,
        self::CAP_PLAY_ONLINE_DAILY_LIMIT,
        self::CAP_TOURNAMENT_PUBLIC_JOIN,
        self::CAP_TOURNAMENT_SCHOOL_JOIN,
        self::CAP_TOURNAMENT_CREATE,
        self::CAP_LESSON_TRACK_NEWCOMER,
        self::CAP_LESSON_TRACK_BEGINNER,
        self::CAP_LESSON_TRACK_CLUB,
        self::CAP_LESSON_TRACK_ADVANCED,
        self::CAP_TRAINING_DRILLS_FREE,
        self::CAP_TRAINING_DRILLS_SILVER,
        self::CAP_TRAINING_DRILLS_GOLD,
        self::CAP_TACTICAL_STAGE_0,
        self::CAP_TACTICAL_STAGE_1,
        self::CAP_TACTICAL_STAGE_2,
        self::CAP_TACTICAL_STAGE_3,
        self::CAP_TACTICAL_STAGE_4,
        self::CAP_DAILY_STARTER,
        self::CAP_DAILY_IMPROVEMENT,
        self::CAP_DAILY_ENDGAME,
        self::CAP_DAILY_MASTER,
        self::CAP_ANALYSIS_BASIC,
        self::CAP_ANALYSIS_ENGINE,
        self::CAP_ANALYSIS_OPENING_EXPLORER,
        self::CAP_REPORT_PARENT_WEEKLY,
        self::CAP_SCHOOL_DASHBOARD,
        self::CAP_SCHOOL_ASSIGNMENT_MANAGE,
        self::CAP_SCHOOL_CERTIFICATE_ISSUE,
        self::CAP_SCHOOL_TOURNAMENT_MANAGE,
        self::CAP_CHILD_SAFE_MODE_MANAGE,
    ];

    public function effectiveTier(User $user): SubscriptionTier
    {
        if ($user->hasSubscriptionTier(SubscriptionTier::GOLD)) {
            return SubscriptionTier::GOLD;
        }

        if ($user->hasSubscriptionTier(SubscriptionTier::SILVER)) {
            return SubscriptionTier::SILVER;
        }

        return SubscriptionTier::FREE;
    }

    public function can(User $user, string $capability, array $context = []): bool
    {
        $tier = $this->effectiveTier($user)->value;
        $capabilities = self::TIER_CAPABILITIES[$tier] ?? self::TIER_CAPABILITIES['free'];

        if (in_array($capability, $capabilities, true)) {
            return true;
        }

        return match ($capability) {
            self::CAP_SCHOOL_DASHBOARD,
            self::CAP_SCHOOL_ASSIGNMENT_MANAGE,
            self::CAP_SCHOOL_CERTIFICATE_ISSUE,
            self::CAP_CHILD_SAFE_MODE_MANAGE => $user->hasRole(['platform_admin', 'organization_admin']),

            self::CAP_SCHOOL_TOURNAMENT_MANAGE => $user->hasRole([
                'platform_admin',
                'organization_admin',
                'tournament_organizer',
            ]),

            default => false,
        };
    }

    public function onlineGameQuota(User $user): array
    {
        $tier = $this->effectiveTier($user)->value;
        $todayCount = Game::dailyOnlineGameCountForUser($user->id);

        if ($this->can($user, self::CAP_PLAY_ONLINE_UNLIMITED)) {
            return [
                'tier' => $tier,
                'unlimited' => true,
                'daily_limit' => null,
                'games_today' => $todayCount,
                'remaining' => null,
            ];
        }

        $dailyLimit = 5;

        return [
            'tier' => $tier,
            'unlimited' => false,
            'daily_limit' => $dailyLimit,
            'games_today' => $todayCount,
            'remaining' => max(0, $dailyLimit - $todayCount),
        ];
    }

    public function limits(User $user): array
    {
        return [
            'online_games' => $this->onlineGameQuota($user),
        ];
    }

    public function summary(User $user): array
    {
        $effectiveTier = $this->effectiveTier($user);
        $capabilities = [];

        foreach (self::ALL_CAPABILITIES as $capability) {
            $capabilities[$capability] = $this->can($user, $capability);
        }

        return [
            'user_id' => $user->id,
            'personal_tier' => $user->subscription_tier ?? SubscriptionTier::FREE->value,
            'effective_tier' => $effectiveTier->value,
            'effective_tier_label' => $effectiveTier->label(),
            'active_subscription' => $user->hasActiveSubscription(),
            'subscription_expires_at' => optional($user->subscription_expires_at)->toISOString(),
            'subscription_days_remaining' => $user->subscriptionDaysRemaining(),
            'capabilities' => $capabilities,
            'limits' => $this->limits($user),
            'school' => [
                'organization_id' => $user->organization_id,
                'has_school_pass' => false,
                'program' => null,
                'note' => 'School Pass grants will be layered on top of personal tiers in the next slice.',
            ],
        ];
    }
}
