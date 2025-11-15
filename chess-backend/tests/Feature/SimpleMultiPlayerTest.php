<?php

use Tests\TestCase;
use App\Models\Championship;
use App\Models\User;
use App\Services\TournamentGenerationService;
use App\Services\SwissPairingService;

class SimpleMultiPlayerTest extends TestCase
{
    private $tournamentGenerationService;

    protected function setUp(): void
    {
        parent::setUp();
        $swissService = new SwissPairingService();
        $this->tournamentGenerationService = new TournamentGenerationService($swissService);
    }

    /**
     * Test tournament generation with 3 players
     */
    public function test_3_player_tournament()
    {
        echo "\n🏆 Testing 3-Player Tournament\n";
        echo str_repeat("=", 40) . "\n";

        // Create championship manually
        $championship = new Championship();
        $championship->name = '3 Player Test Tournament';
        $championship->type = 'swiss';
        $championship->player_count = 3;
        $championship->total_rounds = 5;
        $championship->status = 'upcoming';
        $championship->save();

        // Test tournament generation
        try {
            $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

            echo "✅ Tournament generated successfully\n";
            echo "📊 Total rounds: " . count($tournamentData['rounds']) . "\n";

            $totalMatches = 0;
            $complianceIssues = [];

            foreach ($tournamentData['rounds'] as $roundIndex => $round) {
                $matchCount = count($round['matches']);
                $totalMatches += $matchCount;

                $compliance = $matchCount >= 2 ? '✅' : '❌';
                echo sprintf(
                    "  Round %d: %d matches %s\n",
                    $roundIndex + 1,
                    $matchCount,
                    $compliance
                );

                // Check minimum 2 compliance (excluding final round)
                if ($roundIndex < 4 && $matchCount < 2) {
                    $complianceIssues[] = $roundIndex + 1;
                }
            }

            echo "\n📋 Results:\n";
            echo "  Total matches: {$totalMatches}\n";

            if (empty($complianceIssues)) {
                echo "  ✅ Minimum 2 compliance: PASSED\n";
            } else {
                echo "  ❌ Minimum 2 compliance: FAILED (Rounds: " . implode(', ', $complianceIssues) . ")\n";
            }

            $this->assertNotEmpty($tournamentData['rounds']);
            $this->assertEmpty($complianceIssues);

        } catch (Exception $e) {
            echo "❌ Tournament generation failed: " . $e->getMessage() . "\n";
            $this->fail("Tournament generation failed: " . $e->getMessage());
        }
    }

    /**
     * Test tournament generation with 5 players
     */
    public function test_5_player_tournament()
    {
        echo "\n🏆 Testing 5-Player Tournament\n";
        echo str_repeat("=", 40) . "\n";

        $championship = new Championship();
        $championship->name = '5 Player Test Tournament';
        $championship->type = 'swiss';
        $championship->player_count = 5;
        $championship->total_rounds = 5;
        $championship->status = 'upcoming';
        $championship->save();

        try {
            $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

            echo "✅ Tournament generated successfully\n";
            echo "📊 Total rounds: " . count($tournamentData['rounds']) . "\n";

            $totalMatches = 0;
            $complianceIssues = [];

            foreach ($tournamentData['rounds'] as $roundIndex => $round) {
                $matchCount = count($round['matches']);
                $totalMatches += $matchCount;

                $compliance = $matchCount >= 2 ? '✅' : '❌';
                echo sprintf(
                    "  Round %d: %d matches %s\n",
                    $roundIndex + 1,
                    $matchCount,
                    $compliance
                );

                if ($roundIndex < 4 && $matchCount < 2) {
                    $complianceIssues[] = $roundIndex + 1;
                }
            }

            echo "\n📋 Results:\n";
            echo "  Total matches: {$totalMatches}\n";

            if (empty($complianceIssues)) {
                echo "  ✅ Minimum 2 compliance: PASSED\n";
            } else {
                echo "  ❌ Minimum 2 compliance: FAILED (Rounds: " . implode(', ', $complianceIssues) . ")\n";
            }

            $this->assertNotEmpty($tournamentData['rounds']);
            $this->assertEmpty($complianceIssues);

        } catch (Exception $e) {
            echo "❌ Tournament generation failed: " . $e->getMessage() . "\n";
            $this->fail("Tournament generation failed: " . $e->getMessage());
        }
    }

