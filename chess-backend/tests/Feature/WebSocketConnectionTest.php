<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WebSocketConnectionTest extends TestCase
{
    use RefreshDatabase;

    private User $whitePlayer;
    private User $blackPlayer;
    private Game $game;
    private string $whiteToken;
    private string $blackToken;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test users
        $this->whitePlayer = User::factory()->create([
            'name' => 'White Player',
            'email' => 'white@test.com'
        ]);

        $this->blackPlayer = User::factory()->create([
            'name' => 'Black Player',
            'email' => 'black@test.com'
        ]);

        // Create authentication tokens
        $this->whiteToken = $this->whitePlayer->createToken('test')->plainTextToken;
        $this->blackToken = $this->blackPlayer->createToken('test')->plainTextToken;

        // Create test game
        $this->game = Game::create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'status' => 'waiting',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        ]);
    }

    /**
     * Test complete WebSocket connection flow for both players
     */
    public function test_complete_websocket_connection_flow(): void
    {
        // === PHASE 1: WHITE PLAYER CONNECTION ===

        // 1. White player authentication
        $whiteAuthResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken,
            'Content-Type' => 'application/json'
        ])->postJson('/api/websocket/authenticate', [
            'socket_id' => 'socket_white_123',
            'channel_name' => 'game.' . $this->game->id
        ]);

        $whiteAuthResponse->assertStatus(200);
        $whiteAuthResponse->assertJsonStructure([
            'success',
            'user' => ['id', 'name', 'avatar'],
            'socket_id',
            'channel',
            'auth_data'
        ]);

        // 2. White player handshake
        $whiteHandshakeResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken,
            'Content-Type' => 'application/json'
        ])->postJson('/api/websocket/handshake', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_white_123',
            'client_info' => [
                'browser' => 'Chrome',
                'version' => '91.0'
            ]
        ]);

        $whiteHandshakeResponse->assertStatus(200);
        $whiteHandshakeResponse->assertJsonStructure([
            'success',
            'handshake_id',
            'timestamp',
            'connection' => ['connection_id', 'user_role', 'socket_id'],
            'game_state' => ['id', 'status', 'fen', 'turn', 'moves'],
            'player_info' => [
                'you' => ['id', 'name', 'color'],
                'opponent' => ['id', 'name', 'color']
            ],
            'channels' => ['game_channel', 'presence_channel', 'user_channel'],
            'protocol' => ['version', 'heartbeat_interval', 'supported_events'],
            'session' => ['session_id', 'expires_at']
        ]);

        $whiteHandshakeId = $whiteHandshakeResponse->json('handshake_id');

        // 3. White player acknowledge handshake
        $whiteAckResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken,
            'Content-Type' => 'application/json'
        ])->postJson('/api/websocket/acknowledge-handshake', [
            'handshake_id' => $whiteHandshakeId,
            'client_data' => ['ready' => true]
        ]);

        $whiteAckResponse->assertStatus(200);
        $whiteAckResponse->assertJson([
            'success' => true,
            'status' => 'acknowledged'
        ]);

        // === PHASE 2: BLACK PLAYER CONNECTION ===

        // 1. Black player authentication
        $blackAuthResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->blackToken,
            'Content-Type' => 'application/json'
        ])->postJson('/api/websocket/authenticate', [
            'socket_id' => 'socket_black_456',
            'channel_name' => 'game.' . $this->game->id
        ]);

        $blackAuthResponse->assertStatus(200);

        // 2. Black player handshake
        $blackHandshakeResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->blackToken,
            'Content-Type' => 'application/json'
        ])->postJson('/api/websocket/handshake', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_black_456',
            'client_info' => [
                'browser' => 'Firefox',
                'version' => '89.0'
            ]
        ]);

        $blackHandshakeResponse->assertStatus(200);
        $this->assertEquals('black', $blackHandshakeResponse->json('player_info.you.color'));

        // === PHASE 3: HEARTBEAT AND ROOM STATE ===

        // Test heartbeat for both players
        $whiteHeartbeatResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->postJson('/api/websocket/heartbeat', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_white_123'
        ]);

        $whiteHeartbeatResponse->assertStatus(200);
        $whiteHeartbeatResponse->assertJson(['success' => true]);

        // Test room state retrieval
        $roomStateResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->getJson('/api/websocket/room-state?game_id=' . $this->game->id);

        $roomStateResponse->assertStatus(200);
        $roomStateResponse->assertJsonStructure([
            'success',
            'data' => [
                'game',
                'user_role',
                'active_connections',
                'presence'
            ]
        ]);

        // === PHASE 4: DISCONNECTION ===

        // Test leaving game room
        $leaveResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->postJson('/api/websocket/leave-game', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_white_123'
        ]);

        $leaveResponse->assertStatus(200);
        $leaveResponse->assertJson(['success' => true]);
    }

    /**
     * Test unauthorized access attempts
     */
    public function test_unauthorized_websocket_access(): void
    {
        // Test without authentication
        $response = $this->postJson('/api/websocket/authenticate', [
            'socket_id' => 'socket_123',
            'channel_name' => 'game.' . $this->game->id
        ]);

        $response->assertStatus(401);

        // Test access to game user is not part of
        $otherUser = User::factory()->create();
        $otherToken = $otherUser->createToken('test')->plainTextToken;

        $unauthorizedResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $otherToken
        ])->postJson('/api/websocket/handshake', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_other_789'
        ]);

        $unauthorizedResponse->assertStatus(400);
        $unauthorizedResponse->assertJsonFragment(['error' => 'Handshake failed']);
    }

    /**
     * Test reconnection scenarios
     */
    public function test_websocket_reconnection(): void
    {
        // Initial connection and handshake
        $initialHandshake = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->postJson('/api/websocket/handshake', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_initial_123'
        ]);

        $initialHandshake->assertStatus(200);
        $handshakeId = $initialHandshake->json('handshake_id');

        // Test retrieving existing handshake
        $existingHandshake = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->getJson('/api/websocket/handshake?game_id=' . $this->game->id);

        $existingHandshake->assertStatus(200);
        $existingHandshake->assertJson(['exists' => true]);

        // Verify handshake data consistency
        $this->assertEquals(
            $initialHandshake->json('game_state.id'),
            $existingHandshake->json('handshake.game_state.id')
        );
    }

    /**
     * Test token validation endpoint
     */
    public function test_token_validation(): void
    {
        $validationResponse = $this->postJson('/api/websocket/validate-token', [
            'token' => $this->whiteToken
        ]);

        $validationResponse->assertStatus(200);
        $validationResponse->assertJson([
            'valid' => true,
            'user' => [
                'id' => $this->whitePlayer->id,
                'name' => $this->whitePlayer->name,
                'email' => $this->whitePlayer->email
            ]
        ]);

        // Test invalid token
        $invalidResponse = $this->postJson('/api/websocket/validate-token', [
            'token' => 'invalid_token_123'
        ]);

        $invalidResponse->assertStatus(401);
        $invalidResponse->assertJson(['valid' => false]);
    }

    /**
     * Test handshake data structure and content
     */
    public function test_handshake_data_structure(): void
    {
        $handshakeResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->whiteToken
        ])->postJson('/api/websocket/handshake', [
            'game_id' => $this->game->id,
            'socket_id' => 'socket_test_123'
        ]);

        $handshakeResponse->assertStatus(200);

        $data = $handshakeResponse->json();

        // Verify protocol version
        $this->assertEquals('2.0', $data['protocol']['version']);

        // Verify supported events
        $expectedEvents = [
            'game.move',
            'game.connection',
            'game.status',
            'game.chat',
            'game.draw_offer',
            'game.resignation'
        ];
        $this->assertEquals($expectedEvents, $data['protocol']['supported_events']);

        // Verify channels
        $this->assertEquals("game.{$this->game->id}", $data['channels']['game_channel']);
        $this->assertEquals("presence.game.{$this->game->id}", $data['channels']['presence_channel']);
        $this->assertEquals("App.Models.User.{$this->whitePlayer->id}", $data['channels']['user_channel']);

        // Verify player color assignment
        $this->assertEquals('white', $data['player_info']['you']['color']);
        $this->assertEquals('black', $data['player_info']['opponent']['color']);
    }
}