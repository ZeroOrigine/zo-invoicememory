import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, getPriceId } from '@/lib/stripe/checkout'

// ---------------------------------------------------------------------------
// POST /api/checkout — { plan: 'pro' | 'business', interval: 'monthly' | 'yearly' }
// Protected by: middleware session check + Origin CSRF check + this route's own
// auth check (defense in depth). Price IDs are resolved SERVER-SIDE — the
// client can never substitute an arbitrary price.
//
// RATE LIMITING: apply an edge/IP rate limit here (e.g. 10 req/min/user via
// Upstash or Netlify Edge) before going to production scale — checkout session
// creation hits the Stripe API and must not be spammable.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Sign in first, then pick your plan.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const plan = body?.plan
    const interval = body?.interval

    if (plan !== 'pro' && plan !== 'business') {
      return NextResponse.json(
        { error: "That plan doesn't exist. Pick Pro or Business." },
        { status: 400 }
      )
    }
    if (interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json(
        { error: 'Choose monthly or yearly billing.' },
        { status: 400 }
      )
    }

    const priceId = getPriceId(plan, interval)
    if (!priceId) {
      console.error(`[checkout] Missing Stripe price env var for ${plan}:${interval}`)
      return NextResponse.json(
        { error: "Billing isn't fully set up for this plan yet. We're on it — try again soon." },
        { status: 503 }
      )
    }

    const session = await createCheckoutSession(user.id, priceId, {
      email: user.email ?? undefined,
      plan,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Failed to create session:', err)
    return NextResponse.json(
      { error: "We couldn't start checkout. Nothing was charged — please try again." },
      { status: 500 }
    )
  }
}
