'use client'

import { useState } from 'react'
import { PLANS, type PlanId } from '@/lib/stripe/config'

// PATCHED (self-validation): the free-plan copy previously interpolated
// PLANS.free.limits.clients, which is null (= unlimited) — it would have
// rendered "null remembered clients". Copy now matches lib/stripe/config.ts.

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success-50 text-success-700' },
  trialing: { label: 'Trial', className: 'bg-brand-50 text-brand-700' },
  past_due: { label: 'Payment issue', className: 'bg-warning-50 text-warning-700' },
  canceled: { label: 'Canceled', className: 'bg-gray-100 text-gray-600' },
  incomplete: { label: 'Incomplete', className: 'bg-warning-50 text-warning-700' },
  incomplete_expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600' },
  unpaid: { label: 'Unpaid', className: 'bg-danger-50 text-danger-700' },
  paused: { label: 'Paused', className: 'bg-gray-100 text-gray-600' },
}

export function ManageSubscription({
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasBillingAccount,
}: {
  plan: PlanId
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasBillingAccount: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planDef = PLANS[plan]
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.active
  const renewDate = currentPeriodEnd
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
        new Date(currentPeriodEnd)
      )
    : null

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json().catch(() => null)
      const url = data?.url ?? data?.data?.url
      if (!res.ok || !url) {
        setError(data?.error ?? "We couldn't open your billing settings. Try again in a moment.")
        setLoading(false)
        return
      }
      window.location.assign(url)
    } catch {
      setError("We couldn't reach the billing server. Check your connection and try again.")
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg text-gray-900">{planDef.name} plan</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{planDef.tagline}</p>

          {status === 'past_due' && (
            <p className="mt-2 text-sm font-medium text-warning-700">
              Your last payment didn&apos;t go through. Update your card to keep {planDef.name} — it takes a minute.
            </p>
          )}
          {renewDate && plan !== 'free' && status !== 'past_due' && (
            <p className="mt-2 text-sm text-gray-600">
              {cancelAtPeriodEnd
                ? `Your plan ends ${renewDate} — you keep ${planDef.name} features until then.`
                : `Renews ${renewDate}.`}
            </p>
          )}
          {plan === 'free' && (
            <p className="mt-2 text-sm text-gray-600">
              You&apos;re on the free plan — {PLANS.free.limits.invoicesPerMonth} invoices a month, unlimited remembered clients.
            </p>
          )}
        </div>

        {hasBillingAccount && (
          <div className="shrink-0">
            <button type="button" onClick={openPortal} disabled={loading} className="btn-secondary">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Opening…
                </span>
              ) : (
                'Manage billing'
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-700">
          {error}
        </p>
      )}

      {hasBillingAccount && (
        <p className="mt-4 text-xs text-gray-500">
          Cards, receipts, plan changes and cancellation all live in the secure Stripe portal — you&apos;re always in control.
        </p>
      )}
    </div>
  )
}
