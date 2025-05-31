
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Laravel\Socialite\Facades\Socialite;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;

class SocialAuthController extends Controller
{
    public function redirect($provider, Request $request)
    {
        $refCode = $request->query('ref');
        
        $redirectUrl = Socialite::driver($provider)->redirect()->getTargetUrl();
        
        if ($refCode) {
            session(['ref_code' => $refCode]);
        }
        
        return redirect($redirectUrl);
    }

    public function callback($provider)
    {
        try {
            $socialUser = Socialite::driver($provider)->user();
            
            $user = User::where('email', $socialUser->getEmail())->first();
            $isNewUser = false;
            
            if (!$user) {
                $isNewUser = true;
                $user = User::create([
                    'name' => $socialUser->getName(),
                    'email' => $socialUser->getEmail(),
                    'provider' => $provider,
                    'provider_id' => $socialUser->getId(),
                    'credits' => 100, // Welcome bonus
                    'referred_by' => session('ref_code')
                ]);

                // Give referral bonus
                if (session('ref_code')) {
                    $referrer = User::where('ref_code', session('ref_code'))->first();
                    if ($referrer) {
                        $referrer->addCredits(25, 'referral', 'Referred ' . $user->name);
                        $user->addCredits(25, 'referral', 'Referred by ' . $referrer->name);
                    }
                    session()->forget('ref_code');
                }
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            $redirectUrl = config('app.frontend_url') . '/auth/callback?token=' . $token;
            if ($isNewUser) {
                $redirectUrl .= '&new_user=1';
            }

            return redirect($redirectUrl);
            
        } catch (\Exception $e) {
            return redirect(config('app.frontend_url') . '/login?error=social_login_failed');
        }
    }
}
