# Validation Error Fix - Custom Laravel Validation Rules

## Problem
Error: `Method Illuminate\Validation\Validator::validateEven does not exist`

This error occurred because the `ChampionshipValidator.php` was using custom validation rules (`even` and `power_of_two`) that weren't registered in Laravel.

## Solution
Added custom validation rules to `app/Providers/AppServiceProvider.php`

### Changes Made

#### 1. Updated AppServiceProvider.php

**Added Import:**
```php
use Illuminate\Support\Facades\Validator;
```

**Added Method Call in `boot()`:**
```php
// Register custom validation rules
$this->registerCustomValidationRules();
```

**Added New Method:**
```php
/**
 * Register custom validation rules
 */
protected function registerCustomValidationRules(): void
{
    // Validate that a value is an even number
    Validator::extend('even', function ($attribute, $value, $parameters, $validator) {
        return is_numeric($value) && $value % 2 === 0;
    });

    // Validate that a value is a power of two
    Validator::extend('power_of_two', function ($attribute, $value, $parameters, $validator) {
        if (!is_numeric($value) || $value <= 0) {
            return false;
        }
        // A number is a power of 2 if it has only one bit set
        // Example: 2 (10), 4 (100), 8 (1000), 16 (10000)
        return ($value & ($value - 1)) === 0;
    });

    // Custom error messages
    Validator::replacer('even', function ($message, $attribute, $rule, $parameters) {
        return str_replace(':attribute', $attribute, 'The :attribute must be an even number.');
    });

    Validator::replacer('power_of_two', function ($message, $attribute, $rule, $parameters) {
        return str_replace(':attribute', $attribute, 'The :attribute must be a power of 2 (2, 4, 8, 16, 32, 64).');
    });
}
```

## How It Works

### `even` Validation Rule
- Checks if a number is even (divisible by 2)
- Used for: `top_qualifiers` in hybrid championships
- Example: 2, 4, 6, 8, 10 ✅ | 3, 5, 7, 9 ❌

### `power_of_two` Validation Rule
- Checks if a number is a power of 2 (2, 4, 8, 16, 32, 64, etc.)
- Uses bitwise operation: `(n & (n - 1)) === 0`
- Used for: `max_participants` in elimination tournaments, `top_qualifiers` in hybrid championships
- Example: 2, 4, 8, 16, 32, 64 ✅ | 3, 5, 6, 7, 9, 10 ❌

## Usage in Championship Validator

### Championship Creation
```php
'max_participants' => 'nullable|integer|min:2|max:1024|power_of_two',
'top_qualifiers' => 'required_if:format,hybrid|integer|min:2|max:64|even|power_of_two',
```

### Business Rules
1. **Elimination tournaments**: `max_participants` must be a power of 2 (for bracket structure)
2. **Hybrid tournaments**: `top_qualifiers` must be both even AND a power of 2

## Testing
Created and ran validation tests confirming:
- ✅ Even number validation working
- ✅ Power of 2 validation working
- ✅ Combined validation (even + power_of_two) working
- ✅ Custom error messages displaying correctly

## Commands Run
```bash
php artisan config:clear
php artisan cache:clear
```

## Files Modified
1. ✅ `app/Providers/AppServiceProvider.php` - Added custom validation rules

## Files Using These Rules
- `app/Validators/ChampionshipValidator.php` - Championship validation logic

## Additional Fixes

### Issue 2: Validation Applied to Null Values
**Problem:** Validation rules were being applied even when fields were `null`, causing failures for swiss_only format.

**Solution:** Added `nullable` modifier to conditional validation rules:
```php
'swiss_rounds' => 'required_if:format,swiss_only,hybrid|nullable|integer|min:1|max:20',
'top_qualifiers' => 'required_if:format,hybrid|nullable|integer|min:2|max:64|even|power_of_two',
```

### Issue 3: Missing Field Validations
**Problem:** Frontend was sending fields that weren't validated: `time_control_minutes`, `time_control_increment`, `total_rounds`, `visibility`, `allow_public_registration`.

**Solution:** Added validation rules for all championship fields:
```php
'time_control_minutes' => 'nullable|integer|min:1|max:180',
'time_control_increment' => 'nullable|integer|min:0|max:60',
'total_rounds' => 'nullable|integer|min:1|max:20',
'organization_id' => 'nullable|integer|exists:organizations,id',
'visibility' => 'nullable|string|in:public,private,organization',
'allow_public_registration' => 'nullable|boolean',
```

### Issue 4: max_participants Power of 2 Check
**Problem:** `power_of_two` validation was applied to ALL formats, but should only apply to elimination tournaments.

**Solution:** Removed `power_of_two` from base validation rules. Format-specific validation in `validateFormatSpecificRules()` already handles this correctly for elimination_only format.

### Issue 5: WRONG VALIDATION CLASS BEING USED
**Problem:** The `ChampionshipController` was NOT using the `ChampionshipValidator` class at all! It had its own inline validation rules with the same problems:
```php
// In ChampionshipController.php line 175:
'top_qualifiers' => 'required_if:format,hybrid|integer|min:2|max:64|even'
```

**Solution:** Fixed the ChampionshipController validation rules:
1. **Removed complex validation** from base rules in both `store()` and `update()` methods:
```php
// Before:
'top_qualifiers' => 'required_if:format,hybrid|integer|min:2|max:64|even'
'swiss_rounds' => 'required_if:format,swiss_only,hybrid|integer|min:1|max:20'

// After:
'top_qualifiers' => 'nullable|integer'
'swiss_rounds' => 'nullable|integer|min:1|max:20'
```

2. **Added format-specific validation logic** using `$validator->after()` callback that:
   - For `hybrid`: Requires `top_qualifiers` (even + power of 2) and `swiss_rounds`
   - For `swiss_only`: Requires `swiss_rounds` only
   - For `elimination_only`: Requires `max_participants` to be power of 2
   - For all other formats: No validation on `top_qualifiers` (allows `null`)

## Validation Test Results

✅ **Swiss Only Format** - Passes with `top_qualifiers: null` and any `max_participants`
✅ **Hybrid Format** - Requires `top_qualifiers` (even AND power of 2)
✅ **Elimination Format** - Requires `max_participants` to be power of 2
✅ **All Fields** - Properly validated with correct types and ranges

## Status
✅ **COMPLETELY FIXED** - All validation issues resolved
- Custom validation rules registered
- Nullable fields handled correctly
- Format-specific rules working properly
- All championship fields validated
- **Duplicate validation rules eliminated**
- **Swiss Only format now works with top_qualifiers: null**
- **✅ ChampionshipController fixed (was using wrong validation rules)**
- **✅ Both store() and update() methods fixed**

## Root Cause Summary
The validation error was caused by the `ChampionshipController` using its own inline validation rules instead of the `ChampionshipValidator` class. The controller had `required_if:format,hybrid` validation being applied even when `format` was `swiss_only` and `top_qualifiers` was `null`.
