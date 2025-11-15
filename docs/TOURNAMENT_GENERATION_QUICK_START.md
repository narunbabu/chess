# Tournament Generation Quick Start Guide

## 🚀 For Admins - How to Use

### Option 1: Quick Generate with Preset (Recommended)

**Step 1**: Create a championship and register participants

**Step 2**: Preview the tournament structure
```bash
GET /api/championships/{id}/tournament-preview?preset=small_tournament

# Presets available:
# - small_tournament (3-10 participants)
# - medium_tournament (11-30 participants)
# - large_tournament (>30 participants)
```

**Step 3**: Generate all rounds with one click
```bash
POST /api/championships/{id}/generate-full-tournament
{
  "preset": "small_tournament"
}
```

✅ **Done!** All rounds are now created.

---

### Option 2: Custom Configuration (Advanced)

**Step 1**: Create custom configuration
```json
{
  "config": {
    "mode": "progressive",
    "round_structure": [
      {
        "round": 1,
        "type": "dense",
        "participant_selection": "all",
        "matches_per_player": 3,
        "pairing_method": "random_seeded"
      },
      {
        "round": 2,
        "type": "selective",
        "participant_selection": {"top_k": 6},
        "matches_per_player": 2,
        "pairing_method": "standings_based"
      },
      {
        "round": 3,
        "type": "final",
        "participant_selection": {"top_k": 2},
        "matches_per_player": 1,
        "pairing_method": "direct"
      }
    ],
    "avoid_repeat_matches": true,
    "color_balance_strict": true
  }
}
```

**Step 2**: Preview your custom configuration
```bash
POST /api/championships/{id}/tournament-preview
{
  "config": {...}  // Your custom config
}
```

**Step 3**: Generate
```bash
POST /api/championships/{id}/generate-full-tournament
{
  "config": {...}  // Your custom config
}
```

---

## 🎯 Common Scenarios

### Scenario 1: Small Tournament (3 participants, 5 rounds)

**What you want**:
- Round 1: Each player plays 2 matches
- Round 2: Each player plays 1 match
- Rounds 3-4: Top players only
- Round 5: Final between top 2

**API Call**:
```bash
POST /api/championships/123/generate-full-tournament
{
  "preset": "small_tournament"
}
```

**Result**:
```
Round 1: 3 matches (P1 vs P2, P1 vs P3, P2 vs P3)
Round 2: 3 matches (same pairs, reversed colors)
Round 3: 3 matches (top 3 players)
Round 4: 2 matches (top 3 players)
Round 5: 1 match (top 2 final)
Total: 12 matches
```

---

### Scenario 2: Medium Tournament (12 participants, 5 rounds)

**What you want**:
- Early rounds: Each player faces multiple opponents
- Middle rounds: Filter to top performers
- Late rounds: Only top players
- Final: Championship match

**API Call**:
```bash
POST /api/championships/456/generate-full-tournament
{
  "preset": "medium_tournament"
}
```

**Result**:
```
Round 1: 30 matches (each plays 5 opponents)
Round 2: 18 matches (each plays 3 opponents)
Round 3: 8 matches (top 6, each plays 2-3)
Round 4: 6 matches (top 4)
Round 5: 1 match (top 2 final)
Total: 63 matches
```

---

### Scenario 3: Need to Regenerate?

**If you made a mistake or want to change the structure**:

```bash
POST /api/championships/123/generate-full-tournament
{
  "preset": "medium_tournament",
  "force_regenerate": true
}
```

⚠️ **Warning**: This deletes ALL existing matches and creates new ones!

---

## 📋 Configuration Reference

### Participant Selection Options

```json
// All registered participants
"participant_selection": "all"

// Top K participants by standings
"participant_selection": {"top_k": 6}

// Top N% participants
"participant_selection": {"top_percent": 50}
```

### Round Types

- `"dense"` - Many matches per player (early rounds)
- `"normal"` - Standard match density
- `"selective"` - Only top players (middle rounds)
- `"final"` - Championship match (last round)

### Pairing Methods

- `"random"` - Completely random
- `"random_seeded"` - Random within rating pools
- `"rating_based"` - By rating proximity
- `"standings_based"` - By current standings (use for rounds 2+)
- `"direct"` - Direct pairing (finals only, exactly 2 players)
- `"swiss"` - Traditional Swiss system

### Match Density

```json
"matches_per_player": 1  // Each player plays 1 opponent
"matches_per_player": 2  // Each player plays 2 opponents
"matches_per_player": 5  // Each player plays 5 opponents
```

---

## 🐛 Troubleshooting

### Error: "Tournament has already been generated"

**Problem**: You're trying to generate when tournament already exists

**Solution**: Use `force_regenerate: true`
```json
{
  "preset": "small_tournament",
  "force_regenerate": true
}
```

---

### Error: "Not enough eligible participants"

**Problem**: Less than 2 participants registered

**Solution**: Register more participants before generating

---

### Error: "Invalid configuration"

**Problem**: Your custom configuration is missing required fields

**Solution**: Check that each round has:
- `round` (number)
- `type` (string)
- `participant_selection` (string or object)
- `matches_per_player` (number ≥ 1)
- `pairing_method` (string)

---

## ✅ Checklist

Before generating a tournament:

- [ ] Championship created
- [ ] At least 2 participants registered
- [ ] Total rounds set (e.g., 5)
- [ ] Preset selected OR custom config prepared
- [ ] Preview checked (optional but recommended)

After generating:

- [ ] Check summary in response
- [ ] Verify all rounds created
- [ ] Check match counts per round
- [ ] Start the tournament!

---

## 📞 Need Help?

See full documentation: `FULL_TOURNAMENT_GENERATION_SYSTEM.md`

---

**Quick Tips**:
- 🎯 Use presets for most cases (small/medium/large)
- 👀 Always preview before generating
- 🔄 Use regenerate if you need to change structure
- 📊 Check the summary response to verify matches created
- ⚡ It's fast - all rounds generated in <2 seconds!

**Created**: November 14, 2025
