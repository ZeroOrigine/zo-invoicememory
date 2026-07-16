// lib/stripe.ts
//
// COMPATIBILITY SHIM. The canonical Stripe stack lives in lib/stripe/*
// (client, config, checkout, portal, webhooks) using the STRIPE_PRICE_*_MONTHLY
// / _YEARLY env convention. This shim keeps any legacy `@/lib/stripe` import
// compiling while guaranteeing there is exactly ONE Stripe singleton and ONE
// price-ID convention in the codebase. Do not add logic here.

import 'server-only'

export { getStripe } from '@/lib/stripe/client'
import { getPriceId, planFromPriceId } from '@/lib/stripe/checkout'

export type PaidPlan = 'pro' | 'business'

/** Legacy name — resolves the MONTHLY price for a paid plan. */
export function getPriceIdForPlan(plan: PaidPlan): string | null {
  return getPriceId(plan, 'monthly')
}

/** Legacy name — maps any known price ID back to our plan enum. */
export function getPlanForPriceId(priceId: string): PaidPlan | null {
  return planFromPriceId(priceId)
}
