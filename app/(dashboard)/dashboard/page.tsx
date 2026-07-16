// app/(dashboard)/dashboard/page.tsx — FINAL CANONICAL (validation pass 5 re-assert).
// The auth+payments step's copy of this path renders its own inline header
// INSIDE the shared sidebar shell (double chrome, duplicate sign-out) and
// ignores ?checkout=success — the exact URL Stripe's success_url targets, so
// paying users would see no confirmation. It also links to the legacy
// /dashboard/billing path. This layout-native version is definitive: shared
// shell, checkout celebration, warm first run. It must be the last writer.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  dueDescription,
  formatDate,
  formatMoneyFromCents,
  isPastDue,
  todayISO,
} from '@/lib/format';
import type { InvoiceStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: { checkout?: string };
}

interface RecentInvoiceRow {
  id: string;
  client_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string;
  total_cents: number;
}

interface OutstandingRow {
  id: string;
  client_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  due_date: string;
  total_cents: number;
}

const STATUS_BADGE_CLASSES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-red-100 text-red-800',
  void: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function sumByCurrency(rows: Array<{ total_cents: number; currency: string }>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.total_cents);
  }
  return totals;
}

function moneySummary(totals: Map<string, number>, fallbackCurrency: string): string {
  if (totals.size === 0) return formatMoneyFromCents(0, fallbackCurrency);
  const primary = totals.has(fallbackCurrency) ? fallbackCurrency : Array.from(totals.keys())[0];
  const label = formatMoneyFromCents(totals.get(primary) ?? 0, primary);
  return totals.size > 1 ? `${label} (+${totals.size - 1} more)` : label;
}

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'danger' | 'success';
}

