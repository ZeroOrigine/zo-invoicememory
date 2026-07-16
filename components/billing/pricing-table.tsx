'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  PLANS,
  PLAN_ORDER,
  YEARLY_MONTHS_FREE,
  formatPrice,
  type BillingInterval,
  type PlanId,
} from '@/lib/stripe/config'
import { CheckoutButton } from '@/components/billing/checkout-button'

// 3-tier pricing. Button copy is HONEST: there is no trial configured in
// Stripe, so buttons say "Get Pro — $29/mo", never "Start Trial".

export function PricingTable({ currentPlan }: { currentPlan?: PlanId }) {
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <div>
      {/* Monthly / Yearly toggle */}
      <div className="flex items-center justify-center gap-1 rounded-full bg-gray-100 p-1 text-sm font-semibold text-gray-600 mx-auto w-fit">
        <button
          type="button"
          onClick={() => setInterval('monthly')}
          aria-pressed={interval === 'monthly'}
          className={`rounded-full px-4 py-1.5 transition-all ${
            interval === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval('yearly')}
          aria-pressed={interval === 'yearly'}
          className={`rounded-full px-4 py-1.5 transition-all ${
            interval === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'
          }`}
        >
          Yearly
          <span className="ml-1.5 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
            {YEARLY_MONTHS_FREE} months free
          </span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId]
          const price = plan.prices[interval]
          const isCurrent = currentPlan === planId
          const suffix = interval === 'monthly' ? '/mo' : '/yr'

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 ring-1 transition-shadow hover:shadow-lg sm:p-8 ${
                plan.highlight ? 'ring-2 ring-brand-600 shadow-md' : 'ring-gray-200'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              <h3 className="text-lg text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold tracking-tight text-gray-900">
                  {formatPrice(price)}
                </span>
                {price > 0 && <span className="text-sm font-medium text-gray-500">{suffix}</span>}
              </div>
              {price > 0 && interval === 'yearly' && (
                <p className="mt-1 text-xs text-gray-500">
                  That&apos;s {formatPrice(Math.round(price / 12))}/mo — {YEARLY_MONTHS_FREE} months free vs monthly.
                </p>
              )}
              {price === 0 && <p className="mt-1 text-xs text-gray-500">Free forever. No card needed.</p>}

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-success-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {isCurrent ? (
                  <button type="button" disabled className="btn-secondary w-full">
                    Your current plan
                  </button>
                ) : plan.id === 'free' ? (
                  currentPlan ? (
                    <p className="text-center text-sm text-gray-500">
                      Downgrade anytime from Manage billing.
                    </p>
                  ) : (
                    <Link href="/signup" className="btn-secondary w-full">
                      Start free — no card needed
                    </Link>
                  )
                ) : (
                  <CheckoutButton
                    plan={plan.id as 'pro' | 'business'}
                    interval={interval}
                    variant={plan.highlight ? 'primary' : 'secondary'}
                    label={`Get ${plan.name} — ${formatPrice(price)}${suffix}`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        Secure checkout by Stripe. We never see or store your card details. Cancel anytime — your data exports in one click.
      </p>
    </div>
  )
}
