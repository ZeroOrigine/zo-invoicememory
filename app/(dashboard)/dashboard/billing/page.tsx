// app/(dashboard)/dashboard/billing/page.tsx
// DEDUPLICATION STUB. The canonical billing experience lives at /billing
// (inside the shared dashboard shell). This legacy path only exists because
// older Stripe return URLs pointed here — it now forwards permanently.

import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyBillingRedirect({
  searchParams,
}: {
  searchParams: { checkout?: string }
}) {
  const suffix = searchParams?.checkout ? `?checkout=${encodeURIComponent(searchParams.checkout)}` : ''
  redirect(`/billing${suffix}`)
}
