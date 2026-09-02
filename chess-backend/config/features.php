<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Runtime feature controls
    |--------------------------------------------------------------------------
    |
    | Safety-sensitive clients consume these through the public health
    | endpoint. CHAT_ENABLED=false disables in-game chat without requiring a
    | mobile release.
    |
    */
    'chat_enabled' => env('CHAT_ENABLED', true),
];
