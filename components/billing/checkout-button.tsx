'use client'

import { useState } from 'react'
import type { BillingInterval } from '@/lib/stripe/config'

// Triggers Stripe Checkout. Sends { plan, interval } — the SERVER resolves the
// price ID, so nothing tamper-able crosses the wire. Button label must always
// be honest about what happens: an immediate charge, no trial.

export function CheckoutButton({
  plan,
  interval,
  label,
  variant = 'primary',
  disabled = false,
}: {
  plan: 'pro' | 'business'
  interval: BillingInterval
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })

      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/dashboard/billing')}`
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "We couldn't open checkout. Nothing was charged — try again in a moment.")
        setLoading(false)
        return
      }

      window.location.assign(data.url)
    } catch {
      setError("We couldn't reach the checkout server. Check your connection and try again.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled || loading}
        className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} w-full`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Opening secure checkout…
          </span>
        ) : (
          label
        )}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}
