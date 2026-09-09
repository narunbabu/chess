<?php

namespace Tests\Feature;

use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Makes docs/api-contract/websocket-events.json load-bearing.
 *
 * The takeback bug shipped because three codebases each carried their own idea of
 * the wire name and nothing compared them. This is the backend half of that guard:
 * every broadcast class must agree with the contract on both its name and the
 * channel it broadcasts on, and every documented event must still have a class.
 *
 * Pure reflection plus source inspection - no database, no Reverb, no HTTP.
 */
class BroadcastEventNameContractTest extends TestCase
{
    /**
     * Event classes that deliberately have no entry in the contract yet.
     *
     * Every one of these is a real event with no documented consumer (see the
     * realtime event audit in docs/specs/2026-09-02-karta/TAKEBACK.md section B).
     * The list is asserted exhaustively in both directions, so adding an event
     * without documenting it - or documenting one and forgetting to delete it
     * from here - fails this test rather than drifting silently.
     */
    private const UNDOCUMENTED_EVENT_CLASSES = [
        'ChampionshipGameCreated',
        'ChampionshipGameResumeRequestAccepted',
        'ChampionshipGameResumeRequestDeclined',
        'ChampionshipGameResumeRequestSent',
        'ChampionshipGameStartNotification',
        'ChampionshipMatchForfeited',
        'ChampionshipMatchInvitationAccepted',
        'ChampionshipMatchInvitationCancelled',
        'ChampionshipMatchInvitationDeclined',
        'ChampionshipMatchInvitationExpired',
        'ChampionshipMatchInvitationSent',
        'ChampionshipMatchScheduled',
        'ChampionshipMatchStatusChanged',
        'ChampionshipRoundCompleted',
        'ChampionshipRoundGenerated',
        'ChampionshipScheduleProposalUpdated',
        'ChampionshipTimeoutWarning',
        'GameChatMessageSent',
        'InvitationCancelled',
        'InvitationDeclined',
        'MatchRequestAccepted',
        'MatchRequestCancelled',
        'MatchRequestDeclined',
        'MatchRequestReceived',
        'ResumeRequestExpired',
        'ResumeRequestResponse',
        'UserPresenceUpdated',
    ];

    private static ?array $contract = null;

    public function test_the_contract_fixture_exists_and_parses(): void
    {
        $path = $this->contractPath();

        $this->assertFileExists(
            $path,
            'The websocket event contract is the fixture three codebases test against. A moved '
            . 'or deleted file must fail loudly, never pass silently.'
        );

        $this->assertNotEmpty($this->contract(), 'Contract JSON parsed to nothing.');
    }

    public function test_every_broadcast_event_class_matches_the_contract(): void
    {
        $documented = $this->documentedEvents();
        $undocumented = [];

        foreach ($this->eventClasses() as $class) {
            $reflection = new ReflectionClass($class);
            $short = $reflection->getShortName();

            $wireName = $reflection->newInstanceWithoutConstructor()->broadcastAs();

            $this->assertIsString($wireName, "{$short}::broadcastAs() must return a string.");
            $this->assertNotSame('', $wireName, "{$short}::broadcastAs() must not be empty.");

            if (!isset($documented[$wireName])) {
                $undocumented[] = $short;
                continue;
            }

            $emitted = $this->channelPatterns($reflection);

            foreach ($documented[$wireName] as $channel => $documentedClass) {
                $this->assertSame(
                    $class,
                    $documentedClass,
                    "The contract documents '{$wireName}' as {$documentedClass}, but {$class} emits it."
                );

                $this->assertContains(
                    $channel,
                    $emitted,
                    "{$short} emits '{$wireName}' on [" . implode(', ', $emitted) . "] but the contract "
                    . "documents it on '{$channel}'."
                );
            }
        }

        sort($undocumented);
        $expected = self::UNDOCUMENTED_EVENT_CLASSES;
        sort($expected);

        $this->assertSame(
            $expected,
            $undocumented,
            'The set of undocumented broadcast events changed. Document the new event in '
            . 'docs/api-contract/websocket-events.json, or add it to UNDOCUMENTED_EVENT_CLASSES '
            . 'as a deliberate decision.'
        );
    }

    public function test_every_documented_event_maps_to_a_class(): void
    {
        foreach ($this->documentedEvents() as $wireName => $channels) {
            foreach ($channels as $channel => $class) {
                if ($class === null) {
                    // Documented as emitted inline rather than by an event class
                    // (laravel_event_class does not name an App\Events class).
                    continue;
                }

                $this->assertTrue(
                    class_exists($class),
                    "The contract documents '{$wireName}' as {$class}, which does not exist."
                );

                $reflection = new ReflectionClass($class);

                $this->assertSame(
                    $wireName,
                    $reflection->newInstanceWithoutConstructor()->broadcastAs(),
                    "{$class}::broadcastAs() no longer returns the documented '{$wireName}'."
                );

                $this->assertContains(
                    $channel,
                    $this->channelPatterns($reflection),
                    "{$class} no longer broadcasts on the documented channel '{$channel}'."
                );
            }
        }
    }

