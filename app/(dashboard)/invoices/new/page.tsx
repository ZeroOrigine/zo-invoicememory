'use client';

// app/(dashboard)/invoices/new/page.tsx
//
// THE MAGIC TRICK. The form arrives ALREADY FILLED IN: the instant this page
// mounts it calls /api/invoices/prefill, so the number, dates, and currency
// are set before the user types a character. Pick a client and their memory
// snaps in — their currency, their terms, the exact line items you billed
// them last time as one-click chips. Show, don't ask.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import {
  CURRENCY_OPTIONS,
  addDaysToIso,
  centsToMoneyInput,
  formatDate,
  formatMoneyFromCents,
  parseMoneyToCents,
  todayISO,
} from '@/lib/format';
import type { ClientRecord, InvoiceDetail, PrefillData, SuggestedLineItem } from '@/lib/format';

interface LineItemDraft {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

function makeItem(partial?: Partial<Omit<LineItemDraft, 'key'>>): LineItemDraft {
  return {
    key: `li-${Math.random().toString(36).slice(2, 10)}`,
    description: '',
    quantity: '1',
    unitPrice: '',
    ...partial,
  };
}

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-40 rounded-xl bg-slate-200" />
          <div className="h-64 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
        </div>
        <div className="h-80 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

const INPUT_CLASSES =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20';

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client');
  const startedAtRef = useRef<number>(Date.now());

