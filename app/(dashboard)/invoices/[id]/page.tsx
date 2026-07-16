'use client';

// app/(dashboard)/invoices/[id]/page.tsx
//
// The invoice as a document, plus its lifecycle. Arriving here right after
// creation triggers the celebration: "built in N seconds" — the screenshot
// moment. Print / Save PDF works out of the box because the dashboard chrome
// is print:hidden, leaving a clean invoice on paper.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import {
  daysUntil,
  dueDescription,
  formatDate,
  formatMoneyFromCents,
  isPastDue,
} from '@/lib/format';
import type { InvoiceDetail, InvoiceStatus, ProfileRecord } from '@/lib/format';

interface InvoiceDetailPageProps {
  params: { id: string };
}

interface ToastState {
  message: string;
  tone: 'success' | 'error';
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

function DocSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="h-[28rem] rounded-2xl bg-slate-200" />
    </div>
  );
}

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

function InvoiceView({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justCreated = searchParams.get('created') === '1';
  const createdSeconds = searchParams.get('secs');

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'void' | 'delete' | null>(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(justCreated);
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, tone: ToastState['tone']) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [invoiceRes, profileRes] = await Promise.all([
        apiFetch<InvoiceDetail>(`/api/invoices/${invoiceId}`),
        apiFetch<ProfileRecord>('/api/profile'),
      ]);
      if (cancelled) return;

      if (invoiceRes.data) {
        setInvoice(invoiceRes.data);
      } else if (invoiceRes.code === 'NOT_FOUND' || invoiceRes.code === 'VALIDATION_ERROR') {
        setNotFound(true);
      } else {
        showToast(invoiceRes.error ?? "We couldn't load that invoice just now.", 'error');
      }
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  async function updateStatus(status: 'sent' | 'paid' | 'void') {
    setPending(status);
    setConfirming(null);
    const res = await apiFetch<InvoiceDetail>(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setPending(null);

    if (res.data) {
      setInvoice(res.data);
      if (status === 'paid') {
        showToast(`${formatMoneyFromCents(res.data.total_cents, res.data.currency)} in the bank. Nice work! 🎉`, 'success');
      } else if (status === 'sent') {
        showToast(`Marked as sent — due ${formatDate(res.data.due_date)}. We'll keep an eye on it.`, 'success');
      } else {
        showToast('Voided. Your paper trail stays intact.', 'success');
      }
    } else {
      showToast(res.error ?? "We couldn't save that change. Give it another try.", 'error');
    }
  }

  async function deleteDraft() {
    setPending('delete');
    setConfirming(null);
    const res = await apiFetch<{ id: string; deleted: boolean }>(`/api/invoices/${invoiceId}`, {
      method: 'DELETE',
    });
    if (res.data) {
      router.push('/invoices');
      return;
    }
    setPending(null);
    showToast(res.error ?? "We couldn't delete that draft just now.", 'error');
  }

  if (loading) {
    return <DocSkeleton />;
  }

  if (notFound || !invoice) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-900">We couldn&apos;t find that invoice.</p>
        <p className="mt-1 text-sm text-slate-600">It may have been deleted, or the link is stale.</p>
        <Link
          href="/invoices"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Back to invoices
        </Link>
      </div>
    );
  }

  const overdue = isPastDue(invoice.status, invoice.due_date);
  const canMarkSent = invoice.status === 'draft';
  const canMarkPaid = invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue';

  return (
    <div className="space-y-5">
      {showCreatedBanner && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-sm font-bold text-emerald-800">
              🎉 {invoice.invoice_number} is ready{createdSeconds ? ` — built in ${createdSeconds} seconds` : ''}.
            </p>
            <p className="text-sm text-emerald-700">Your memory just got smarter. The next one will be even faster.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={() => setShowCreatedBanner(false)}
              aria-label="Dismiss"
              className="rounded-lg p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/invoices" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
              ← Invoices
            </Link>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{invoice.invoice_number}</h1>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canMarkSent && (
            <button
              type="button"
              onClick={() => updateStatus('sent')}
              disabled={pending !== null}
              className={`${PRIMARY_BUTTON} bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700`}
            >
              {pending === 'sent' ? 'Marking…' : 'Mark as sent'}
            </button>
          )}
          {canMarkPaid && (
            <button
              type="button"
              onClick={() => updateStatus('paid')}
              disabled={pending !== null}
              className={`${PRIMARY_BUTTON} bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600`}
            >
              {pending === 'paid' ? 'Recording…' : 'Mark as paid'}
            </button>
          )}
          <button type="button" onClick={() => window.print()} className={OUTLINE_BUTTON}>
            Print / Save PDF
          </button>
          {canMarkPaid &&
            (confirming === 'void' ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                <span className="font-medium text-red-800">Void this invoice?</span>
                <button
                  type="button"
                  onClick={() => updateStatus('void')}
                  disabled={pending !== null}
                  className="font-semibold text-red-700 underline-offset-2 hover:underline"
                >
                  {pending === 'void' ? 'Voiding…' : 'Yes, void it'}
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="text-slate-600 hover:text-slate-900">
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming('void')}
                disabled={pending !== null}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Void
              </button>
            ))}
          {invoice.status === 'draft' &&
            (confirming === 'delete' ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                <span className="font-medium text-red-800">Delete this draft for good?</span>
                <button
                  type="button"
                  onClick={deleteDraft}
                  disabled={pending !== null}
                  className="font-semibold text-red-700 underline-offset-2 hover:underline"
                >
                  {pending === 'delete' ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="text-slate-600 hover:text-slate-900">
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming('delete')}
                disabled={pending !== null}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Delete draft
              </button>
            ))}
        </div>
      </header>

      {overdue && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 print:hidden">
          <p className="text-sm font-semibold text-red-800">
            Overdue by {Math.abs(daysUntil(invoice.due_date))} day{Math.abs(daysUntil(invoice.due_date)) === 1 ? '' : 's'}.
          </p>
          <p className="text-sm text-red-700">A short, friendly reminder email usually gets this paid.</p>
        </div>
      )}

      {invoice.status === 'paid' && invoice.paid_at && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 print:hidden">
          <p className="text-sm font-semibold text-emerald-800">Paid on {formatDate(invoice.paid_at)} — this one&apos;s done. 💸</p>
        </div>
      )}

      <article aria-label="Invoice document" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">
              {profile?.business_name || profile?.full_name || 'Your business'}
            </p>
            {profile?.business_address && (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{profile.business_address}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
            <p className="text-base font-semibold text-slate-900">{invoice.invoice_number}</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed to</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{invoice.client_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued</dt>
            <dd className="mt-1 text-sm text-slate-900">{formatDate(invoice.issue_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDate(invoice.due_date)}
              <span className={`ml-2 text-xs ${overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {dueDescription(invoice.due_date, invoice.status)}
              </span>
            </dd>
          </div>
        </dl>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="pb-2">Description</th>
              <th scope="col" className="pb-2 text-right">Qty</th>
              <th scope="col" className="pb-2 text-right">Unit price</th>
              <th scope="col" className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  No line items yet.
                </td>
              </tr>
            ) : (
              invoice.line_items.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-900">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                  <td className="py-3 text-right text-slate-600">{formatMoneyFromCents(item.unit_price_cents, invoice.currency)}</td>
                  <td className="py-3 text-right font-medium text-slate-900">
                    {formatMoneyFromCents(Math.round(item.quantity * item.unit_price_cents), invoice.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">{formatMoneyFromCents(invoice.subtotal_cents, invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax</span>
            <span className="text-slate-900">{formatMoneyFromCents(invoice.tax_cents, invoice.currency)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              {formatMoneyFromCents(invoice.total_cents, invoice.currency)}
            </span>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{invoice.notes}</p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">Sent with InvoiceMemory</p>
      </article>

      <p className="text-xs text-slate-400 print:hidden">
        Created {formatDate(invoice.created_at)}
        {invoice.sent_at ? ` · Sent ${formatDate(invoice.sent_at)}` : ''}
        {invoice.paid_at ? ` · Paid ${formatDate(invoice.paid_at)}` : ''}
      </p>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg lg:bottom-8 print:hidden ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  return (
    <Suspense fallback={<DocSkeleton />}>
      <InvoiceView invoiceId={params.id} />
    </Suspense>
  );
}
