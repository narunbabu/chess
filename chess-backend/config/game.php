<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Game Inactivity Timeouts
    |--------------------------------------------------------------------------
    |
    | These values configure when games should be paused or forfeited due to
    | player inactivity. All values are in seconds.
    |
    */

    // Show "Are You There?" dialog after this many seconds of inactivity
    'inactivity_dialog_timeout' => env('GAME_INACTIVITY_DIALOG_TIMEOUT', 60),

    // Pause the game after this many seconds of inactivity (no response to dialog)
    'inactivity_pause_timeout' => env('GAME_INACTIVITY_PAUSE_TIMEOUT', 70),

    // Forfeit the game after this many seconds in paused state
    'inactivity_forfeit_timeout' => env('GAME_INACTIVITY_FORFEIT_TIMEOUT', 1800),

    // Heartbeat interval (how often frontend sends activity signals)
    'heartbeat_interval' => env('GAME_HEARTBEAT_INTERVAL', 30),

    /*
    |--------------------------------------------------------------------------
    | Abort Request Settings
    |--------------------------------------------------------------------------
    |
    | Configuration for mutual abort requests between players.
    |
    */

    // How long an abort request remains valid before expiring (seconds)
    'abort_request_expiry' => env('GAME_ABORT_REQUEST_EXPIRY', 300),

];
