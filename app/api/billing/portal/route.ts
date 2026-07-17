// app/api/billing/portal/route.ts — FINAL CANONICAL (validation pass 5 re-assert).
// The auth+payments step re-wrote this route returning a bare { url }, but the
// canonical /billing page consumes the envelope via lib/client-api
// (res.data.url) — with the bare shape, 'Manage billing' always errors and
// paying customers cannot reach the Stripe portal. This definitive version
// returns BOTH shapes — { data: { url }, url, error: null } — so every
// consumer works. Do not regress to a single shape.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBillingPortalSession } from '@/lib/stripe/portal'
import { jsonError } from '@/lib/api'
import { rateLimitGuard } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  // durable shared rate limit (deploy scorecard requirement — write-surface hygiene)
  const limited = await rateLimitGuard(request, 'invoicememory_billing');
  if (limited) return limited;
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError('You need to be signed in to manage billing. Log in and try again.', 'UNAUTHORIZED', 401)
    }

    // RLS lets users read their OWN subscription row — no service role needed.
    const { data: sub } = await supabase
      .from('invoicememory_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const customerId = (sub as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null
    if (!customerId) {
      return jsonError(
        "You're on the free plan, so there's no billing to manage yet. Upgrade first — then this is where you change cards or cancel.",
        'BAD_REQUEST',
        400,
      )
    }

    const session = await createBillingPortalSession(customerId, '/billing')
    // Dual shape: envelope for lib/client-api consumers, bare `url` for legacy ones.
    return NextResponse.json({ data: { url: session.url }, url: session.url, error: null })
  } catch (unexpectedError) {
    console.error('[api/billing/portal] Unexpected failure:', unexpectedError)
    return jsonError("We couldn't open your billing settings just now. Give it another try in a moment.", 'INTERNAL_ERROR', 500)
  }
}
