<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Laravel\Socialite\Facades\Socialite;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SocialAuthController extends Controller
{
    public function redirect($provider)
    {
        Log::info('=== OAUTH REDIRECT REQUEST ===');
        Log::info('Provider: ' . $provider);
        Log::info('Request URL: ' . request()->fullUrl());
        Log::info('Request IP: ' . request()->ip());
        Log::info('User Agent: ' . request()->userAgent());

        // Get the Socialite driver configuration
        $driver = Socialite::driver($provider);

        // Log the redirect URI that will be sent to Google
        $redirectUrl = config('services.google.redirect');
        Log::info('Configured redirect URI: ' . $redirectUrl);
        Log::info('App URL: ' . config('app.url'));
        Log::info('Frontend URL: ' . config('app.frontend_url'));

        Log::info('=== REDIRECTING TO GOOGLE ===');

        return $driver->redirect();
    }

    public function callback($provider)
    {
        Log::info('=== OAUTH CALLBACK RECEIVED ===');
        Log::info('Provider: ' . $provider);
        Log::info('Request URL: ' . request()->fullUrl());
        Log::info('Request Method: ' . request()->method());
        Log::info('Request IP: ' . request()->ip());
        Log::info('User Agent: ' . request()->userAgent());

        // Log all request parameters
        Log::info('Query Parameters: ', request()->query());
        Log::info('All Input: ', request()->all());

        // Log the callback URL that Google used to reach us
        $currentUrl = request()->url();
        $currentFullUrl = request()->fullUrl();
        Log::info('Current callback URL: ' . $currentUrl);
        Log::info('Current full URL (with params): ' . $currentFullUrl);

        // Log what we have configured vs what was received
        $configuredRedirect = config('services.google.redirect');
        Log::info('Configured redirect URI in services.php: ' . $configuredRedirect);
        Log::info('Does received URL match configured? ' . ($currentUrl === rtrim($configuredRedirect, '/') ? 'YES' : 'NO'));

        try {
            Log::info('=== ATTEMPTING TO GET USER FROM GOOGLE ===');
            $socialUser = Socialite::driver($provider)->user();

            // Log the data we got from Google
            Log::info('=== GOOGLE USER DATA ===');
            Log::info('Name: ' . $socialUser->getName());
            Log::info('Email: ' . $socialUser->getEmail());
            Log::info('ID: ' . $socialUser->getId());
            Log::info('Avatar URL: ' . $socialUser->getAvatar());
            Log::info('Raw User Data: ', $socialUser->getRaw());

            $avatarUrl = $socialUser->getAvatar();
            Log::info('Avatar URL to save: ' . ($avatarUrl ?? 'NULL'));

            $user = User::updateOrCreate(
                ['email' => $socialUser->getEmail()],
                [
                    'name' => $socialUser->getName(),
                    'provider' => $provider,
                    'provider_id' => $socialUser->getId(),
                    'avatar_url' => $avatarUrl // Save Google profile picture
                ]
            );

            Log::info('=== USER CREATED/UPDATED ===');
            Log::info('User ID: ' . $user->id);
            Log::info('User Name: ' . $user->name);
            Log::info('User Email: ' . $user->email);
            Log::info('Avatar URL from DB: ' . $user->getRawOriginal('avatar_url'));
            Log::info('Avatar URL after accessor: ' . $user->avatar_url);

            $token = $user->createToken('auth_token')->plainTextToken;

            return redirect(config('app.frontend_url').'/auth/callback?token='.$token);
            
        } catch (\Exception $e) {
            Log::error('=== OAUTH CALLBACK ERROR ===');
            Log::error('Error message: ' . $e->getMessage());
            Log::error('Error code: ' . $e->getCode());
            Log::error('Error file: ' . $e->getFile());
            Log::error('Error line: ' . $e->getLine());
            Log::error('Full error: ' . $e->__toString());

            // Log additional context for debugging
            Log::error('Provider: ' . $provider);
            Log::error('Request URL when error occurred: ' . request()->fullUrl());
            Log::error('Request parameters when error occurred: ', request()->all());

            return redirect(config('app.frontend_url').'/login?error=social_login_failed');
        }
    }
}
