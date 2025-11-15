<?php

namespace Tests\Unit\ValueObjects;

use App\ValueObjects\TournamentConfig;
use Tests\TestCase;

class TournamentConfigTest extends TestCase
{
    /**
     * Test successful configuration creation with all algorithms
     */
    public function test_configuration_creation_all_algorithms(): void
    {
        $algorithms = [
            TournamentConfig::ALG_RANDOM,
            TournamentConfig::ALG_RANDOM_SEEDED,
            TournamentConfig::ALG_RATING,
            TournamentConfig::ALG_STANDINGS,
            TournamentConfig::ALG_DIRECT,
            TournamentConfig::ALG_SWISS
        ];

        foreach ($algorithms as $algorithm) {
            $config = new TournamentConfig([
                'pairing_algorithm' => $algorithm,
                'participant_selection' => TournamentConfig::SEL_ALL,
                'rounds' => 5
            ]);

            $this->assertEquals($algorithm, $config->pairing_algorithm);
            $this->assertEquals(TournamentConfig::SEL_ALL, $config->participant_selection);
            $this->assertEquals(5, $config->rounds);
        }
    }

    /**
     * Test configuration creation with all participant selection types
     */
    public function test_configuration_creation_all_selection_types(): void
    {
        $selectionTests = [
            ['type' => TournamentConfig::SEL_ALL, 'value' => null],
            ['type' => TournamentConfig::SEL_TOP_K, 'value' => 8],
            ['type' => TournamentConfig::SEL_TOP_PERCENT, 'value' => 75],
        ];

        foreach ($selectionTests as $test) {
            $config = new TournamentConfig([
                'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
                'participant_selection' => $test['type'],
                'selection_value' => $test['value'],
                'rounds' => 3
            ]);

            $this->assertEquals($test['type'], $config->participant_selection);
            $this->assertEquals($test['value'], $config->selection_value);
        }
    }

    /**
     * Test invalid pairing algorithm
     */
    public function test_invalid_pairing_algorithm(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid pairing algorithm');

        new TournamentConfig([
            'pairing_algorithm' => 'invalid_algorithm',
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 3
        ]);
    }

