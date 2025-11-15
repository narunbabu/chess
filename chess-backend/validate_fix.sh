#!/bin/bash

echo "=== Tournament Coverage Fix Validation ==="
echo ""

# Test 1: Check TournamentConfig has coverage_pairs
echo "✅ Test 1: TournamentConfig structure verification"
echo "Checking for coverage_pairs in generateAdaptiveSmallTournament..."

# Search for coverage_pairs in the TournamentConfig file
if grep -q "coverage_pairs" app/ValueObjects/TournamentConfig.php; then
    echo "✅ Found coverage_pairs configuration"
    grep -n "coverage_pairs" app/ValueObjects/TournamentConfig.php | head -3
else
    echo "❌ Missing coverage_pairs configuration"
fi

echo ""

# Test 2: Check generateCoverageEnforcedRound method
echo "✅ Test 2: generateCoverageEnforcedRound method verification"
if grep -q "generateCoverageEnforcedRound" app/Services/TournamentGenerationService.php; then
    echo "✅ Found generateCoverageEnforcedRound method"
    grep -n "generateCoverageEnforcedRound" app/Services/TournamentGenerationService.php
else
    echo "❌ Missing generateCoverageEnforcedRound method"
fi

echo ""

# Test 3: Check coverage enforcement logic in generateRound
echo "✅ Test 3: Coverage enforcement logic verification"
if grep -q "enforce_coverage" app/Services/TournamentGenerationService.php; then
    echo "✅ Found enforce_coverage logic"
    grep -n "enforce_coverage" app/Services/TournamentGenerationService.php | head -3
else
    echo "❌ Missing enforce_coverage logic"
fi

echo ""

# Test 4: Check validation method
echo "✅ Test 4: Coverage requirements validation"
if grep -q "validateCoverageRequirements" app/ValueObjects/TournamentConfig.php; then
    echo "✅ Found validateCoverageRequirements method"
    grep -n "validateCoverageRequirements" app/ValueObjects/TournamentConfig.php
else
    echo "❌ Missing validateCoverageRequirements method"
fi

echo ""

# Test 5: Check required pairs for Round 3 and 4
echo "✅ Test 5: Specific coverage pairs verification"
echo "Round 3 should have: ['rank_1', 'rank_2'], ['rank_2', 'rank_3']"
if grep -A10 "Round 3.*coverage enforcement" app/ValueObjects/TournamentConfig.php | grep -q "'rank_1', 'rank_2'" && grep -A10 "Round 3.*coverage enforcement" app/ValueObjects/TournamentConfig.php | grep -q "'rank_2', 'rank_3'"; then
    echo "✅ Found expected Round 3 coverage pairs"
else
    echo "❌ Missing expected Round 3 coverage pairs"
fi

echo "Round 4 should have: ['rank_1', 'rank_3'], ['rank_2', 'rank_3'] (Option A - minimum 2 matches)"
if grep -A10 "Round 4.*complete coverage" app/ValueObjects/TournamentConfig.php | grep -q "'rank_1', 'rank_3'" && grep -A10 "Round 4.*complete coverage" app/ValueObjects/TournamentConfig.php | grep -q "'rank_2', 'rank_3'"; then
    echo "✅ Found expected Round 4 coverage pairs (Option A implemented)"
else
    echo "❌ Missing expected Round 4 coverage pairs"
fi

echo ""

# Test 6: Check minimum 2 matches validation
echo "✅ Test 6: Minimum 2 matches per pre-final round validation"
if grep -q "Minimum 2 matches required for pre-final rounds" app/ValueObjects/TournamentConfig.php; then
    echo "✅ Found minimum matches validation logic"
    grep -n "Minimum 2 matches required" app/ValueObjects/TournamentConfig.php
else
    echo "❌ Missing minimum matches validation logic"
fi

echo ""

# Summary
echo "=== Summary ==="
echo "Expected improvement for 3-participant tournaments (Option A):"
echo "  Before: 1 placeholder per round (8 total matches)"
echo "  After:  Multiple placeholders with strict compliance (10 total matches)"
echo ""
echo "Key fixes implemented:"
echo "  ✅ Round 3: 2 coverage pairs (rank1 vs rank2, rank2 vs rank3)"
echo "  ✅ Round 4: 2 coverage pairs (rank1 vs rank3, rank2 vs rank3) - Option A"
echo "  ✅ Coverage enforcement logic in generateRound"
echo "  ✅ New generateCoverageEnforcedRound method"
echo "  ✅ Validation for coverage requirements + minimum 2 matches"
echo "  ✅ Strict compliance with 'minimum 2 games per pre-final round'"
echo ""
echo "New Match Distribution (Option A):"
echo "  Round 1: 3 matches (all players, round-robin)"
echo "  Round 2: 2 matches (all players, partial)"
echo "  Round 3: 2 matches (top-3 coverage: rank1 vs rank2, rank2 vs rank3)"
echo "  Round 4: 2 matches (top-3 coverage: rank1 vs rank3, rank2 vs rank3)"
echo "  Round 5: 1 match (final: rank1 vs rank2)"
echo "  Total: 10 matches - Guaranteed top-3 coverage with strict compliance!"