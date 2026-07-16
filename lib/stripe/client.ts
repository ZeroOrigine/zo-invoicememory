import 'server-only'

// Server-side Stripe SDK instance. `server-only` turns any accidental import
// from a client component into a BUILD ERROR — the secret key can never leak
// into the browser bundle.
//
// Lazy initialization: no module-level throws. Netlify prerender must never
// crash because STRIPE_SECRET_KEY isn't present at build time.
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable.')
    }
    _stripe = new Stripe(key, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  }
  return _stripe
}

/** Absolute app URL for redirect URLs. Never hardcode domains. */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable.')
  }
  return url.replace(/\/$/, '')
}
