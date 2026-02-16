<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use App\Models\Game;
use App\Observers\GameObserver;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Log::info('=== APPLICATION STARTUP ===');
        Log::info('Environment: ' . app()->environment());
        Log::info('Debug mode: ' . (config('app.debug') ? 'ON' : 'OFF'));
        Log::info('Database connection: ' . config('database.default'));

        try {
            // Test database connection
            DB::connection()->getPdo();
            Log::info('Database connection: SUCCESS');
        } catch (\Exception $e) {
            Log::error('Database connection: FAILED - ' . $e->getMessage());
        }

        Log::info('=== APPLICATION READY ===');

        // Register model observers
        Game::observe(GameObserver::class);

        // Register custom validation rules
        $this->registerCustomValidationRules();

        // Register authorization gates
        $this->registerAuthorizationGates();
    }

    /**
     * Register custom validation rules
     */
    protected function registerCustomValidationRules(): void
    {
        // Validate that a value is an even number
        Validator::extend('even', function ($attribute, $value, $parameters, $validator) {
            return is_numeric($value) && $value % 2 === 0;
        });

        // Validate that a value is a power of two
        Validator::extend('power_of_two', function ($attribute, $value, $parameters, $validator) {
            if (!is_numeric($value) || $value <= 0) {
                return false;
            }
            // A number is a power of 2 if it has only one bit set
            // Example: 2 (10), 4 (100), 8 (1000), 16 (10000)
            return ($value & ($value - 1)) === 0;
        });

        // Custom error messages
        Validator::replacer('even', function ($message, $attribute, $rule, $parameters) {
            return str_replace(':attribute', $attribute, 'The :attribute must be an even number.');
        });

        Validator::replacer('power_of_two', function ($message, $attribute, $rule, $parameters) {
            return str_replace(':attribute', $attribute, 'The :attribute must be a power of 2 (2, 4, 8, 16, 32, 64).');
        });
    }

    /**
     * Register authorization gates
     */
    protected function registerAuthorizationGates(): void
    {
        // Platform Management Gates
        Gate::define('manage-platform', function ($user) {
            return $user->hasPermission('manage_platform');
        });

        Gate::define('manage-users', function ($user) {
            return $user->hasPermission('manage_users');
        });

        Gate::define('manage-roles', function ($user) {
            return $user->hasPermission('manage_roles');
        });

        Gate::define('view-analytics', function ($user) {
            return $user->hasPermission('view_analytics');
        });

        // Championship Gates
        Gate::define('create-championship', function ($user) {
            return $user->hasPermission('create_championship');
        });

        Gate::define('manage-championship-participants', function ($user) {
            return $user->hasPermission('manage_championship_participants');
        });

        Gate::define('set-match-results', function ($user) {
            return $user->hasPermission('set_match_results');
        });

        // Organization Gates
        Gate::define('create-organization', function ($user) {
            return $user->hasPermission('create_organization');
        });

        Gate::define('manage-organization', function ($user) {
            return $user->hasPermission('manage_organization');
        });

        // Game Management Gates
        Gate::define('view-all-games', function ($user) {
            return $user->hasPermission('view_all_games');
        });

        Gate::define('pause-games', function ($user) {
            return $user->hasPermission('pause_games');
        });

        Gate::define('adjudicate-disputes', function ($user) {
            return $user->hasPermission('adjudicate_disputes');
        });

        // Payment Gates
        Gate::define('process-payments', function ($user) {
            return $user->hasPermission('process_payments');
        });

        Gate::define('issue-refunds', function ($user) {
            return $user->hasPermission('issue_refunds');
        });

        // Tournament Administration Gates
        Gate::define('manageTournaments', function ($user) {
            // Platform managers and above can manage tournaments
            return $user->hasRole('platform_admin') ||
                   $user->hasRole('platform_manager') ||
                   $user->hasPermission('manage_tournaments');
        });

        // Subscription Gates
        Gate::define('access-premium', function ($user) {
            return $user->hasSubscriptionTier('premium');
        });

        Gate::define('access-pro', function ($user) {
            return $user->hasSubscriptionTier('pro');
        });

        Gate::define('create-tournament', function ($user) {
            return $user->hasSubscriptionTier('pro') || $user->hasPermission('create_championship');
        });

        Gate::define('access-analytics', function ($user) {
            return $user->hasSubscriptionTier('pro');
        });

        Gate::define('access-synthetic-opponents', function ($user) {
            return $user->hasSubscriptionTier('pro');
        });

        // Super Admin Gate (bypass all checks)
        Gate::before(function ($user, $ability) {
            if ($user->hasRole('platform_admin')) {
                return true; // Platform admins can do anything
            }
        });
    }
}
