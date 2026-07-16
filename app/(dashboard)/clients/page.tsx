'use client';

// app/(dashboard)/clients/page.tsx
//
// The memory itself. Save a client once and every future invoice to them
// fills itself. Archiving is soft (invoice history stays intact) and comes
// with a one-click Undo — mistakes cost nothing here.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client-api';
import { CURRENCY_OPTIONS } from '@/lib/format';
import type { ClientRecord } from '@/lib/format';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

const INPUT_CLASSES =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20';

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function sortByName(list: ClientRecord[]): ClientRecord[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formCurrency, setFormCurrency] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function showToast(next: ToastState) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 6000);
  }

  async function fetchClients(term: string) {
    const path = term
      ? `/api/clients?limit=100&search=${encodeURIComponent(term)}`
      : '/api/clients?limit=100';
    const res = await apiFetch<ClientRecord[]>(path);
    if (res.data) {
      setClients(res.data);
    } else if (res.error) {
      showToast({ message: res.error, tone: 'error' });
    }
    setLoading(false);
    setHasEverLoaded(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchClients(search.trim());
    }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function resetForm() {
    setFormName('');
    setFormEmail('');
    setFormCompany('');
    setFormCurrency('');
    setFormTerms('');
    setMoreOpen(false);
    setFieldErrors({});
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const name = formName.trim();
    if (!name) {
      setFieldErrors({ name: 'Give this client a name — that is all we need to remember them.' });
      return;
    }

    const payload: Record<string, unknown> = { name };
    if (formEmail.trim()) payload.email = formEmail.trim();
    if (formCompany.trim()) payload.company = formCompany.trim();
    if (formCurrency) payload.currency = formCurrency;
    if (formTerms.trim()) {
      const terms = Number.parseInt(formTerms, 10);
      if (!Number.isFinite(terms) || terms < 0 || terms > 365) {
        setFieldErrors({ payment_terms_days: 'Payment terms should be between 0 and 365 days.' });
        return;
      }
      payload.payment_terms_days = terms;
    }

    setSaving(true);
    const res = await apiFetch<ClientRecord>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.data) {
      setClients((prev) => sortByName([res.data as ClientRecord, ...prev]));
      showToast({ message: `${res.data.name} is in your memory now. Next invoice to them fills itself.`, tone: 'success' });
      resetForm();
      setAddOpen(false);
      return;
    }

    if (res.fields) setFieldErrors(res.fields);
    showToast({ message: res.error ?? "We couldn't save that client just now. Try again in a moment.", tone: 'error' });
  }

  async function archiveClient(client: ClientRecord) {
    setArchivingId(client.id);
    const res = await apiFetch<{ id: string; archived: boolean }>(`/api/clients/${client.id}`, {
      method: 'DELETE',
    });
    setArchivingId(null);

    if (!res.data) {
      showToast({ message: res.error ?? "We couldn't archive that client just now.", tone: 'error' });
      return;
    }

    setClients((prev) => prev.filter((item) => item.id !== client.id));
    showToast({
      message: `${client.name} archived. Their invoice history stays intact.`,
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: async () => {
          setToast(null);
          const restore = await apiFetch<ClientRecord>(`/api/clients/${client.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ archived: false }),
          });
          if (restore.data) {
            setClients((prev) => sortByName([restore.data as ClientRecord, ...prev]));
            showToast({ message: `${client.name} is back in your memory.`, tone: 'success' });
          } else {
            showToast({ message: restore.error ?? "We couldn't bring them back just now.", tone: 'error' });
          }
        },
      },
    });
  }

  const showFirstRunEmpty = hasEverLoaded && !loading && clients.length === 0 && !search.trim();
  const showSearchEmpty = hasEverLoaded && !loading && clients.length === 0 && Boolean(search.trim());

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Clients</h1>
          <p className="mt-1 text-sm text-slate-600">Your memory. Every saved client makes the next invoice instant.</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {addOpen ? 'Close' : 'Add client'}
        </button>
      </header>

      {addOpen && (
        <form onSubmit={handleAdd} className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="client-name" className="mb-1 block text-xs font-semibold text-slate-600">
                Name <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="client-name"
                type="text"
                required
                placeholder="Acme Corp"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.name ? 'border-red-400' : ''}`}
              />
              {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="client-email" className="mb-1 block text-xs font-semibold text-slate-600">
                Email (optional)
              </label>
              <input
                id="client-email"
                type="email"
                placeholder="billing@acme.com"
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.email ? 'border-red-400' : ''}`}
              />
              {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className="mt-3 text-sm font-medium text-blue-700 transition-colors hover:text-blue-800"
          >
            {moreOpen ? 'Fewer options' : 'More options (company, currency, terms)'}
          </button>

          {moreOpen && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="client-company" className="mb-1 block text-xs font-semibold text-slate-600">
                  Company
                </label>
                <input
                  id="client-company"
                  type="text"
                  placeholder="Acme Corporation"
                  value={formCompany}
                  onChange={(event) => setFormCompany(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </div>
              <div>
                <label htmlFor="client-currency" className="mb-1 block text-xs font-semibold text-slate-600">
                  Currency
                </label>
                <select
                  id="client-currency"
                  value={formCurrency}
                  onChange={(event) => setFormCurrency(event.target.value)}
                  className={INPUT_CLASSES}
                >
                  <option value="">Use my default</option>
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="client-terms" className="mb-1 block text-xs font-semibold text-slate-600">
                  Payment terms (days)
                </label>
                <input
                  id="client-terms"
                  type="number"
                  min={0}
                  max={365}
                  placeholder="Use my default"
                  value={formTerms}
                  onChange={(event) => setFormTerms(event.target.value)}
                  className={`${INPUT_CLASSES} ${fieldErrors.payment_terms_days ? 'border-red-400' : ''}`}
                />
                {fieldErrors.payment_terms_days && <p className="mt-1 text-sm text-red-600">{fieldErrors.payment_terms_days}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {saving ? 'Saving…' : 'Save client'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setAddOpen(false);
              }}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(clients.length > 0 || search.trim() !== '') && (
        <div>
          <label htmlFor="client-search" className="sr-only">
            Search clients
          </label>
          <input
            id="client-search"
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${INPUT_CLASSES} max-w-sm`}
          />
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-20 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : showFirstRunEmpty ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">Save a client once. Never type their details again.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Their currency, payment terms, and the line items you bill them snap into every new invoice automatically.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Add your first client
          </button>
        </div>
      ) : showSearchEmpty ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No one named &ldquo;{search.trim()}&rdquo; yet.</p>
          <button
            type="button"
            onClick={() => {
              setFormName(search.trim());
              setAddOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Add &ldquo;{search.trim()}&rdquo; to your memory
          </button>
        </div>
      ) : (
        <section aria-label="Client list" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800"
                  >
                    {initialsOf(client.name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                    <p className="text-xs text-slate-500">
                      {[client.company, client.email].filter(Boolean).join(' · ') || 'No contact details yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-xs text-slate-500">
                    {client.currency || client.payment_terms_days !== null ? (
                      <span className="inline-flex flex-wrap gap-1.5">
                        {client.currency && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{client.currency}</span>
                        )}
                        {client.payment_terms_days !== null && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            Net {client.payment_terms_days}
                          </span>
                        )}
                      </span>
                    ) : (
                      'Uses your defaults'
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/invoices/new?client=${client.id}`}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      New invoice
                    </Link>
                    <button
                      type="button"
                      onClick={() => archiveClient(client)}
                      disabled={archivingId === client.id}
                      aria-label={`Archive ${client.name}`}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      {archivingId === client.id ? 'Archiving…' : 'Archive'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg lg:bottom-8 ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onClick}
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1 font-semibold transition-colors hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
