'use client'

// app/(dashboard)/billing/page.tsx — PATCHED FOR PRICE HONESTY.
// Previous version displayed Pro $9/mo and Business $29/mo while Stripe
// charges $29/$99. Prices, limits, and features now come from
// lib/stripe/config.ts — the single source of truth shared with the landing
// page and the checkout server. Displayed price === charged price, always.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/client-api'
import { formatDate, formatMoneyFromCents } from '@/lib/format'
import { PLANS, PLAN_ORDER, formatPrice, type PlanId } from '@/lib/stripe/config'
import type { PaymentRecord, SubscriptionRecord } from '@/lib/format'

interface ToastState {
  message: string
  tone: 'success' | 'error'
}

function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-40 rounded bg-slate-200" />
      <div className="h-32 rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-72 rounded-xl bg-slate-200" />
        <div className="h-72 rounded-xl bg-slate-200" />
        <div className="h-72 rounded-xl bg-slate-200" />
      </div>
    </div>
  )
}

export default function BillingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [actionPending, setActionPending] = useState<'pro' | 'business' | 'portal' | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  function showToast(message: string, tone: ToastState['tone']) {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const [subscriptionRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoicememory_subscriptions')
          .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('invoicememory_payments')
          .select('id, amount_cents, currency, status, description, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      if (cancelled) return
      setSubscription((subscriptionRes.data as SubscriptionRecord | null) ?? null)
      setPayments((paymentsRes.data as PaymentRecord[] | null) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  async function startCheckout(plan: 'pro' | 'business') {
    setActionPending(plan)
    const res = await apiFetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, interval: 'monthly' }),
    })
    if (res.data?.url) {
      window.location.assign(res.data.url)
      return
    }
    setActionPending(null)
    showToast(res.error ?? "We couldn't open checkout just now. Nothing was charged.", 'error')
  }

  async function openPortal() {
    setActionPending('portal')
    const res = await apiFetch<{ url: string }>('/api/billing/portal', { method: 'POST' })
    if (res.data?.url) {
      window.location.assign(res.data.url)
      return
    }
    setActionPending(null)
    showToast(res.error ?? "We couldn't open your billing settings just now.", 'error')
  }

  if (loading) {
    return <BillingSkeleton />
  }

  const currentPlan: PlanId = subscription?.plan ?? 'free'
  const status = subscription?.status ?? 'active'
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id)
  const isPaid = currentPlan !== 'free'
  const changesGoThroughPortal = hasStripeCustomer && isPaid && ['active', 'trialing', 'past_due'].includes(status)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">Your plan, your card, your history — all in one place.</p>
      </header>

      {status === 'past_due' && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">Your last payment didn&apos;t go through.</p>
            <p className="text-sm text-red-700">Update your card and everything picks up right where it left off.</p>
          </div>
          <button
            type="button"
            onClick={openPortal}
            disabled={actionPending !== null}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            {actionPending === 'portal' ? 'Opening…' : 'Update card'}
          </button>
        </div>
      )}

      <section aria-labelledby="current-plan-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="current-plan-heading" className="text-sm font-bold text-slate-900">
              You&apos;re on {PLANS[currentPlan].name}.
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {currentPlan === 'free'
                ? `Free forever — ${PLANS.free.limits.invoicesPerMonth} invoices a month, unlimited remembered clients. Upgrade whenever it earns its keep.`
                : subscription?.cancel_at_period_end && subscription.current_period_end
                  ? `Ends ${formatDate(subscription.current_period_end)} — you keep all your data either way.`
                  : subscription?.current_period_end
                    ? `Renews ${formatDate(subscription.current_period_end)}.`
                    : 'Active.'}
            </p>
          </div>
          {hasStripeCustomer && (
            <button
              type="button"
              onClick={openPortal}
              disabled={actionPending !== null}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {actionPending === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </div>
      </section>

      <section aria-label="Plans" className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId]
          const isCurrent = planId === currentPlan
          const monthlyPrice = formatPrice(plan.prices.monthly)
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
                plan.highlight ? 'border-blue-700 ring-2 ring-blue-700/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                {plan.highlight && (
                  <span className="rounded-full bg-blue-700 px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</span>
                )}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{monthlyPrice}</span>
                <span className="text-sm text-slate-500"> {plan.prices.monthly === 0 ? 'forever' : '/month'}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) =>
                  feature.endsWith(':') ? (
                    <li key={feature} className="text-sm font-semibold text-slate-900">
                      {feature}
                    </li>
                  ) : (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true">
                        <path d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {feature}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <span className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500">
                    Your current plan
                  </span>
                ) : plan.id === 'free' || changesGoThroughPortal ? (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={actionPending !== null}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    {actionPending === 'portal' ? 'Opening…' : 'Switch in billing portal'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCheckout(plan.id as 'pro' | 'business')}
                    disabled={actionPending !== null}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      plan.highlight
                        ? 'bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700'
                        : 'bg-slate-800 hover:bg-slate-900 focus-visible:outline-slate-800'
                    }`}
                  >
                    {actionPending === plan.id ? 'Opening checkout…' : `Upgrade to ${plan.name} — ${monthlyPrice}/mo`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <p className="text-xs text-slate-500">
        Billed monthly by Stripe (annual plans available at checkout). No trial — you&apos;re charged when you upgrade. Cancel
        anytime from the billing portal; your invoices, clients, and memory stay yours forever.
      </p>

      {payments.length > 0 && (
        <section aria-labelledby="payments-heading" className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 id="payments-heading" className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-900">
            Payment history
          </h2>
          <ul className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{payment.description ?? 'Payment'}</p>
                  <p className="text-xs text-slate-500">{formatDate(payment.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatMoneyFromCents(payment.amount_cents, payment.currency)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      payment.status === 'succeeded'
                        ? 'bg-emerald-100 text-emerald-800'
                        : payment.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg lg:bottom-8 ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
