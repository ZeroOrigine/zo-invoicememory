import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The short, fair terms for using InvoiceMemory.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">← InvoiceMemory</Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Short and fair, the way terms should be.</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        <p><strong>The service.</strong> InvoiceMemory helps you create, track, and remember invoices. The Free plan includes 15 invoices per month; paid plans (Pro $29/mo, Business $99/mo) are billed by Stripe with no trial — you&apos;re charged when you upgrade, and you can cancel anytime from the billing portal.</p>
        <p><strong>Your data, your responsibility.</strong> You own everything you create here and can export it anytime. You&apos;re responsible for the accuracy of the invoices you issue and for complying with your local tax and invoicing laws — InvoiceMemory is a tool, not an accountant.</p>
        <p><strong>Fair use.</strong> Don&apos;t use the service for fraud, spam, or anything illegal. We can suspend accounts that do, and we&apos;ll always tell you why.</p>
        <p><strong>Availability & liability.</strong> We work hard to keep the service up, but it&apos;s provided “as is” without warranties; our liability is limited to the fees you paid us in the last 12 months.</p>
        <p><strong>Changes.</strong> If these terms change materially, we&apos;ll email you before the change takes effect.</p>
        <p><strong>Contact.</strong> <a href="mailto:hello@zeroorigine.com" className="font-semibold text-brand-600 hover:text-brand-700">hello@zeroorigine.com</a></p>
      </div>
    </main>
  )
}