    /**
     * Test invalid participant selection
     */
    public function test_invalid_participant_selection(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid participant selection');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => 'invalid_selection',
            'rounds' => 3
        ]);
    }

    /**
     * Test rounds validation - minimum
     */
    public function test_rounds_validation_minimum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Minimum 1 round required');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 0
        ]);
    }

    /**
     * Test rounds validation - negative
     */
    public function test_rounds_validation_negative(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Minimum 1 round required');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => -5
        ]);
    }

    /**
     * Test rounds validation - maximum
     */
    public function test_rounds_validation_maximum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Maximum 50 rounds allowed');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 51
        ]);
    }

    /**
     * Test selection value validation - TOP_K requires value
     */
    public function test_selection_value_validation_top_k_requires_value(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Selection value required for TOP_K selection');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'rounds' => 3,
            'selection_value' => null
        ]);
    }

    /**
     * Test selection value validation - TOP_PERCENT requires value
     */
    public function test_selection_value_validation_top_percent_requires_value(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Selection value required for TOP_PERCENT selection');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_PERCENT,
            'rounds' => 3,
            'selection_value' => null
        ]);
    }

    /**
     * Test selection value validation - TOP_K minimum
     */
    public function test_selection_value_validation_top_k_minimum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Minimum 2 participants required for TOP_K');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'rounds' => 3,
            'selection_value' => 1
        ]);
    }

    /**
     * Test selection value validation - TOP_K maximum
     */
    public function test_selection_value_validation_top_k_maximum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Maximum 1000 participants allowed for TOP_K');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'rounds' => 3,
            'selection_value' => 1001
        ]);
    }

    /**
     * Test selection value validation - TOP_PERCENT minimum
     */
    public function test_selection_value_validation_top_percent_minimum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Minimum 1 percent required for TOP_PERCENT');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_PERCENT,
            'rounds' => 3,
            'selection_value' => 0
        ]);
    }

    /**
     * Test selection value validation - TOP_PERCENT maximum
     */
    public function test_selection_value_validation_top_percent_maximum(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Maximum 100 percent allowed for TOP_PERCENT');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_PERCENT,
            'rounds' => 3,
            'selection_value' => 101
        ]);
    }

    /**
     * Test seed validation - negative
     */
    public function test_seed_validation_negative(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Seed must be non-negative');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 3,
            'seed' => -1
        ]);
    }

    /**
     * Test seed validation - too large
     */
    public function test_seed_validation_too_large(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Seed must be less than 2^32');

        new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 3,
            'seed' => 4294967296 // 2^32
        ]);
    }

    /**
     * Test successful seed validation
     */
    public function test_successful_seed_validation(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 3,
            'seed' => 42
        ]);

        $this->assertEquals(42, $config->seed);
    }

    /**
     * Test toArray method
     */
    public function test_to_array(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_SWISS,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'selection_value' => 16,
            'rounds' => 7,
            'seed' => 123
        ]);

        $expected = [
            'pairing_algorithm' => TournamentConfig::ALG_SWISS,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'selection_value' => 16,
            'rounds' => 7,
            'seed' => 123
        ];

        $this->assertEquals($expected, $config->toArray());
    }

    /**
     * Test toArray method with null values
     */
    public function test_to_array_with_nulls(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 5
        ]);

        $expected = [
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'selection_value' => null,
            'rounds' => 5,
            'seed' => null
        ];

        $this->assertEquals($expected, $config->toArray());
    }

    /**
     * Test jsonSerialize method
     */
    public function test_json_serialize(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_RANDOM_SEEDED,
            'participant_selection' => TournamentConfig::SEL_TOP_PERCENT,
            'selection_value' => 50,
            'rounds' => 9,
            'seed' => 999
        ]);

        $expected = [
            'pairing_algorithm' => TournamentConfig::ALG_RANDOM_SEEDED,
            'participant_selection' => TournamentConfig::SEL_TOP_PERCENT,
            'selection_value' => 50,
            'rounds' => 9,
            'seed' => 999
        ];

        $this->assertEquals($expected, $config->jsonSerialize());
    }

    /**
     * Test json_encode compatibility
     */
    public function test_json_encode(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_RATING,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 3
        ]);

        $json = json_encode($config);
        $decoded = json_decode($json, true);

        $this->assertEquals(TournamentConfig::ALG_RATING, $decoded['pairing_algorithm']);
        $this->assertEquals(TournamentConfig::SEL_ALL, $decoded['participant_selection']);
        $this->assertEquals(3, $decoded['rounds']);
    }

    /**
     * Test immutability - properties cannot be modified
     */
    public function test_immutability(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_ALL,
            'rounds' => 5
        ]);

        // Try to modify the array representation
        $array = $config->toArray();
        $array['rounds'] = 10;

        // Original config should remain unchanged
        $this->assertEquals(5, $config->rounds);
    }

    /**
     * Test edge case - maximum valid values
     */
    public function test_edge_case_maximum_valid_values(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'selection_value' => 1000,
            'rounds' => 50,
            'seed' => 4294967295 // 2^32 - 1
        ]);

        $this->assertEquals(1000, $config->selection_value);
        $this->assertEquals(50, $config->rounds);
        $this->assertEquals(4294967295, $config->seed);
    }

    /**
     * Test edge case - minimum valid values
     */
    public function test_edge_case_minimum_valid_values(): void
    {
        $config = new TournamentConfig([
            'pairing_algorithm' => TournamentConfig::ALG_DIRECT,
            'participant_selection' => TournamentConfig::SEL_TOP_K,
            'selection_value' => 2,
            'rounds' => 1,
            'seed' => 0
        ]);

        $this->assertEquals(2, $config->selection_value);
        $this->assertEquals(1, $config->rounds);
        $this->assertEquals(0, $config->seed);
    }

    /**
     * Test constant values are correct
     */
    public function test_constant_values(): void
    {
        // Pairing algorithm constants
        $this->assertEquals('random', TournamentConfig::ALG_RANDOM);
        $this->assertEquals('random_seeded', TournamentConfig::ALG_RANDOM_SEEDED);
        $this->assertEquals('rating', TournamentConfig::ALG_RATING);
        $this->assertEquals('standings', TournamentConfig::ALG_STANDINGS);
        $this->assertEquals('direct', TournamentConfig::ALG_DIRECT);
        $this->assertEquals('swiss', TournamentConfig::ALG_SWISS);

        // Participant selection constants
        $this->assertEquals('all', TournamentConfig::SEL_ALL);
        $this->assertEquals('top_k', TournamentConfig::SEL_TOP_K);
        $this->assertEquals('top_percent', TournamentConfig::SEL_TOP_PERCENT);
    }
}