function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-white';
  const valueClasses = tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900';

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 truncate text-2xl font-bold tracking-tight ${valueClasses}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const now = new Date();
  const monthStartIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;

  const [profileRes, recentRes, outstandingRes, paidRes, totalCountRes, draftCountRes, clientCountRes] =
    await Promise.all([
      supabase
        .from('invoicememory_profiles')
        .select('full_name, business_name, default_currency, invoice_seq')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('invoicememory_invoices')
        .select('id, client_name, invoice_number, status, currency, issue_date, due_date, total_cents')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('invoicememory_invoices')
        .select('id, client_name, invoice_number, status, currency, due_date, total_cents')
        .eq('user_id', user.id)
        .in('status', ['sent', 'viewed', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(200),
      supabase
        .from('invoicememory_invoices')
        .select('total_cents, currency')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .gte('paid_at', monthStartIso),
      supabase.from('invoicememory_invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('invoicememory_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'draft'),
      supabase
        .from('invoicememory_clients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null),
    ]);

  const profile = profileRes.data as
    | { full_name: string | null; business_name: string | null; default_currency: string; invoice_seq: number }
    | null;
  const recentInvoices = (recentRes.data ?? []) as RecentInvoiceRow[];
  const outstanding = (outstandingRes.data ?? []) as OutstandingRow[];
  const paidRows = (paidRes.data ?? []) as Array<{ total_cents: number; currency: string }>;

  const totalInvoiceCount = totalCountRes.count ?? 0;
  const draftCount = draftCountRes.count ?? 0;
  const clientCount = clientCountRes.count ?? 0;

  const fallbackCurrency = profile?.default_currency ?? 'USD';
  const firstName = (profile?.full_name ?? '').trim().split(' ')[0] || null;
  const nextInvoiceNumber = `INV-${String((profile?.invoice_seq ?? 0) + 1).padStart(4, '0')}`;

  const overdueInvoices = outstanding.filter((invoice) => isPastDue(invoice.status, invoice.due_date));
  const outstandingSummary = moneySummary(sumByCurrency(outstanding), fallbackCurrency);
  const overdueSummary = moneySummary(sumByCurrency(overdueInvoices), fallbackCurrency);
  const paidSummary = moneySummary(sumByCurrency(paidRows), fallbackCurrency);

  const isFirstRun = totalInvoiceCount === 0;
  const showCheckoutSuccess = searchParams.checkout === 'success';

  const subline = isFirstRun
    ? "Let's get your first invoice out the door."
    : overdueInvoices.length > 0
      ? `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} could use a nudge.`
      : outstanding.length > 0
        ? `You're waiting on ${outstandingSummary}. It's on its way.`
        : 'All caught up. Nothing overdue, nothing waiting.';

  return (
    <div className="space-y-6">
      {showCheckoutSuccess && (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Upgrade confirmed — you&apos;re all set. 🎉</p>
            <p className="text-sm text-emerald-700">Thanks for backing InvoiceMemory. Your plan is live right now.</p>
          </div>
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            View your plan
          </Link>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="mt-1 text-sm text-slate-600">{subline}</p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          New invoice
          <span className="rounded bg-blue-800/60 px-1.5 py-0.5 text-xs font-medium">{nextInvoiceNumber} is ready</span>
        </Link>
      </header>

      {isFirstRun ? (
        <section aria-label="Get started" className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Your first invoice is 60 seconds away.
            </h2>
            <ol className="mt-5 space-y-4">
              {[
                ['Name who it’s for', 'Type it once. We remember them forever.'],
                ['Add what you did', 'One line is enough. Prices stay in whole cents — no math errors, ever.'],
                ['Send it', 'Numbering, dates, and totals are already handled for you.'],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="text-sm text-slate-600">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/invoices/new"
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Create {nextInvoiceNumber}
              </Link>
              <Link href="/clients" className="text-sm font-medium text-blue-700 transition-colors hover:text-blue-800">
                Or save a client first →
              </Link>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:block" aria-hidden="true">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-slate-900">{profile?.business_name || profile?.full_name || 'Your business'}</p>
                <p className="text-xs text-slate-500">{formatDate(todayISO())}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
                <p className="text-sm font-semibold text-slate-700">{nextInvoiceNumber}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-3 w-3/4 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="text-lg font-bold text-slate-300">— {fallbackCurrency}</span>
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">This preview becomes real the moment you hit create.</p>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Money at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Outstanding"
              value={outstandingSummary}
              hint={`${outstanding.length} open invoice${outstanding.length === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Overdue"
              value={overdueInvoices.length > 0 ? overdueSummary : formatMoneyFromCents(0, fallbackCurrency)}
              hint={overdueInvoices.length > 0 ? 'Worth a friendly nudge' : "You're all caught up"}
              tone={overdueInvoices.length > 0 ? 'danger' : 'success'}
            />
            <StatCard label="Paid this month" value={paidSummary} hint="Keep it rolling" />
            <StatCard
              label="Drafts"
              value={String(draftCount)}
              hint={draftCount > 0 ? 'Waiting to be sent' : 'Nothing half-finished'}
            />
          </section>

          {overdueInvoices.length > 0 && (
            <section aria-label="Overdue invoices" className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-red-800">These could use a nudge</h2>
                  <p className="mt-0.5 text-sm text-red-700">A short, friendly reminder email usually does the trick.</p>
                </div>
                <Link href="/invoices?status=overdue" className="shrink-0 text-sm font-semibold text-red-700 transition-colors hover:text-red-900">
                  See all →
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {overdueInvoices.slice(0, 3).map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="flex flex-col gap-1 rounded-lg border border-red-200 bg-white px-4 py-3 transition-colors hover:bg-red-100/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm font-semibold text-slate-900">
                        {invoice.invoice_number}
                        <span className="font-normal text-slate-500"> · {invoice.client_name}</span>
                      </span>
                      <span className="flex items-center gap-3 text-sm">
                        <span className="font-semibold text-slate-900">{formatMoneyFromCents(invoice.total_cents, invoice.currency)}</span>
                        <span className="font-medium text-red-600">{dueDescription(invoice.due_date, invoice.status)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Recent invoices" className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">Recent invoices</h2>
              <Link href="/invoices" className="text-sm font-medium text-blue-700 transition-colors hover:text-blue-800">
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {invoice.invoice_number}
                        <span className="font-normal text-slate-500"> · {invoice.client_name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">Issued {formatDate(invoice.issue_date)}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <span className="text-sm font-semibold text-slate-900">{formatMoneyFromCents(invoice.total_cents, invoice.currency)}</span>
                      <span className="flex items-center gap-2">
                        <span className={`text-xs ${isPastDue(invoice.status, invoice.due_date) ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                          {dueDescription(invoice.due_date, invoice.status)}
                        </span>
                        <StatusBadge status={invoice.status} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Your memory" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {clientCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Your memory holds {clientCount} client{clientCount === 1 ? '' : 's'}.</span>{' '}
                  Every saved client makes the next invoice faster.
                </p>
                <Link href="/clients" className="shrink-0 text-sm font-medium text-blue-700 transition-colors hover:text-blue-800">
                  Manage clients →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Want invoices to fill themselves?</span> Save your regulars and their
                  currency, terms, and line items snap in automatically.
                </p>
                <Link href="/clients" className="shrink-0 text-sm font-medium text-blue-700 transition-colors hover:text-blue-800">
                  Add your first client →
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
