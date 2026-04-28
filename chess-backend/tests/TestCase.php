<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function addMobileConsent($user): void
    {
        $user->mobile_country_code = '+91';
        $user->mobile_number = '9999999999';
        $user->tournament_contact_consent_at = now();
        $user->save();
    }
}