    public function test_the_undo_events_keep_their_documented_wire_names(): void
    {
        // The three names at the heart of the takeback failure, pinned explicitly
        // so a rename shows up as this test rather than as a silent dead listener.
        $expected = [
            \App\Events\UndoRequestedEvent::class => 'game.undo.request',
            \App\Events\UndoAcceptedEvent::class => 'game.undo.accepted',
            \App\Events\UndoDeclinedEvent::class => 'game.undo.declined',
        ];

        foreach ($expected as $class => $wireName) {
            $reflection = new ReflectionClass($class);

            $this->assertSame($wireName, $reflection->newInstanceWithoutConstructor()->broadcastAs());
            $this->assertContains('game.{id}', $this->channelPatterns($reflection));
        }
    }

    private function contractPath(): string
    {
        return base_path('docs/api-contract/websocket-events.json');
    }

    private function contract(): array
    {
        if (self::$contract === null) {
            $raw = file_get_contents($this->contractPath());
            $decoded = json_decode($raw, true);

            $this->assertIsArray($decoded, 'The websocket event contract is not valid JSON.');

            self::$contract = $decoded;
        }

        return self::$contract;
    }

    /**
     * @return array<string, array<string, class-string|null>> wire name => [channel pattern => class]
     */
    private function documentedEvents(): array
    {
        $channels = $this->contract()['properties']['channels']['properties'] ?? [];
        $events = [];

        foreach ($channels as $channelKey => $channel) {
            $pattern = $this->normalizeChannel($channelKey);

            foreach ($channel['properties']['events']['properties'] ?? [] as $eventKey => $event) {
                // Contract keys carry Echo's leading dot; the wire name does not.
                $wireName = ltrim($eventKey, '.');
                $class = $event['properties']['laravel_event_class']['const'] ?? null;

                if (is_string($class) && !str_starts_with($class, 'App\\Events\\')) {
                    $class = null;
                }

                $events[$wireName][$pattern] = $class;
            }
        }

        return $events;
    }

    /**
     * @return array<int, class-string>
     */
    private function eventClasses(): array
    {
        $classes = [];

        foreach (glob(app_path('Events/*.php')) as $file) {
            $class = 'App\\Events\\' . basename($file, '.php');

            if (!class_exists($class)) {
                continue;
            }

            $reflection = new ReflectionClass($class);

            if ($reflection->isAbstract() || !$reflection->implementsInterface(ShouldBroadcast::class)) {
                continue;
            }

            $this->assertTrue(
                $reflection->hasMethod('broadcastAs'),
                $reflection->getShortName() . ' broadcasts without declaring broadcastAs(), so its wire '
                . 'name would be the fully qualified class name. Declare one.'
            );

            $classes[] = $class;
        }

        sort($classes);

        return $classes;
    }

    /**
     * Channel patterns an event broadcasts on, read from the source of broadcastOn().
     *
     * broadcastOn() dereferences models this test does not build, so it is read
     * rather than called: 'game.' . $this->game->id becomes 'game.{id}'.
     *
     * @return array<int, string>
     */
    private function channelPatterns(ReflectionClass $class): array
    {
        if (!$class->hasMethod('broadcastOn')) {
            return [];
        }

        $method = $class->getMethod('broadcastOn');
        $source = $this->methodSource($method);
        $patterns = [];

        preg_match_all('/new\s+(?:Private|Presence)?Channel\(\s*([^()]*?)\s*\)/', $source, $matches);

        foreach ($matches[1] as $expression) {
            $pattern = $this->patternFromExpression($expression, $source);

            if ($pattern !== null) {
                $patterns[] = $pattern;
            }
        }

        return array_values(array_unique($patterns));
    }

    private function methodSource(ReflectionMethod $method): string
    {
        $lines = file($method->getFileName());
        $offset = $method->getStartLine() - 1;

        return implode('', array_slice($lines, $offset, $method->getEndLine() - $offset));
    }

    /**
     * 'game.' . $this->game->id            -> game.{id}
     * "game.{$this->gameId}"               -> game.{id}
     * 'championship.' . $id . '.organizers' -> championship.{id}.organizers
     * 'lobby'                              -> lobby
     * $channel (resolved from its assignment in the same method)
     */
    private function patternFromExpression(string $expression, string $source): ?string
    {
        $expression = trim($expression);

        if ($expression === '') {
            return null;
        }

        if (preg_match('/^\$([A-Za-z_]\w*)$/', $expression, $variable)) {
            if (preg_match('/\$' . $variable[1] . '\s*=\s*(.+?);/', $source, $assignment)) {
                return $this->patternFromExpression($assignment[1], $source);
            }

            return null;
        }

        // Tokenise the concatenation: quoted literals contribute their text, any
        // variable term contributes the {id} placeholder the contract uses.
        preg_match_all('/\'[^\']*\'|"[^"]*"|\$[A-Za-z_][\w>\-\[\]]*/', $expression, $tokens);

        $pattern = '';

        foreach ($tokens[0] as $token) {
            if (str_starts_with($token, "'")) {
                $pattern .= trim($token, "'");
                continue;
            }

            if (str_starts_with($token, '"')) {
                $pattern .= preg_replace('/\{\$[^}]*\}/', '{id}', trim($token, '"'));
                continue;
            }

            $pattern .= '{id}';
        }

        return $pattern === '' ? null : $pattern;
    }

    /**
     * private-game.{gameId} -> game.{id}; presence-presence.online -> presence.online
     */
    private function normalizeChannel(string $channel): string
    {
        foreach (['private-', 'presence-'] as $prefix) {
            if (str_starts_with($channel, $prefix)) {
                $channel = substr($channel, strlen($prefix));
                break;
            }
        }

        return preg_replace('/\{[^}]*\}/', '{id}', $channel);
    }
}
