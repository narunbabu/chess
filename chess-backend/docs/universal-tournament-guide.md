# Universal Tournament Structure Guide

## Overview

The Universal Tournament Structure system provides automatic, optimal tournament configuration for 3-100 participants. It implements a standardized "Swiss + Cut + Finals" pattern with fair tiebreak resolution based on official chess tournament criteria.

## How It Works

### Structure Pattern
For tournaments with 3-100 participants, the system automatically generates a 5-round structure:

1. **Rounds 1-3**: Swiss qualification (all participants)
2. **Round 4**: Contender round (top K4 participants)
3. **Round 5**: Final (top 2 participants)

### K4 Calculation Formula
The number of participants in Round 4 (K4) is automatically calculated:

- **3-4 players**: K4 = 3
- **5-12 players**: K4 = 4
- **13-24 players**: K4 = 6
- **25-48 players**: K4 = 8
- **49+ players**: K4 = 12

## For Tournament Organizers

### Creating a Tournament

#### Basic Automatic Structure
```json
POST /api/championships
{
  "title": "My Tournament",
  "max_participants": 16,
  "format": "swiss_only",
  "total_rounds": 5,
  "structure_type": "universal"
}
```

#### Advanced Configuration
```json
POST /api/championships
{
  "title": "Advanced Tournament",
  "max_participants": 24,
  "format": "swiss_only",
  "total_rounds": 5,
  "structure_type": "universal",
  "use_universal_structure": true,
  "k4_override": 8,
  "tiebreak_options": {
    "expand_band_for_ties": true,
    "playoff_for_first_place": false
  }
}
```

### Structure Types

#### 1. Universal Structure (Recommended)
- **When to use**: 3-100 participants
- **Benefits**: Automatic optimal configuration, fair tiebreaks
- **Pattern**: Swiss + Cut + Finals
- **Example**: 16 players → K4=6 → Final 2

#### 2. Preset Structure
- **When to use**: Large tournaments (>100) or special requirements
- **Benefits**: Flexible, customizable
- **Pattern**: Progressive reduction or custom
- **Example**: 150 players → Manual configuration

#### 3. Custom Structure
- **When to use**: Unique tournament formats
- **Benefits**: Complete control
- **Pattern**: Whatever you design
- **Example**: Special elimination bracket

### Tournament Examples

#### 3 Players (Special Case)
```
Round 1: All 3 players, complete round-robin (3 matches)
Round 2: All 3 players, Swiss style (3 matches)
Round 3: Top 3, coverage pairs [[1,2],[2,3]] (2 matches)
Round 4: Top 3, coverage pairs [[1,3],[2,3]] (2 matches)
Round 5: Top 2, final (1 match)
Total: 11 matches
```

#### 8 Players
```
Round 1: All 8 players, Swiss (4 matches)
Round 2: All 8 players, Swiss (4 matches)
Round 3: All 8 players, Swiss (4 matches)
Round 4: Top 4 players, Swiss (2 matches)
Round 5: Top 2 players, final (1 match)
Total: 15 matches
```

#### 16 Players
```
Round 1: All 16 players, Swiss (8 matches)
Round 2: All 16 players, Swiss (8 matches)
Round 3: All 16 players, Swiss (8 matches)
Round 4: Top 6 players, Swiss (3 matches)
Round 5: Top 2 players, final (1 match)
Total: 28 matches
```

#### 64 Players
```
Round 1: All 64 players, Swiss (32 matches)
Round 2: All 64 players, Swiss (32 matches)
Round 3: All 64 players, Swiss (32 matches)
Round 4: Top 12 players, Swiss (6 matches)
Round 5: Top 2 players, final (1 match)
Total: 103 matches
```

## Tiebreak System

### Standard Tiebreak Order
1. **Points** - Tournament score (1 = win, 0.5 = draw)
2. **Buchholz** - Sum of all opponents' scores
3. **Sonneborn-Berger** - Sum of defeated opponents' scores + 0.5 × drawn opponents' scores
4. **Head-to-Head** - Direct result between tied players
5. **Rating** - Pre-tournament rating
6. **Random** - Deterministic random (last resort)

### Band Expansion
When enabled, tournaments include all players tied at cutoff positions:

**Example**: Top-3 selection with 2 players tied at 3rd place
- **Without expansion**: Select top 3 (2 players advance)
- **With expansion**: Select top 3 + tied players (4 players advance)

## Admin Controls

