// app/(dashboard)/invoices/page.tsx
//
// The invoice list. Server component — filter tabs and pagination are plain
// links driven by searchParams, so active states and data are correct on the
// server with zero client JS.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dueDescription, formatDate, formatMoneyFromCents, isPastDue, todayISO } from '@/lib/format';
import type { InvoiceStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'open', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const EMPTY_STATE_COPY: Record<TabKey, { title: string; detail: string }> = {
  all: { title: 'No invoices yet.', detail: 'Your first one takes about 60 seconds — and the second one is even faster.' },
  draft: { title: 'No drafts.', detail: 'Nothing half-finished. When you save a draft, it lives here.' },
  open: { title: 'Nothing out for payment.', detail: 'Invoices you mark as sent wait here until they get paid.' },
  overdue: { title: 'Nothing overdue. 🎉', detail: 'Every open invoice is still inside its payment terms.' },
  paid: { title: 'No paid invoices yet.', detail: "They'll land here soon — and it feels great when they do." },
};

interface InvoicesPageProps {
  searchParams: { status?: string; page?: string };
}

interface InvoiceListRow {
  id: string;
  client_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
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

function buildHref(tab: TabKey, page: number): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('status', tab);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/invoices?${query}` : '/invoices';
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeTab: TabKey = TABS.some((tab) => tab.key === searchParams.status)
    ? (searchParams.status as TabKey)
    : 'all';

  const requestedPage = Number.parseInt(searchParams.page ?? '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('invoicememory_invoices')
    .select('id, client_name, invoice_number, status, currency, issue_date, due_date, total_cents', {
      count: 'exact',
    })
    .eq('user_id', user.id);

  if (activeTab === 'draft') query = query.eq('status', 'draft');
  if (activeTab === 'open') query = query.in('status', ['sent', 'viewed']);
  if (activeTab === 'paid') query = query.eq('status', 'paid');
  if (activeTab === 'overdue') query = query.in('status', ['sent', 'viewed', 'overdue']).lt('due_date', todayISO());

  const { data, error, count } = await query
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const invoices = (data ?? []) as InvoiceListRow[];
  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} invoice{total === 1 ? '' : 's'}
            {activeTab !== 'all' ? ` · ${TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}` : ''}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          New invoice
        </Link>
      </header>

      <nav aria-label="Invoice filters" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={buildHref(tab.key, 1)}
              aria-current={isActive ? 'page' : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                isActive
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-800">We couldn&apos;t load your invoices just now.</p>
          <p className="mt-1 text-sm text-amber-700">Refresh in a moment and they&apos;ll be right back.</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">{EMPTY_STATE_COPY[activeTab].title}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{EMPTY_STATE_COPY[activeTab].detail}</p>
          {(activeTab === 'all' || activeTab === 'draft') && (
            <Link
              href="/invoices/new"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Create an invoice
            </Link>
          )}
        </div>
      ) : (
        <section aria-label="Invoice list" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
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
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={buildHref(activeTab, page - 1)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              ← Newer
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-4 py-2 text-sm text-slate-300">← Newer</span>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(activeTab, page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Older →
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-4 py-2 text-sm text-slate-300">Older →</span>
          )}
        </nav>
      )}
    </div>
  );
}
