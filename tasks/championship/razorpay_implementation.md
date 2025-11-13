# Razorpay Integration Implementation Guide

## Overview
This comprehensive guide explains how Razorpay is implemented end-to-end in this SaaS platform. The implementation supports both one-time payments (lifetime plans, add-on credits) and recurring subscriptions.

## Architecture Summary

```
Frontend (React) → Backend API → Razorpay → Webhook → Database
```

**Key Components:**
- **Frontend**: React hooks for checkout flow, Razorpay SDK integration
- **Backend**: Node.js/Express API with payment processing
- **Database**: PostgreSQL with payment/credits tracking
- **Webhooks**: Real-time payment status updates

## 1. Prerequisites & Setup

### Environment Variables
```bash
# .env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Frontend .env
VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
```

### Razorpay Dashboard Setup
1. Create account at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Get API keys from Settings → API Keys
3. Create webhook endpoint: `POST https://yourdomain.com/api/billing/webhook`
4. For subscriptions: Create Plans in dashboard and note Plan IDs

### Install Dependencies
```bash
# Backend
npm install razorpay crypto
npm install drizzle-orm drizzle-kit pg

# Frontend types are already included in the lib
```

## 2. Database Schema

```sql
-- Users table (simplified)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan_code TEXT DEFAULT 'FREE',
  plan_renews_at TIMESTAMP,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL, -- created, authorized, captured, refunded, failed
  plan_code TEXT NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credits table
CREATE TABLE credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  type TEXT NOT NULL, -- plan, addon, refund
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Backend Implementation

### Payment Service (`server/payments.ts`)

```typescript
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Checkout Session
export const createCheckout = async (req, res) => {
  const { planCode, customAmount } = req.body;
  const userId = req.auth.userId;

  // Handle add-on credits
  if (planCode === "ADDON") {
    const order = await razorpay.orders.create({
      amount: Math.round(customAmount * 100), // Convert to paise
      currency: "INR",
      notes: {
        userId: userId.toString(),
        planCode: "ADDON",
        creditAmount: customAmount.toString()
      },
    });

    return res.json({
      mode: "order",
      orderId: order.id,
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: "INR"
    });
  }

  // Handle monthly subscriptions
  if (plan.interval === "month") {
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env[`RZ_PLAN_${planCode}`],
      customer_notify: 1,
      total_count: 1200,
      notes: { userId, planCode }
    });

    return res.json({
      mode: "subscription",
      subscriptionId: subscription.id,
      key: process.env.RAZORPAY_KEY_ID
    });
  }

  // Handle lifetime plans (one-time)
  const order = await razorpay.orders.create({
    amount: plan.annualPricePaise,
    currency: "INR",
    notes: { planCode, userId }
  });

  return res.json({
    mode: "order",
    orderId: order.id,
    key: process.env.RAZORPAY_KEY_ID
  });
};

