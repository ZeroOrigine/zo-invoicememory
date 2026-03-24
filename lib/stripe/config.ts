export const PLANS = {
  free: {
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    priceId: null,
    features: [
      'Up to 5 invoices per month',
      'Basic invoice templates',
      'Email delivery',
      'Payment tracking',
      'Basic reporting'
    ],
    limits: {
      invoices: 5,
      clients: 10,
      storage: '100MB'
    }
  },
  pro: {
    name: 'Pro',
    description: 'For growing businesses',
    price: 29,
    yearlyPrice: 290,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    features: [
      'Unlimited invoices',
      'Custom invoice templates',
      'Automated reminders',
      'Advanced reporting',
      'Client portal',
      'Payment integrations',
      'Priority support',
      'Export to PDF/Excel'
    ],
    limits: {
      invoices: 'unlimited',
      clients: 'unlimited',
      storage: '10GB'
    }
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations',
    price: 99,
    yearlyPrice: 990,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    yearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID!,
    features: [
      'Everything in Pro',
      'Multi-user accounts',
      'Role-based permissions',
      'API access',
      'Custom integrations',
      'White-label options',
      'Dedicated support',
      'SLA guarantee',
      'Advanced analytics'
    ],
    limits: {
      invoices: 'unlimited',
      clients: 'unlimited',
      storage: 'unlimited',
      users: 'unlimited'
    }
  }
} as const

export type PlanType = keyof typeof PLANS