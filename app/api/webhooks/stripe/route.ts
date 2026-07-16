import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { handleStripeEvent } from '@/lib/stripe/webhooks'

// ---------------------------------------------------------------------------
// CANONICAL Stripe webhook endpoint (replaces the duplicate implementation).
// Every request is verified against STRIPE_WEBHOOK_SECRET using the RAW body.
// This route is public in middleware BECAUSE the signature is the auth.
// 2xx = processed, 400 = bad signature (no retry), 500 = transient (retry).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs' // stripe-node's constructEvent needs Node crypto
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // MUST be the raw text body — parsing to JSON first breaks verification.
  const payload = await request.text()

  let event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    // 500 → Stripe retries with backoff. Billing state is never silently lost.
    console.error(`[stripe-webhook] Handler failed for ${event.type} (${event.id}):`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
