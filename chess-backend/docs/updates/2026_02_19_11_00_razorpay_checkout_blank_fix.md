# Fix: Razorpay Checkout Blank Form

**Date**: 2026-02-19
**Type**: Bug Fix
**Scope**: Backend + Frontend

## Problem

When users clicked Subscribe on chess99.com, the Razorpay checkout form rendered blank/empty with no customer information pre-filled.

## Root Causes

1. **Missing `prefill` data in Razorpay options** — `openRazorpayModal` in `RazorpayCheckout.jsx` did not pass `prefill: { name, email }` to the Razorpay checkout options. Without prefill, Razorpay opens a blank form requiring users to manually enter all details.

2. **Backend didn't return user data** — `SubscriptionService::createRazorpayCheckout()` returned `subscription_id` and `key_id` but no user details for the frontend to use in the checkout form.

3. **Duplicate SDK script loading** — `loadRazorpaySDK` always appended a new `<script>` tag without checking if the Razorpay SDK was already loaded, potentially causing conflicts on retry.

## Changes

### Backend
- **`app/Services/SubscriptionService.php`** — Added `prefill` block with `name` and `email` to the `createRazorpayCheckout()` return data

### Frontend
- **`src/components/subscription/RazorpayCheckout.jsx`**:
  - Added `useAuth` import to access user data as fallback
  - `loadRazorpaySDK`: Added check for `window.Razorpay` (reuse if loaded) and existing script tag detection (avoid duplicates)
  - `openRazorpayModal`: Added `prefill: { name, email }` to Razorpay options, sourced from backend response with user context fallback

## Verification
- Frontend builds with no errors
- Razorpay options now include prefill data from two sources (backend primary, AuthContext fallback)
