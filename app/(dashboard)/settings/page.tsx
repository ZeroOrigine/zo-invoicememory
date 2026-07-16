'use client';

// app/(dashboard)/settings/page.tsx
//
// The smart defaults that pre-fill every invoice. Two small sections, never
// more than three fields visible per card. Saving here makes every future
// invoice smarter — the copy says exactly that.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client-api';
import { CURRENCY_OPTIONS } from '@/lib/format';
import type { ProfileRecord } from '@/lib/format';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

const INPUT_CLASSES =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20';

const QUICK_TERMS = [7, 14, 30, 45, 60];

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-40 rounded bg-slate-200" />
      <div className="h-56 rounded-xl bg-slate-200" />
      <div className="h-48 rounded-xl bg-slate-200" />
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [terms, setTerms] = useState('30');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, tone: ToastState['tone']) {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await apiFetch<ProfileRecord>('/api/profile');
      if (cancelled) return;
      if (res.data) {
        setEmail(res.data.email);
        setFullName(res.data.full_name ?? '');
        setBusinessName(res.data.business_name ?? '');
        setBusinessAddress(res.data.business_address ?? '');
        setCurrency(res.data.default_currency);
        setTerms(String(res.data.default_payment_terms_days));
      } else {
        showToast(res.error ?? "We couldn't load your profile just now.", 'error');
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const termsValue = Number.parseInt(terms, 10);
    if (!Number.isFinite(termsValue) || termsValue < 0 || termsValue > 365) {
      setFieldErrors({ default_payment_terms_days: 'Payment terms should be between 0 and 365 days.' });
      return;
    }

    const payload: Record<string, unknown> = {
      business_name: businessName.trim() || null,
      business_address: businessAddress.trim() || null,
      default_currency: currency,
      default_payment_terms_days: termsValue,
    };
    if (fullName.trim()) payload.full_name = fullName.trim();

    setSaving(true);
    const res = await apiFetch<ProfileRecord>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.data) {
      showToast('Saved — every new invoice starts from these.', 'success');
      return;
    }
    if (res.fields) setFieldErrors(res.fields);
    showToast(res.error ?? "We couldn't save those changes just now. Nothing was lost.", 'error');
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">These defaults pre-fill every invoice. Client-specific memory overrides them.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-6" noValidate>
        <section aria-labelledby="business-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="business-heading" className="text-sm font-bold text-slate-900">
            You &amp; your business
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">This appears at the top of every invoice you send.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="full-name" className="mb-1 block text-xs font-semibold text-slate-600">
                Your name
              </label>
              <input
                id="full-name"
                type="text"
                placeholder="Sam Rivera"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.full_name ? 'border-red-400' : ''}`}
              />
              {fieldErrors.full_name && <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name}</p>}
            </div>
            <div>
              <label htmlFor="business-name" className="mb-1 block text-xs font-semibold text-slate-600">
                Business name
              </label>
              <input
                id="business-name"
                type="text"
                placeholder="Rivera Design Studio"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.business_name ? 'border-red-400' : ''}`}
              />
              {fieldErrors.business_name && <p className="mt-1 text-sm text-red-600">{fieldErrors.business_name}</p>}
            </div>
            <div>
              <label htmlFor="business-address" className="mb-1 block text-xs font-semibold text-slate-600">
                Business address
              </label>
              <textarea
                id="business-address"
                rows={3}
                placeholder={'123 Studio Lane\nPortland, OR 97201'}
                value={businessAddress}
                onChange={(event) => setBusinessAddress(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.business_address ? 'border-red-400' : ''}`}
              />
              {fieldErrors.business_address && <p className="mt-1 text-sm text-red-600">{fieldErrors.business_address}</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="defaults-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="defaults-heading" className="text-sm font-bold text-slate-900">
            Invoice defaults
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Applied automatically unless a client&apos;s memory says otherwise.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="default-currency" className="mb-1 block text-xs font-semibold text-slate-600">
                Currency
              </label>
              <select
                id="default-currency"
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
            <div>
              <label htmlFor="default-terms" className="mb-1 block text-xs font-semibold text-slate-600">
                Payment terms (days)
              </label>
              <input
                id="default-terms"
                type="number"
                min={0}
                max={365}
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className={`${INPUT_CLASSES} ${fieldErrors.default_payment_terms_days ? 'border-red-400' : ''}`}
              />
              {fieldErrors.default_payment_terms_days && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.default_payment_terms_days}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_TERMS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTerms(String(value))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      terms === String(value)
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Net {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <section aria-labelledby="account-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="account-heading" className="text-sm font-bold text-slate-900">
          Account
        </h2>
        <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">
            Signed in as <span className="font-semibold text-slate-900">{email}</span>
          </p>
          <Link href="/billing" className="font-medium text-blue-700 transition-colors hover:text-blue-800">
            Manage plan &amp; billing →
          </Link>
        </div>
      </section>

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