// Webhook Handler
export const handleWebhook = async (req, res) => {
  const sig = req.headers["x-razorpay-signature"];
  const body = req.body;

  // Verify signature
  const expected = crypto.createHmac("sha256", process.env.RZ_WEBHOOK_SECRET)
                        .update(body).digest("hex");

  if (expected !== sig) {
    return res.sendStatus(400);
  }

  const payload = JSON.parse(body.toString());

  switch (payload.event) {
    case "payment.captured":
      await handleOneTime(payload.payload.payment.entity);
      break;
    case "subscription.charged":
      await handleSubscription(payload.payload.payment.entity);
      break;
  }

  res.json({ status: "ok" });
};
```

### API Routes Setup

```typescript
// server routes
app.post("/api/billing/checkout", authMiddleware, createCheckout);
app.post("/api/billing/webhook", handleWebhook);
```

## 4. Frontend Implementation

### Razorpay Library (`client/src/lib/razorpay.ts`)

```typescript
declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id?: string;
  subscription_id?: string;
  name: string;
  description: string;
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: { [key: string]: string };
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayOptions) {
  const scriptLoaded = await loadRazorpayScript();

  if (!scriptLoaded) {
    throw new Error("Failed to load Razorpay script");
  }

  const razorpay = new window.Razorpay(options);
  razorpay.open();
}
```

### Checkout Hook (`client/src/hooks/useCheckout.ts`)

```typescript
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useToast } from "@/hooks/use-toast";

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const checkout = async (item: Plan | { type: 'ADDON', amount: number }) => {
    if (!user) {
      // Redirect to login
      return;
    }

    setLoading(true);
    try {
      if ('code' in item) { // Plan purchase
        const response = await apiRequest("/api/billing/checkout", "POST", {
          planCode: item.code
        }).then(r => r.json());

        await openRazorpayCheckout({
          key: response.key,
          amount: item.monthlyPricePaise,
          currency: "INR",
          name: "Your Company Name",
          description: item.name,
          order_id: response.orderId,
          subscription_id: response.subscriptionId,
          notes: { planCode: item.code, userId: user.id.toString() },
          handler: () => {
            // Payment successful
            window.location.href = "/dashboard";
          },
          modal: { ondismiss: () => setLoading(false) },
        });
      } else { // Add-on credits
        const response = await apiRequest("/api/billing/checkout", "POST", {
          planCode: "ADDON",
          customAmount: item.amount
        }).then(r => r.json());

        await openRazorpayCheckout({
          key: response.key,
          order_id: response.orderId,
          amount: item.amount * 100, // Convert to paise
          currency: "INR",
          name: "Your Company Name",
          description: "Add-on Credits",
          handler: () => {
            toast({ title: "Purchase successful!" });
            // Refresh credits
          },
          modal: { ondismiss: () => setLoading(false) },
        });
      }
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return { handleCheckout: checkout, loading };
}
```

### Usage in Components

```typescript
// In your pricing/checkout component
const { handleCheckout, loading } = useCheckout();

const handlePurchase = (plan: Plan) => {
  handleCheckout(plan);
};

// For add-on credits
const handleAddOn = (amount: number) => {
  handleCheckout({ type: 'ADDON', amount });
};
```

## 5. Payment Flow

### One-Time Payment Flow
1. User clicks "Buy Now" → Frontend calls `/api/billing/checkout`
2. Backend creates Razorpay Order → Returns `orderId`
3. Frontend opens Razorpay Checkout with `order_id`
4. User completes payment → Razorpay sends webhook
5. Webhook updates database → User gets credits/plan

### Subscription Payment Flow
1. User selects monthly plan → Backend creates subscription
2. Frontend opens checkout with `subscription_id`
3. User authorizes → Subscription activated
4. Monthly charges → Razorpay sends `subscription.charged` webhook
5. Each webhook updates user plan & credits

### Add-on Credits Flow
1. User enters credit amount → Backend creates order for that amount
2. Payment processed → Credits added to user account
3. Credits tracked separately from plan credits

## 6. Key Implementation Details

### Security
- **Webhook Signature Verification**: Always verify Razorpay webhook signatures
- **User Authentication**: Protect checkout endpoints with JWT/auth middleware
- **Input Validation**: Validate all inputs with schemas (Zod)

### Error Handling
- Duplicate subscription prevention
- Payment failure handling
- Webhook retry logic
- Graceful fallbacks

### Best Practices
- **Transaction Safety**: Use database transactions for payment processing
- **Idempotency**: Handle duplicate webhook events
- **Logging**: Comprehensive payment logging for debugging
- **Testing**: Use Razorpay test mode extensively

## 7. Testing

### Test Environment
```bash
# Use Razorpay test credentials
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=test_secret
```

### Test Cards
- **Visa**: 4111 1111 1111 1111
- **Mastercard**: 5555 5555 5555 4444
- Any future expiry date, any random CVV

### Webhook Testing
Use Razorpay's webhook testing tools or `ngrok` for local testing:
```bash
ngrok http 5000
# Use ngrok URL in Razorpay webhook settings
```

## 8. Production Checklist

- [ ] Switch to live Razorpay credentials
- [ ] Configure webhook endpoint in production
- [ ] Set up proper error monitoring
- [ ] Test end-to-end payment flow
- [ ] Set up subscription management UI
- [ ] Configure email notifications for payments
- [ ] Test refund flows
- [ ] Set up payment analytics/dashboard

## 9. File References from Current Implementation

### Core Files
- `client/src/lib/razorpay.ts` - Razorpay frontend utilities
- `client/src/hooks/useCheckout.ts` - Checkout React hook
- `server/payments.ts` - Backend payment processing
- `shared/schema.ts` - Database schemas (payments, credits, users)

### Database Migrations
- `migrations/0008_add_razorpay_key_to_plans.sql` - Razorpay integration setup
- `migrations/0011_plan_pricing_configuration.sql` - Plan pricing structure

### Environment Configuration
- `.env.example` - Environment variable templates
- `.env.production.example` - Production environment setup

### API Endpoints
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/webhook` - Razorpay webhook handler

This implementation provides a complete, production-ready Razorpay integration that handles multiple payment types, maintains security, and provides a smooth user experience.