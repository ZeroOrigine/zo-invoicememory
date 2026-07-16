import 'server-only'

import type Stripe from 'stripe'
import { getStripe } from './client'
import { planFromPriceId } from './checkout'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Stripe webhook EVENT HANDLERS. Signature verification happens in the API
// route (app/api/webhooks/stripe/route.ts) BEFORE anything here runs — this
// module only ever receives verified events.
//
// All writes use the service-role client: the schema revokes billing-table
// writes from users entirely. Handlers are idempotent (upserts keyed on
// unique columns) because Stripe retries and can deliver events out of order.
// We never store card details — only Stripe IDs, statuses and amounts.
// ---------------------------------------------------------------------------

// Mirrors public.subscription_status exactly (schema §1).
const SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
])

async function resolveUserId(
  customerId: string | null,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  if (metadata?.supabase_user_id) return metadata.supabase_user_id
  if (!customerId) return null

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('invoicememory_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (data?.user_id) return data.user_id

  // Last resort: the customer object itself carries our metadata.
  try {
    const customer = await getStripe().customers.retrieve(customerId)
    if (!customer.deleted && customer.metadata?.supabase_user_id) {
      return customer.metadata.supabase_user_id
    }
  } catch {
    /* fall through */
  }
  return null
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const admin = getSupabaseAdmin()
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const userId = await resolveUserId(customerId, sub.metadata)
  if (!userId) {
    // Throw so the route returns 500 and Stripe retries — billing state must
    // never be silently dropped.
    throw new Error(`[stripe-webhook] Cannot attribute subscription ${sub.id} (customer ${customerId}) to a user`)
  }

  if (!SUBSCRIPTION_STATUSES.has(sub.status)) {
    throw new Error(`[stripe-webhook] Unknown subscription status '${sub.status}' for ${sub.id}`)
  }

  // Fully ended subscription → back to free.
  if (sub.status === 'canceled') {
    const { error } = await admin
      .from('invoicememory_subscriptions')
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          plan: 'free',
          status: 'canceled',
          current_period_end: null,
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(`[stripe-webhook] Failed to mark canceled for ${userId}: ${error.message}`)
    return
  }

  // Map the Stripe price back to our plan enum; metadata is the fallback.
  const priceId = sub.items.data[0]?.price?.id
  let plan = planFromPriceId(priceId)
  if (!plan && (sub.metadata?.plan === 'pro' || sub.metadata?.plan === 'business')) {
    plan = sub.metadata.plan
  }
  if (!plan) {
    console.error(`[stripe-webhook] Unknown price ${priceId} on ${sub.id} — leaving plan unchanged`)
  }

  const { error } = await admin
    .from('invoicememory_subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        ...(plan ? { plan } : {}),
        status: sub.status,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: 'user_id' }
    )
  if (error) throw new Error(`[stripe-webhook] Failed to sync subscription for ${userId}: ${error.message}`)
}

async function syncSubscriptionById(subscriptionId: string): Promise<void> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  await syncSubscription(sub)
}

async function recordPaymentIntent(
  pi: Stripe.PaymentIntent,
  status: 'succeeded' | 'failed' | 'processing'
): Promise<void> {
  // Subscription invoices flow through the subscriptions table — the payments
  // table is for genuine one-time charges (credit packs, lifetime deals).
  if (pi.invoice) return

  const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id ?? null
  const userId = await resolveUserId(customerId, pi.metadata)
  if (!userId) {
    // A PaymentIntent we can't attribute is almost certainly not ours; log & skip
    // rather than making Stripe retry forever.
    console.warn(`[stripe-webhook] Skipping unattributable payment_intent ${pi.id}`)
    return
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('invoicememory_payments')
    .upsert(
      {
        user_id: userId,
        stripe_payment_intent_id: pi.id,
        amount_cents: pi.amount,
        currency: (pi.currency ?? 'usd').toUpperCase(),
        status,
        description: pi.description ?? 'One-time payment',
      },
      { onConflict: 'stripe_payment_intent_id' }
    )
  if (error) throw new Error(`[stripe-webhook] Failed to record payment ${pi.id}: ${error.message}`)
}

/**
 * Central dispatcher — called from app/api/webhooks/stripe/route.ts with an
 * ALREADY-VERIFIED event. Throwing here → the route returns 500 → Stripe retries.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.subscription) {
        const subId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        await syncSubscriptionById(subId)
      }
      if (session.mode === 'payment' && session.payment_intent) {
        const piId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id
        const pi = await getStripe().paymentIntents.retrieve(piId)
        await recordPaymentIntent(pi, 'succeeded')
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object as Stripe.Subscription)
      break
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      // Refresh from Stripe (source of truth) — payment failures flip the
      // subscription to past_due, successes confirm the new period end.
      const invoice = event.data.object as Stripe.Invoice
      const subId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (subId) await syncSubscriptionById(subId)
      break
    }

    case 'payment_intent.succeeded': {
      await recordPaymentIntent(event.data.object as Stripe.PaymentIntent, 'succeeded')
      break
    }

    case 'payment_intent.processing': {
      await recordPaymentIntent(event.data.object as Stripe.PaymentIntent, 'processing')
      break
    }

    case 'payment_intent.payment_failed': {
      await recordPaymentIntent(event.data.object as Stripe.PaymentIntent, 'failed')
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const piId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (piId && charge.refunded) {
        const admin = getSupabaseAdmin()
        const { error } = await admin
          .from('invoicememory_payments')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', piId)
        if (error) throw new Error(`[stripe-webhook] Failed to mark refund for ${piId}: ${error.message}`)
      }
      break
    }

    default:
      // Unhandled event types are fine — acknowledge and move on.
      break
  }
}
