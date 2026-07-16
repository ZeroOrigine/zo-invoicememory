import 'server-only'

import type Stripe from 'stripe'
import { getStripe, getAppUrl } from './client'

/**
 * Stripe Billing Portal — users manage cards, invoices, upgrades, downgrades
 * and cancellation THEMSELVES. Empowerment over dependency: users can leave
 * at any time without emailing support.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnPath: string = '/dashboard/billing'
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}${returnPath}`,
  })
}
