# Championship Testing Guide

This guide shows how to use the Championship Testing Module to create and manipulate championship states for testing different scenarios.

## Files Created

1. **`database/seeders/ChampionshipTestSeeder.php`** - Main testing class with all championship manipulation methods
2. **`test-championship.ps1`** - PowerShell script for easy command-line testing
3. **`CHAMPIONSHIP_TESTING_GUIDE.md`** - This guide

## Quick Start with PowerShell Script

The easiest way to use the testing module is through the PowerShell script:

### 1. List All Test Championships
```powershell
cd 'C:\ArunApps\Chess-Web\chess-backend'
.\test-championship.ps1 list
```

### 2. Create New Test Championship
```powershell
.\test-championship.ps1 create
```

### 3. Create Championship at Specific Stage
```powershell
# Championship in registration phase
.\test-championship.ps1 stage registration

# Round 1 matches generated but not completed
.\test-championship.ps1 stage round1_pending

# Round 1 completed, Round 2 generated
.\test-championship.ps1 stage round1_completed

# Round 2 completed, Round 3 generated
.\test-championship.ps1 stage round2_completed

# All rounds completed
.\test-championship.ps1 stage completed
```

### 4. Analyze Championship State
```powershell
.\test-championship.ps1 analyze 5
```

### 5. Simulate Round Completion
```powershell
# Complete Round 1
.\test-championship.ps1 simulate 5 1

# Complete Round 2
.\test-championship.ps1 simulate 5 2
```

### 6. Reset Championship
```powershell
.\test-championship.ps1 reset 5
```

## Using Tinker Directly

If you prefer using PHP Tinker directly:

### 1. Start Tinker
```powershell
cd 'C:\ArunApps\Chess-Web\chess-backend'
php artisan tinker
```

### 2. Create Test Seeder Instance
```php
$seeder = new Database\Seeders\ChampionshipTestSeeder();
```

### 3. Create New Championship
```php
$champ = $seeder->createTestChampionship();
echo "Created Championship ID: {$champ->id}\n";
```

### 4. Create Championship at Stage
```php
$champ = $seeder->createChampionshipAtStage('round1_completed');
```

### 5. Simulate Round Progress
```php
// Complete Round 1 with default results
$seeder->simulateRoundProgress($champ->id, 1);

// Complete Round 2 with custom results
$results = ['win_white', 'draw', 'win_black'];
$seeder->simulateRoundProgress($champ->id, 2, $results);
```

### 6. Analyze Championship
```php
$seeder->analyzeChampionship($champ->id);
```

### 7. Reset Championship
```php
$seeder->resetChampionship($champ->id);
```

## Test Users

The seeder automatically creates/uses these test users:

| ID | Name | Email |
|----|------|-------|
| 1 | Arun Nalamara | nalamara.arun@gmail.com |
| 2 | arun babu | narun.iitb@gmail.com |
| 3 | Arun Nalamara | sanatan.dharmam@gmail.com |

## Testing Scenarios

### Scenario 1: Test Round Progression
```powershell
# Create championship
.\test-championship.ps1 create

# Note the championship ID (let's say it's 10)

# Analyze initial state
.\test-championship.ps1 analyze 10

# Complete Round 1
.\test-championship.ps1 simulate 10 1

# Analyze after Round 1
.\test-championship.ps1 analyze 10

# Complete Round 2
.\test-championship.ps1 simulate 10 2

# Analyze after Round 2
.\test-championship.ps1 analyze 10
```

### Scenario 2: Test Website UI at Different Stages
```powershell
# Create championship at Round 1 completed stage
.\test-championship.ps1 stage round1_completed

# Go to website and test:
# - My Matches page shows Round 2 matches
# - Standings show Round 1 results
# - Can start Round 2 games

# Complete Round 2
.\test-championship.ps1 simulate [ID] 2

# Test again:
# - My Matches page shows Round 3 matches
# - Standings updated with Round 2 results
```

### Scenario 3: Test Edge Cases
```powershell
# Create championship with odd number of players (3 players = 1 bye each round)
.\test-championship.ps1 create

# Analyze how byes are handled
.\test-championship.ps1 analyze [ID]

# Complete a round to see bye points awarded
.\test-championship.ps1 simulate [ID] 1

# Check standings for bye points
.\test-championship.ps1 analyze [ID]
```

### Scenario 4: Test Existing Championship 5
```powershell
# First analyze current state
.\test-championship.ps1 analyze 5

# Reset to initial state if needed
.\test-championship.ps1 reset 5

# Simulate different round completions
.\test-championship.ps1 simulate 5 1
.\test-championship.ps1 simulate 5 2
```

## Result Patterns

When simulating rounds without custom results, the seeder uses predictable patterns:

- **Round 1**: White wins even matches, Black wins odd matches
- **Round 2**: Black wins even matches, Draws odd matches
- **Round 3**: Mix of draws and wins

## Custom Results

You can specify custom results when simulating rounds:

```php
$results = ['win_white', 'draw', 'win_black'];
// win_white = White player wins
// win_black = Black player wins
// draw = Game is a draw

$seeder->simulateRoundProgress($champId, $roundNumber, $results);
```

## Database Schema Affected

The seeder operates on these tables:
- `championships` - Main championship data
- `championship_participants` - Participant registration
- `championship_matches` - Match scheduling and results
- `championship_standings` - Tournament standings
- `games` - Actual chess games
- `moves` - Game moves (mock data for testing)

## Safety Notes

- The seeder creates test championships with "Test Championship" in the title
- Use the `reset` command to safely reset test championships
- The seeder won't affect production data if it doesn't match test patterns
- Always backup your database before running extensive tests

## Troubleshooting

### PowerShell Script Issues
- Make sure you're in the correct directory: `cd 'C:\ArunApps\Chess-Web\chess-backend'`
- Run PowerShell as Administrator if needed
- Check PHP is in your PATH

### Tinker Issues
- Make sure all model classes exist
- Check database connection
- Run migrations if needed: `php artisan migrate`

### Common Errors
- **"Championship not found"** - Check the ID is correct
- **"No pending matches"** - Round may already be completed
- **"Parse error"** - Check PHP syntax in custom commands

## Best Practices

1. **Use descriptive championship names** when creating custom ones
2. **Test one scenario at a time** - reset between tests
3. **Document your test cases** - note championship IDs and what you're testing
4. **Use the analysis command frequently** to understand current state
5. **Test edge cases** - odd players, ties, incomplete rounds

## Integration with Website Testing

Use this module to:

1. **Prepare test data** before running UI tests
2. **Create specific scenarios** for automated testing
3. **Test progression logic** - how rounds advance
4. **Validate standings calculations** after each round
5. **Test user permissions** at different tournament stages
6. **Stress test** with multiple concurrent championships

This gives you complete control over championship states for comprehensive testing!