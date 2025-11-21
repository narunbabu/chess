# Championship Validation Guide

## Overview
This guide explains the validation rules for championship creation and updates in the Chess Web application.

## Custom Validation Rules

### `even` Rule
- **Purpose:** Validates that a number is even
- **Usage:** `'field' => 'even'`
- **Valid:** 2, 4, 6, 8, 10, 12...
- **Invalid:** 1, 3, 5, 7, 9, 11...
- **Error Message:** "The {field} must be an even number."

### `power_of_two` Rule
- **Purpose:** Validates that a number is a power of 2
- **Usage:** `'field' => 'power_of_two'`
- **Valid:** 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024
- **Invalid:** 3, 5, 6, 7, 9, 10, 12, 15...
- **Error Message:** "The {field} must be a power of 2 (2, 4, 8, 16, 32, 64)."

## Championship Creation Validation

### Required Fields
```json
{
  "title": "string (3-255 chars)",
  "entry_fee": "number (0-10000)",
  "registration_deadline": "datetime (after:now, before:start_date)",
  "start_date": "datetime (after:registration_deadline)",
  "match_time_window_hours": "integer (1-168)",
  "format": "swiss_only | elimination_only | hybrid"
}
```

### Optional Fields
```json
{
  "description": "string (max 5000 chars) | null",
  "max_participants": "integer (2-1024) | null",
  "time_control_minutes": "integer (1-180) | null",
  "time_control_increment": "integer (0-60) | null",
  "total_rounds": "integer (1-20) | null",
  "organization_id": "integer (exists in organizations) | null",
  "visibility": "public | private | organization | null",
  "allow_public_registration": "boolean | null"
}
```

### Format-Specific Rules

#### Swiss Only Format
```json
{
  "format": "swiss_only",
  "swiss_rounds": "integer (1-20) - REQUIRED",
  "top_qualifiers": null,
  "max_participants": "any integer (2-1024)"
}
```

#### Elimination Only Format
```json
{
  "format": "elimination_only",
  "swiss_rounds": null,
  "top_qualifiers": null,
  "max_participants": "MUST be power of 2 (2, 4, 8, 16, 32, 64...)"
}
```

#### Hybrid Format
```json
{
  "format": "hybrid",
  "swiss_rounds": "integer (3-20) - REQUIRED, minimum 3 for proper qualification",
  "top_qualifiers": "integer (2-64) - REQUIRED, MUST be even AND power of 2",
  "max_participants": "any integer (2-1024)"
}
```

## Validation Examples

### ✅ Valid Swiss Championship
```json
{
  "title": "Spring Swiss 2025",
  "description": "Casual Swiss tournament",
  "entry_fee": 100,
  "max_participants": 50,
  "registration_deadline": "2025-12-01T00:00",
  "start_date": "2025-12-08T00:00",
  "match_time_window_hours": 72,
  "time_control_minutes": 10,
  "time_control_increment": 5,
  "total_rounds": 5,
  "format": "swiss_only",
  "swiss_rounds": 5,
  "top_qualifiers": null,
  "visibility": "public",
  "allow_public_registration": true
}
```

### ✅ Valid Elimination Championship
```json
{
  "title": "Knockout Championship 2025",
  "entry_fee": 500,
  "max_participants": 64,
  "registration_deadline": "2025-12-01T00:00",
  "start_date": "2025-12-08T00:00",
  "match_time_window_hours": 48,
  "format": "elimination_only",
  "swiss_rounds": null,
  "top_qualifiers": null,
  "visibility": "public"
}
```

### ✅ Valid Hybrid Championship
```json
{
  "title": "Grand Prix 2025",
  "entry_fee": 1000,
  "max_participants": 100,
  "registration_deadline": "2025-12-01T00:00",
  "start_date": "2025-12-08T00:00",
  "match_time_window_hours": 72,
  "format": "hybrid",
  "swiss_rounds": 5,
  "top_qualifiers": 8,
  "visibility": "public"
}
```

### ❌ Invalid Examples

#### Invalid: top_qualifiers not even
```json
{
  "format": "hybrid",
  "swiss_rounds": 5,
  "top_qualifiers": 7  // ❌ Must be even
}
```
**Error:** "The top_qualifiers must be an even number."

#### Invalid: top_qualifiers not power of 2
```json
{
  "format": "hybrid",
  "swiss_rounds": 5,
  "top_qualifiers": 6  // ❌ Even but not power of 2
}
```
**Error:** "The top_qualifiers must be a power of 2 (2, 4, 8, 16, 32, 64)."

#### Invalid: max_participants for elimination
```json
{
  "format": "elimination_only",
  "max_participants": 50  // ❌ Not power of 2
}
```
**Error:** "Max participants must be a power of 2 for elimination tournaments"

#### Invalid: Missing required fields for hybrid
```json
{
  "format": "hybrid",
  "swiss_rounds": null,  // ❌ Required
  "top_qualifiers": null  // ❌ Required
}
```
**Errors:**
- "Swiss rounds are required for Swiss and Hybrid formats"
- "Top qualifiers are required for Hybrid format"

#### Invalid: Swiss rounds too few for hybrid
```json
{
  "format": "hybrid",
  "swiss_rounds": 2,  // ❌ Minimum 3 for hybrid
  "top_qualifiers": 8
}
```
**Error:** "Hybrid tournaments should have at least 3 Swiss rounds for proper qualification"

## Update Validation

Championship updates follow the same validation rules with these additional restrictions:

### Active Championships Cannot Change:
- `format`
- `swiss_rounds`
- `top_qualifiers`
- `entry_fee`
- Cannot reduce `max_participants` below current participant count

### Championships with Paid Participants:
- Cannot move `start_date` earlier

## Testing Your Payload

Use this PowerShell command to test validation:

```powershell
cd C:\ArunApps\Chess-Web\chess-backend
php artisan tinker
```

Then in Tinker:
```php
use App\Validators\ChampionshipValidator;

$data = [
    'title' => 'Test Championship',
    'entry_fee' => 100,
    'max_participants' => 32,
    'registration_deadline' => '2025-12-01T00:00',
    'start_date' => '2025-12-08T00:00',
    'match_time_window_hours' => 72,
    'format' => 'swiss_only',
    'swiss_rounds' => 5,
    'top_qualifiers' => null,
];

try {
    $validated = ChampionshipValidator::validateCreate($data);
    echo "✅ Validation passed!\n";
} catch (\Illuminate\Validation\ValidationException $e) {
    echo "❌ Validation failed:\n";
    print_r($e->errors());
}
```

## Quick Reference Table

| Format | swiss_rounds | top_qualifiers | max_participants |
|--------|--------------|----------------|------------------|
| swiss_only | Required (1-20) | Must be null | Any (2-1024) |
| elimination_only | Must be null | Must be null | Power of 2 only |
| hybrid | Required (≥3) | Required (even + power of 2) | Any (2-1024) |

## Valid top_qualifiers Values for Hybrid

Only these values are valid for `top_qualifiers` in hybrid format:
- 2, 4, 8, 16, 32, 64

These are both even AND powers of 2.
