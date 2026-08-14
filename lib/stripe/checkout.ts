import 'server-only'

import type Stripe from 'stripe'
import { getStripe, getAppUrl } from './client'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { BillingInterval, PlanId } from './config'

// PATCHED: (1) success/cancel URLs now point at pages that actually render
// the banners (/dashboard shows the success celebration, /billing is the
// canonical billing page); (2) metadata carries BOTH `supabase_user_id` and
// `user_id` keys so every webhook consumer past or future attributes users.

type PaidPlan = Exclude<PlanId, 'free'>

export function getPriceId(plan: PaidPlan, interval: BillingInterval): string | null {
  const map: Record<string, string | undefined> = {
    'pro:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'pro:yearly': process.env.STRIPE_PRICE_PRO_YEARLY,
    'business:monthly': process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    'business:yearly': process.env.STRIPE_PRICE_BUSINESS_YEARLY,
  }
  return map[`${plan}:${interval}`] ?? null
}

/** Reverse lookup used by webhook handlers to map a Stripe price to our plan enum. */
export function planFromPriceId(priceId: string | undefined | null): PaidPlan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY) return 'business'
  if (priceId === process.env.STRIPE_PRICE_BUSINESS_YEARLY) return 'business'
  return null
}

/**
 * Find (or create) the Stripe customer for a Supabase user and persist the
 * mapping on the user's subscriptions row (service role — users cannot write
 * billing tables, by schema design).
 */
export async function getOrCreateStripeCustomer(userId: string, email?: string): Promise<string> {
  const admin = getSupabaseAdmin()

  const { data: existing, error: readError } = await admin
    .from('invoicememory_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (readError) {
    throw new Error(`Failed to read subscription row for user ${userId}: ${readError.message}`)
  }
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    metadata: { product: 'invoicememory', supabase_user_id: userId, user_id: userId },
  })

  const { error: writeError } = await admin
    .from('invoicememory_subscriptions')
    .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: 'user_id' })

  if (writeError) {
    throw new Error(`Failed to persist Stripe customer for user ${userId}: ${writeError.message}`)
  }

  return customer.id
}

/**
 * Create a subscription Checkout Session.
 * HONESTY: no trial_period_days configured — button copy must match: an
 * immediate charge, "Upgrade to Pro — $29/mo", never "Start Trial".
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  opts?: { email?: string; plan?: PaidPlan }
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const appUrl = getAppUrl()
  const customerId = await getOrCreateStripeCustomer(userId, opts?.email)

  const metadata = {
    supabase_user_id: userId,
    user_id: userId,
    ...(opts?.plan ? { plan: opts.plan } : {}),
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    client_reference_id: userId,
    // The dashboard renders the success celebration; /billing handles cancel.
    success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing?checkout=canceled`,
    metadata,
    subscription_data: { metadata },
  })
}