    /**
     * Test tournament generation with 10 players
     */
    public function test_10_player_tournament()
    {
        echo "\n🏆 Testing 10-Player Tournament\n";
        echo str_repeat("=", 40) . "\n";

        $championship = new Championship();
        $championship->name = '10 Player Test Tournament';
        $championship->type = 'swiss';
        $championship->player_count = 10;
        $championship->total_rounds = 6;
        $championship->status = 'upcoming';
        $championship->save();

        try {
            $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

            echo "✅ Tournament generated successfully\n";
            echo "📊 Total rounds: " . count($tournamentData['rounds']) . "\n";

            $totalMatches = 0;
            $complianceIssues = [];

            foreach ($tournamentData['rounds'] as $roundIndex => $round) {
                $matchCount = count($round['matches']);
                $totalMatches += $matchCount;

                $compliance = $matchCount >= 2 ? '✅' : '❌';
                echo sprintf(
                    "  Round %d: %d matches %s\n",
                    $roundIndex + 1,
                    $matchCount,
                    $compliance
                );

                if ($roundIndex < 5 && $matchCount < 2) {
                    $complianceIssues[] = $roundIndex + 1;
                }
            }

            echo "\n📋 Results:\n";
            echo "  Total matches: {$totalMatches}\n";

            if (empty($complianceIssues)) {
                echo "  ✅ Minimum 2 compliance: PASSED\n";
            } else {
                echo "  ❌ Minimum 2 compliance: FAILED (Rounds: " . implode(', ', $complianceIssues) . ")\n";
            }

            $this->assertNotEmpty($tournamentData['rounds']);
            $this->assertEmpty($complianceIssues);

        } catch (Exception $e) {
            echo "❌ Tournament generation failed: " . $e->getMessage() . "\n";
            $this->fail("Tournament generation failed: " . $e->getMessage());
        }
    }

    /**
     * Test tournament generation with 50 players
     */
    public function test_50_player_tournament()
    {
        echo "\n🏆 Testing 50-Player Tournament\n";
        echo str_repeat("=", 40) . "\n";

        $championship = new Championship();
        $championship->name = '50 Player Test Tournament';
        $championship->type = 'swiss';
        $championship->player_count = 50;
        $championship->total_rounds = 8;
        $championship->status = 'upcoming';
        $championship->save();

        try {
            $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

            echo "✅ Tournament generated successfully\n";
            echo "📊 Total rounds: " . count($tournamentData['rounds']) . "\n";

            $totalMatches = 0;
            $complianceIssues = [];

            foreach ($tournamentData['rounds'] as $roundIndex => $round) {
                $matchCount = count($round['matches']);
                $totalMatches += $matchCount;

                $compliance = $matchCount >= 2 ? '✅' : '❌';
                echo sprintf(
                    "  Round %d: %d matches %s\n",
                    $roundIndex + 1,
                    $matchCount,
                    $compliance
                );

                if ($roundIndex < 7 && $matchCount < 2) {
                    $complianceIssues[] = $roundIndex + 1;
                }
            }

            echo "\n📋 Results:\n";
            echo "  Total matches: {$totalMatches}\n";
            echo "  Average matches per round: " . round($totalMatches / count($tournamentData['rounds']), 1) . "\n";

            if (empty($complianceIssues)) {
                echo "  ✅ Minimum 2 compliance: PASSED\n";
            } else {
                echo "  ❌ Minimum 2 compliance: FAILED (Rounds: " . implode(', ', $complianceIssues) . ")\n";
            }

            $this->assertNotEmpty($tournamentData['rounds']);
            $this->assertEmpty($complianceIssues);

        } catch (Exception $e) {
            echo "❌ Tournament generation failed: " . $e->getMessage() . "\n";
            $this->fail("Tournament generation failed: " . $e->getMessage());
        }
    }

    /**
     * Test tournament generation with 200 players
     */
    public function test_200_player_tournament()
    {
        echo "\n🏆 Testing 200-Player Tournament\n";
        echo str_repeat("=", 40) . "\n";

        $championship = new Championship();
        $championship->name = '200 Player Test Tournament';
        $championship->type = 'swiss';
        $championship->player_count = 200;
        $championship->total_rounds = 10;
        $championship->status = 'upcoming';
        $championship->save();

        try {
            $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

            echo "✅ Tournament generated successfully\n";
            echo "📊 Total rounds: " . count($tournamentData['rounds']) . "\n";

            $totalMatches = 0;
            $complianceIssues = [];

            foreach ($tournamentData['rounds'] as $roundIndex => $round) {
                $matchCount = count($round['matches']);
                $totalMatches += $matchCount;

                $compliance = $matchCount >= 2 ? '✅' : '❌';
                echo sprintf(
                    "  Round %d: %d matches %s\n",
                    $roundIndex + 1,
                    $matchCount,
                    $compliance
                );

                if ($roundIndex < 9 && $matchCount < 2) {
                    $complianceIssues[] = $roundIndex + 1;
                }
            }

            echo "\n📋 Results:\n";
            echo "  Total matches: {$totalMatches}\n";
            echo "  Average matches per round: " . round($totalMatches / count($tournamentData['rounds']), 1) . "\n";

            if (empty($complianceIssues)) {
                echo "  ✅ Minimum 2 compliance: PASSED\n";
            } else {
                echo "  ❌ Minimum 2 compliance: FAILED (Rounds: " . implode(', ', $complianceIssues) . ")\n";
            }

            $this->assertNotEmpty($tournamentData['rounds']);
            $this->assertEmpty($complianceIssues);

        } catch (Exception $e) {
            echo "❌ Tournament generation failed: " . $e->getMessage() . "\n";
            $this->fail("Tournament generation failed: " . $e->getMessage());
        }
    }
}