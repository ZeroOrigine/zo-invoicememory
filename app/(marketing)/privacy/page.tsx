import type { Metadata } from 'next'
import Link from 'next/link'

// HONESTY PATCH (validation pass 5): the previous copy promised a
// "Download my data" button in Billing that the shipped /billing UI does not
// have. The working export endpoint is /api/export — the policy now links to
// it directly, so every promise on this page is true.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How InvoiceMemory handles your data: plainly, honestly, and with you in control.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">← InvoiceMemory</Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Plain language, no tricks.</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        <p><strong>What we collect.</strong> Your account details (name, email), the clients and invoices you create, and subscription/billing state from Stripe. Nothing else.</p>
        <p><strong>What we never do.</strong> We never sell your data, never share it with advertisers, and never see or store your card details — payments run entirely through Stripe.</p>
        <p><strong>Where it lives.</strong> Data is stored in Supabase (PostgreSQL) with row-level security, encrypted in transit and at rest. Only you (and, for billing sync, our payment webhook) can touch your rows.</p>
        <p><strong>Your control.</strong> Export every client, invoice, and payment record as standard JSON anytime — <a href="/api/export" className="font-semibold text-brand-600 hover:text-brand-700">download your data</a> (you&apos;ll need to be signed in). Want your account deleted? Email us and it&apos;s done — everything cascades.</p>
        <p><strong>Questions.</strong> A human reads <a href="mailto:hello@zeroorigine.com" className="font-semibold text-brand-600 hover:text-brand-700">hello@zeroorigine.com</a>.</p>
      </div>
    </main>
  )
}
