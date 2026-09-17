<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

function out($m)
{
    echo $m . PHP_EOL;
}

$mode = $argv[1] ?? 'inspect';

if ($mode === 'inspect') {
    out('users=' . User::count());
    foreach (User::orderByDesc('id')->take(8)->get() as $u) {
        out("u {$u->id} {$u->email} {$u->name}");
    }
    out('games=' . Game::count());
    foreach (Game::orderByDesc('id')->take(10)->get() as $g) {
        out("g {$g->id} status={$g->status} w={$g->white_player_id} b={$g->black_player_id} resume={$g->resume_status} by={$g->resume_requested_by} at={$g->resume_requested_at} exp={$g->resume_request_expires_at}");
    }
    exit(0);
}

if ($mode === 'setup') {
    $a = User::firstOrCreate(
        ['email' => 'livecheck.a@example.test'],
        ['name' => 'LiveCheck A', 'password' => Hash::make('LiveCheck@123')]
    );
    $b = User::firstOrCreate(
        ['email' => 'livecheck.b@example.test'],
        ['name' => 'LiveCheck B', 'password' => Hash::make('LiveCheck@123')]
    );

    $game = Game::create([
        'white_player_id' => $a->id,
        'black_player_id' => $b->id,
        'status' => 'paused',
        'game_type' => 'multiplayer',
        'rated' => false,
        'moves' => [],
        'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'paused_at' => now(),
        'paused_by' => $a->id,
    ]);

    $a->tokens()->delete();
    $token = $a->createToken('livecheck')->plainTextToken;

    out('A_ID=' . $a->id);
    out('B_ID=' . $b->id);
    out('GAME_ID=' . $game->id);
    out('TOKEN=' . $token);
    exit(0);
}

if ($mode === 'age-request') {
    $gameId = (int) ($argv[2] ?? 0);
    $ageSeconds = (int) ($argv[3] ?? 15);
    $ttlSeconds = (int) ($argv[4] ?? 30);
    $sender = ($argv[5] ?? 'a') === 'b' ? 'black_player_id' : 'white_player_id';
    $game = Game::findOrFail($gameId);
    $requestedAt = now()->subSeconds($ageSeconds);
    $game->update([
        'resume_status' => 'pending',
        'resume_requested_by' => $game->{$sender},
        'resume_requested_at' => $requestedAt,
        'resume_request_expires_at' => $requestedAt->copy()->addSeconds($ttlSeconds),
    ]);
    out('aged game=' . $game->id . ' requested_by=' . $game->fresh()->resume_requested_by . ' requested_at=' . $game->fresh()->resume_requested_at . ' expires_at=' . $game->fresh()->resume_request_expires_at);
    exit(0);
}

if ($mode === 'clear-request') {
    $gameId = (int) ($argv[2] ?? 0);
    $game = Game::findOrFail($gameId);
    $game->update([
        'resume_status' => 'none',
        'resume_requested_by' => null,
        'resume_requested_at' => null,
        'resume_request_expires_at' => null,
    ]);
    out('cleared game=' . $game->id);
    exit(0);
}
