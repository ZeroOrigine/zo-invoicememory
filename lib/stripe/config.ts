// ---------------------------------------------------------------------------
// Plan configuration — pure data, safe to import from CLIENT components AND
// server routes. THE single source of truth for prices, limits, and features.
// The landing page, /billing page, checkout server, and API limit gate all
// read from here — displayed price === charged price, always.
//
// CANONICAL FREE LIMITS (self-validation unification): 15 invoices/month,
// unlimited remembered clients — matching the public landing-page promise.
//
// ENUM ALIGNMENT: the DB enum is ('free','pro','business'). The marketing
// "Enterprise" tier ships as plan id 'business'.
// All money values are integer cents. Never floats in finance.
// ---------------------------------------------------------------------------

export type PlanId = 'free' | 'pro' | 'business'
export type BillingInterval = 'monthly' | 'yearly'

export interface PlanLimits {
  /** null = unlimited */
  invoicesPerMonth: number | null
  /** null = unlimited */
  clients: number | null
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  highlight: boolean
  /** integer cents */
  prices: { monthly: number; yearly: number }
  limits: PlanLimits
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For your first clients',
    highlight: false,
    prices: { monthly: 0, yearly: 0 },
    limits: { invoicesPerMonth: 15, clients: null },
    features: [
      '15 invoices per month',
      'Unlimited remembered clients',
      'Invoices auto-filled from client memory',
      'Automatic invoice numbering (INV-0001…)',
      'One-click data export — your data is yours',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For working freelancers',
    highlight: true,
    prices: { monthly: 2900, yearly: 29000 }, // $29/mo or $290/yr (2 months free)
    limits: { invoicesPerMonth: null, clients: null },
    features: [
      'Everything in Free, plus:',
      'Unlimited invoices',
      'Full invoice memory with line-item suggestions',
      'Overdue tracking across every client',
      'Multi-currency invoicing',
      'Priority support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'For teams and agencies',
    highlight: false,
    prices: { monthly: 9900, yearly: 99000 }, // $99/mo or $990/yr (2 months free)
    limits: { invoicesPerMonth: null, clients: null },
    features: [
      'Everything in Pro, plus:',
      'API access for custom integrations',
      'Dedicated onboarding',
      'Priority phone + email support',
      '99.9% uptime SLA',
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'business']

export const YEARLY_MONTHS_FREE = 2

export function isPaidPlan(plan: PlanId): boolean {
  return plan !== 'free'
}

export function formatPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** Free-tier gate helper — enforced by POST /api/invoices. */
export function planAllowsAnotherInvoice(plan: PlanId, usedThisMonth: number): boolean {
  const limit = PLANS[plan].limits.invoicesPerMonth
  return limit === null || usedThisMonth < limit
}