### Structure Management
```http
PUT /api/admin/championships/{id}/structure
{
  "structure_type": "universal",
  "use_universal_structure": true,
  "k4_override": 8
}
```

### Tiebreak Configuration
```http
PUT /api/admin/championships/{id}/tiebreak
{
  "tiebreak_order": ["points", "buchholz_score", "sonneborn_berger"],
  "expand_band_for_ties": true,
  "playoff_for_first_place": false
}
```

### Structure Preview
```http
POST /api/admin/championships/{id}/preview
{
  "participant_count": 24,
  "structure_type": "universal"
}
```

### Configuration Regeneration
```http
POST /api/admin/championships/{id}/regenerate
```

### Analytics
```http
GET /api/admin/championships/{id}/analytics
```

## API Integration

### Creating Tournaments
```php
// Basic universal tournament
$championship = Championship::create([
    'title' => 'Monthly Championship',
    'max_participants' => 16,
    'format' => 'swiss_only',
    'structure_type' => 'universal',
    'use_universal_structure' => true,
]);

// Auto-generate configuration
$config = $championship->generateAutomaticTournamentConfig();
```

### Getting Structure Information
```php
// Get recommended structure
$structure = $championship->getRecommendedTournamentStructure();

// Get detailed explanation
$explanation = $championship->getStructureExplanation();

// Check if universal should be used
$shouldUseUniversal = $championship->shouldUseUniversalStructure();
```

### Participant Selection
```php
// Get top K participants for finals
$finalists = $championship->getTopKParticipants(4, [
    'expand_band_for_ties' => true
]);

// Get resolved standings
$standings = $championship->getResolvedStandings();
```

## Migration Guide

### For Existing Tournaments

1. **Automatic Migration**: The system automatically migrates eligible tournaments
2. **Manual Activation**: Admin can enable universal structure per tournament
3. **Gradual Rollout**: Can be enabled globally or per-tournament

### Migration Criteria
- **Eligible**: 3-100 participants, not completed, created after implementation date
- **Preserved**: Existing tournaments continue with current structure
- **Fallback**: Large tournaments (>100) use preset system

## Benefits

### For Organizers
- **Zero Configuration**: Automatic optimal structure generation
- **Fair Play**: Official chess tiebreak criteria
- **Scalable**: Works for any size within range
- **Transparent**: Clear structure explanations

### For Players
- **Consistent Experience**: Predictable tournament progression
- **Fair Rankings**: Standardized tiebreak resolution
- **Clear Path**: Understanding advancement requirements

### For Platform
- **Reduced Support**: Fewer configuration questions
- **Standardization**: Consistent tournament quality
- **Maintenance**: Centralized logic updates

## Troubleshooting

### Common Issues

#### Structure Not Generated
**Problem**: Tournament shows as preset instead of universal
**Solution**: Check participant count (3-100 required) and tournament status

#### K4 Calculation Wrong
**Problem**: K4 value seems incorrect
**Solution**: Verify formula: N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12

#### Tiebreaks Not Working
**Problem**: Rankings don't seem fair
**Solution**: Ensure standings are calculated and Buchholz/SB scores are present

### Support
- Check tournament analytics: `GET /api/admin/championships/{id}/analytics`
- Verify structure preview before changes
- Use regeneration for configuration issues

## Best Practices

### Tournament Creation
1. **Use Universal**: Enable for 3-100 participants
2. **Set Realistic Limits**: Match max_participants to expected turnout
3. **Configure Tiebreaks**: Enable band expansion for fairness
4. **Preview Structure**: Test before finalizing

### Management
1. **Monitor Analytics**: Regular tournament health checks
2. **Update Configuration**: Regenerate when participant count changes significantly
3. **Document Changes**: Keep records of structure modifications
4. **Communicate**: Explain tournament structure to participants

### Performance
1. **Optimize for Size**: Use universal for optimal performance
2. **Regular Cleanup**: Remove old tournament data
3. **Monitor Resources**: Watch database performance with large tournaments
4. **Cache Results**: Store calculated structures for reuse

## Future Enhancements

### Planned Features
- **Adaptive Structures**: Dynamic adjustment based on actual participants
- **Multi-Stage Tournaments**: Complex qualification systems
- **Custom Tiebreak Rules**: Organization-specific policies
- **Tournament Templates**: Pre-defined structures for common formats

### Extension Points
- **Custom Pairing Algorithms**: Integration with external pairing systems
- **Advanced Analytics**: Performance metrics and predictions
- **Integration APIs**: Third-party tournament management systems
- **Mobile Apps**: Native tournament organization applications