  const [loading, setLoading] = useState(true);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);

  const [clientQuery, setClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [clientListOpen, setClientListOpen] = useState(false);
  const [rememberClient, setRememberClient] = useState(true);
  const [memoryNote, setMemoryNote] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('INV-0001');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState<LineItemDraft[]>([makeItem()]);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [taxInput, setTaxInput] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState<'draft' | 'sent' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, tone: ToastState['tone']) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4500);
  }

  function applyBasePrefill(data: PrefillData) {
    setPrefill(data);
    setCurrency(data.currency);
    setIssueDate(data.issue_date);
    setDueDate(data.due_date);
    setInvoiceNumber(data.next_invoice_number);
    if (data.client) {
      setSelectedClient({ id: data.client.id, name: data.client.name });
      setClientQuery(data.client.name);
      setMemoryNote(buildMemoryNote(data));
    }
  }

  function buildMemoryNote(data: PrefillData): string {
    const bits = [`Net ${data.payment_terms_days}`, data.currency];
    if (data.suggested_line_items.length > 0) {
      bits.push(`${data.suggested_line_items.length} remembered item${data.suggested_line_items.length === 1 ? '' : 's'}`);
    }
    return bits.join(' · ');
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const prefillPath = preselectedClientId
        ? `/api/invoices/prefill?client_id=${encodeURIComponent(preselectedClientId)}`
        : '/api/invoices/prefill';

      const [prefillRes, clientsRes] = await Promise.all([
        apiFetch<PrefillData>(prefillPath),
        apiFetch<ClientRecord[]>('/api/clients?limit=100'),
      ]);
      if (cancelled) return;

      if (clientsRes.data) setClients(clientsRes.data);

      if (prefillRes.data) {
        applyBasePrefill(prefillRes.data);
      } else if (preselectedClientId) {
        // Stale ?client= link — fall back to a plain prefill so the form still glows.
        const fallback = await apiFetch<PrefillData>('/api/invoices/prefill');
        if (cancelled) return;
        if (fallback.data) {
          applyBasePrefill(fallback.data);
        } else {
          setIssueDate(todayISO());
          setDueDate(addDaysToIso(todayISO(), 30));
        }
      } else {
        // Prefill hiccuped — never block the user. Sensible defaults, keep moving.
        setIssueDate(todayISO());
        setDueDate(addDaysToIso(todayISO(), 30));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedClientId]);

  async function selectClient(client: ClientRecord) {
    setSelectedClient({ id: client.id, name: client.name });
    setClientQuery(client.name);
    setClientListOpen(false);
    setMemoryNote(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.client;
      return next;
    });

    const res = await apiFetch<PrefillData>(`/api/invoices/prefill?client_id=${client.id}`);
    if (res.data) {
      setPrefill(res.data);
      setCurrency(res.data.currency);
      const baseIssue = issueDate || res.data.issue_date;
      setDueDate(addDaysToIso(baseIssue, res.data.payment_terms_days));
      setInvoiceNumber(res.data.next_invoice_number);
      setMemoryNote(buildMemoryNote(res.data));
    }
  }

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients.slice(0, 8);
    return clients
      .filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          (client.company ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [clients, clientQuery]);

  const isNewClientName =
    clientQuery.trim().length > 0 &&
    !selectedClient &&
    !clients.some((client) => client.name.toLowerCase() === clientQuery.trim().toLowerCase());

  const availableSuggestions = useMemo<SuggestedLineItem[]>(() => {
    if (!prefill) return [];
    const usedDescriptions = new Set(items.map((item) => item.description.trim().toLowerCase()).filter(Boolean));
    return prefill.suggested_line_items.filter(
      (suggestion) => !usedDescriptions.has(suggestion.description.trim().toLowerCase()),
    );
  }, [prefill, items]);

  function addSuggestion(suggestion: SuggestedLineItem) {
    const newItem = makeItem({
      description: suggestion.description,
      quantity: String(suggestion.quantity),
      unitPrice: centsToMoneyInput(suggestion.unit_price_cents),
    });
    setItems((prev) => {
      const emptyIndex = prev.findIndex((item) => !item.description.trim() && !item.unitPrice.trim());
      if (emptyIndex >= 0) {
        const next = [...prev];
        next[emptyIndex] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
    setLastAddedKey(newItem.key);
    window.setTimeout(() => setLastAddedKey(null), 1200);
  }

  function updateItem(key: string, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length === 1 ? [makeItem()] : prev.filter((item) => item.key !== key)));
  }

  const subtotalCents = useMemo(() => {
    return items.reduce((total, item) => {
      const cents = parseMoneyToCents(item.unitPrice) ?? 0;
      const quantityValue = Number.parseFloat(item.quantity);
      const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
      return total + Math.round(quantity * cents);
    }, 0);
  }, [items]);

  const taxCents = useMemo(() => (taxInput.trim() ? (parseMoneyToCents(taxInput) ?? 0) : 0), [taxInput]);
  const totalCents = subtotalCents + taxCents;

  async function handleSubmit(status: 'draft' | 'sent') {
    setFieldErrors({});

    const trimmedName = clientQuery.trim();
    if (!trimmedName) {
      setFieldErrors({ client: 'Tell us who this invoice is for — pick a client or type a name.' });
      return;
    }

    const lineItems: Array<{ description: string; quantity: number; unit_price_cents: number }> = [];
    const rowErrors: Record<string, string> = {};
    for (const item of items) {
      const description = item.description.trim();
      if (!description) continue;
      const quantityValue = Number.parseFloat(item.quantity);
      const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
      const cents = item.unitPrice.trim() ? parseMoneyToCents(item.unitPrice) : 0;
      if (cents === null) {
        rowErrors[item.key] = "That price doesn't look like a number. Try something like 250.00.";
        continue;
      }
      lineItems.push({ description, quantity, unit_price_cents: cents });
    }

    if (Object.keys(rowErrors).length > 0) {
      setFieldErrors(rowErrors);
      showToast('One of the prices needs a second look.', 'error');
      return;
    }

    if (status === 'sent' && lineItems.length === 0) {
      showToast('Add at least one line item before marking it sent.', 'error');
      return;
    }

    const tax = taxInput.trim() ? parseMoneyToCents(taxInput) : 0;
    if (tax === null) {
      setFieldErrors({ tax: "That tax amount doesn't look like a number." });
      return;
    }

    setSubmitting(status);

    let clientId = selectedClient?.id ?? null;
    if (!clientId && rememberClient) {
      // The memory grows itself: new names become saved clients automatically.
      const created = await apiFetch<ClientRecord>('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName }),
      });
      if (created.data) {
        clientId = created.data.id;
      }
      // If saving quietly failed, the invoice still ships with client_name only.
    }

    const payload: Record<string, unknown> = {
      status,
      currency,
      issue_date: issueDate,
      due_date: dueDate,
      line_items: lineItems,
      tax_cents: tax,
    };
    if (clientId) {
      payload.client_id = clientId;
    } else {
      payload.client_name = trimmedName;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes) payload.notes = trimmedNotes;

    const res = await apiFetch<InvoiceDetail>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.data) {
      const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      router.push(`/invoices/${res.data.id}?created=1&secs=${seconds}`);
      return;
    }

    setSubmitting(null);
    if (res.fields) {
      const mapped: Record<string, string> = {};
      if (res.fields.client_id) mapped.client = res.fields.client_id;
      if (res.fields.due_date) mapped.due_date = res.fields.due_date;
      if (res.fields.tax_cents) mapped.tax = res.fields.tax_cents;
      setFieldErrors(mapped);
    }
    showToast(res.error ?? "We couldn't save that invoice just now. Nothing was lost — try again.", 'error');
  }

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/invoices" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
            ← Invoices
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">New invoice</h1>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
          {invoiceNumber} · auto-numbered for you
        </span>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="client-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="client-heading" className="text-sm font-bold text-slate-900">
              Who&apos;s it for?
            </h2>
            <div className="relative mt-3">
              <label htmlFor="client-input" className="sr-only">
                Client name
              </label>
              <input
                id="client-input"
                type="text"
                role="combobox"
                aria-expanded={clientListOpen}
                aria-controls="client-options"
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Start typing a name…"
                value={clientQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setClientQuery(value);
                  setClientListOpen(true);
                  if (selectedClient && value !== selectedClient.name) {
                    setSelectedClient(null);
                    setMemoryNote(null);
                  }
                }}
                onFocus={() => setClientListOpen(true)}
                onBlur={() => window.setTimeout(() => setClientListOpen(false), 120)}
                className={`${INPUT_CLASSES} ${fieldErrors.client ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {clientListOpen && (filteredClients.length > 0 || isNewClientName) && (
                <ul
                  id="client-options"
                  role="listbox"
                  aria-label="Client suggestions"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  {filteredClients.map((client) => (
                    <li key={client.id} role="option" aria-selected={selectedClient?.id === client.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectClient(client);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50"
                      >
                        <span className="font-medium text-slate-900">
                          {client.name}
                          {client.company && <span className="font-normal text-slate-500"> · {client.company}</span>}
                        </span>
                        {(client.currency || client.payment_terms_days !== null) && (
                          <span className="shrink-0 text-xs text-slate-400">
                            {[client.currency, client.payment_terms_days !== null ? `Net ${client.payment_terms_days}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {isNewClientName && (
                    <li role="option" aria-selected={false}>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setClientListOpen(false);
                        }}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        <span className="font-semibold">New:</span> &ldquo;{clientQuery.trim()}&rdquo; — we&apos;ll remember them
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
            {fieldErrors.client && <p className="mt-2 text-sm text-red-600">{fieldErrors.client}</p>}
            {memoryNote && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Memory applied: {memoryNote}
              </p>
            )}
            {isNewClientName && (
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberClient}
                  onChange={(event) => setRememberClient(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Remember &ldquo;{clientQuery.trim()}&rdquo; so next time fills itself
              </label>
            )}
          </section>

          <section aria-labelledby="items-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="items-heading" className="text-sm font-bold text-slate-900">
              What did you do?
            </h2>

            {availableSuggestions.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">From your memory — one click adds it</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.description}-${suggestion.last_used_on}`}
                      type="button"
                      onClick={() => addSuggestion(suggestion)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-800 transition-all hover:bg-blue-100 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <span aria-hidden="true">+</span>
                      <span className="max-w-[14rem] truncate font-medium">{suggestion.description}</span>
                      <span className="text-blue-500">{formatMoneyFromCents(suggestion.unit_price_cents, currency)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 hidden grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span className="col-span-6">Description</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-2">Unit price</span>
              <span className="col-span-1 text-right">Amount</span>
              <span className="col-span-1" />
            </div>

            <div className="mt-2 space-y-3">
              {items.map((item, index) => {
                const rowCents = parseMoneyToCents(item.unitPrice) ?? 0;
                const quantityValue = Number.parseFloat(item.quantity);
                const rowQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
                const rowAmount = Math.round(rowQuantity * rowCents);
                return (
                  <div key={item.key}>
                    <div
                      className={`grid grid-cols-12 items-center gap-2 rounded-lg transition-colors duration-700 ${
                        lastAddedKey === item.key ? 'bg-blue-50' : 'bg-transparent'
                      }`}
                    >
                      <input
                        type="text"
                        aria-label={`Line item ${index + 1} description`}
                        placeholder="What you did — e.g. Design retainer, March"
                        value={item.description}
                        onChange={(event) => updateItem(item.key, { description: event.target.value })}
                        className={`${INPUT_CLASSES} col-span-12 sm:col-span-6`}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Line item ${index + 1} quantity`}
                        placeholder="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                        className={`${INPUT_CLASSES} col-span-3 sm:col-span-2`}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Line item ${index + 1} unit price`}
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })}
                        className={`${INPUT_CLASSES} col-span-4 sm:col-span-2 ${fieldErrors[item.key] ? 'border-red-400' : ''}`}
                      />
                      <span className="col-span-4 truncate text-right text-sm text-slate-600 sm:col-span-1">
                        {rowAmount > 0 ? formatMoneyFromCents(rowAmount, currency) : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={`Remove line item ${index + 1}`}
                        className="col-span-1 justify-self-end rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                          <path d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {fieldErrors[item.key] && <p className="mt-1 text-sm text-red-600">{fieldErrors[item.key]}</p>}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, makeItem()])}
              className="mt-4 w-full rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              + Add another line
            </button>
          </section>

          <section aria-labelledby="details-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="details-heading" className="text-sm font-bold text-slate-900">
              Details
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="issue-date" className="mb-1 block text-xs font-semibold text-slate-600">
                  Issue date
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </div>
              <div>
                <label htmlFor="due-date" className="mb-1 block text-xs font-semibold text-slate-600">
                  Due date
                </label>
                <input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={`${INPUT_CLASSES} ${fieldErrors.due_date ? 'border-red-400' : ''}`}
                />
                {fieldErrors.due_date && <p className="mt-1 text-sm text-red-600">{fieldErrors.due_date}</p>}
              </div>
              <div>
                <label htmlFor="currency" className="mb-1 block text-xs font-semibold text-slate-600">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={INPUT_CLASSES}
                >
                  {(CURRENCY_OPTIONS.includes(currency as (typeof CURRENCY_OPTIONS)[number])
                    ? CURRENCY_OPTIONS
                    : [currency, ...CURRENCY_OPTIONS]
                  ).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="notes" className="mb-1 block text-xs font-semibold text-slate-600">
                Note (optional)
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="Payment instructions, a thank-you — anything you want on the invoice."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={INPUT_CLASSES}
              />
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1" aria-label="Invoice summary">
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Invoice</dt>
                  <dd className="font-semibold text-slate-900">{invoiceNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Issued</dt>
                  <dd className="text-slate-900">{issueDate ? formatDate(issueDate) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Due</dt>
                  <dd className="text-slate-900">{dueDate ? formatDate(dueDate) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">For</dt>
                  <dd className="truncate font-medium text-slate-900">{clientQuery.trim() || '—'}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">{formatMoneyFromCents(subtotalCents, currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="tax-input" className="text-slate-500">
                    Tax
                  </label>
                  <input
                    id="tax-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={taxInput}
                    onChange={(event) => setTaxInput(event.target.value)}
                    className={`w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                      fieldErrors.tax ? 'border-red-400' : ''
                    }`}
                  />
                </div>
                {fieldErrors.tax && <p className="text-right text-sm text-red-600">{fieldErrors.tax}</p>}
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-2xl font-bold tracking-tight text-slate-900">{formatMoneyFromCents(totalCents, currency)}</span>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => handleSubmit('sent')}
                  disabled={submitting !== null}
                  className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  {submitting === 'sent' ? 'Creating…' : 'Create & mark sent'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('draft')}
                  disabled={submitting !== null}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  {submitting === 'draft' ? 'Saving…' : 'Save as draft'}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Numbered {invoiceNumber} automatically. Totals are computed for you — no math errors, ever.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg lg:bottom-8 ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewInvoiceForm />
    </Suspense>
  );
}
