// app/api/billing/checkout/route.ts
//
// Thin adapter kept for the in-app /billing page (envelope response shape).
// It delegates to the ONE canonical checkout implementation in
// lib/stripe/checkout.ts, which creates/persists the Stripe customer and
// stamps supabase_user_id metadata — so the webhook can ALWAYS attribute the
// subscription. (The previous version created sessions the webhook could not
// attribute: a paid user would have received nothing.)
//
// HONESTY RULE: no trials are configured — buttons say "Upgrade — $X/mo".

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, getPriceId } from '@/lib/stripe/checkout'
import { jsonError, jsonValidationError, readJsonBody } from '@/lib/api'

export const dynamic = 'force-dynamic'

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'business'], {
    errorMap: () => ({ message: "Pick a plan to upgrade to: 'pro' or 'business'." }),
  }),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
})

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError(
        'You need to be signed in to upgrade. Log in and we will bring you right back here.',
        'UNAUTHORIZED',
        401,
      )
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return jsonError("We couldn't read that request — the body needs to be valid JSON.", 'BAD_REQUEST', 400)
    }

    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return jsonValidationError(parsed.error)
    }
    const { plan, interval } = parsed.data

    // Already on this plan? Don't let anyone pay twice.
    const { data: sub } = await supabase
      .from('invoicememory_subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (sub && sub.plan === plan && (sub.status === 'active' || sub.status === 'trialing')) {
      return jsonError(
        `You're already on the ${plan} plan — no need to pay twice. Manage it from Billing instead.`,
        'CONFLICT',
        409,
      )
    }

    const priceId = getPriceId(plan, interval)
    if (!priceId) {
      console.error(`[api/billing/checkout] Missing Stripe price env var for ${plan}:${interval}`)
      return jsonError("That plan isn't available right now — we're on it. Try again shortly.", 'INTERNAL_ERROR', 500)
    }

    const session = await createCheckoutSession(user.id, priceId, {
      email: user.email ?? undefined,
      plan,
    })

    if (!session.url) {
      return jsonError("We couldn't open checkout just now. Nothing was charged — give it another try.", 'INTERNAL_ERROR', 500)
    }

    // Dual shape: envelope for lib/client-api consumers, bare `url` for anything else.
    return NextResponse.json({ data: { url: session.url }, url: session.url, error: null })
  } catch (unexpectedError) {
    console.error('[api/billing/checkout] Unexpected failure:', unexpectedError)
    return jsonError("We couldn't open checkout just now. Nothing was charged — give it another try.", 'INTERNAL_ERROR', 500)
  }
}
