// lib/format.ts
//
// Pure formatting + shared domain types for InvoiceMemory's frontend.
// NO Tailwind classes in this file (it is outside Tailwind's content globs).
// Money is ALWAYS integer cents. These helpers are the only place cents
// become display strings, so rounding bugs have exactly one home.

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

export interface InvoiceSummary {
  id: string;
  client_id: string | null;
  client_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  line_items: InvoiceLineItem[];
  notes: string | null;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  address: string | null;
  currency: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  business_address: string | null;
  default_currency: string;
  default_payment_terms_days: number;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface SuggestedLineItem extends InvoiceLineItem {
  last_used_on: string;
}

export interface PrefillData {
  client: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
    currency: string | null;
    payment_terms_days: number | null;
  } | null;
  currency: string;
  payment_terms_days: number;
  issue_date: string;
  due_date: string;
  next_invoice_number: string;
  suggested_line_items: SuggestedLineItem[];
}

export interface SubscriptionRecord {
  plan: 'free' | 'pro' | 'business';
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

export interface PaymentRecord {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  created_at: string;
}

export const CURRENCY_OPTIONS = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
  'JPY',
  'CHF',
  'SEK',
  'NZD',
] as const;

/** 250000 cents + 'USD' -> "$2,500.00". Never throws on odd currency codes. */
export function formatMoneyFromCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** "1,250.50" -> 125050. Returns null when the input is not a usable price. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** 125050 -> "1250.50" for pre-filling money inputs. */
export function centsToMoneyInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Works for both date-only ('2026-04-01') and timestamptz ISO strings. */
export function formatDate(iso: string): string {
  const value = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`);
  if (Number.isNaN(value.getTime())) return iso;
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Local calendar date as YYYY-MM-DD (matches what the API defaults to). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysToIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from today (local) to the given date. Negative = in the past. */
export function daysUntil(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return 0;
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

/** Human due-date phrase with the invoice status folded in. */
export function dueDescription(dueDate: string, status: InvoiceStatus): string {
  if (status === 'paid') return 'Paid';
  if (status === 'void') return 'Void';
  if (status === 'draft') return `Due ${formatDate(dueDate)}`;
  const days = daysUntil(dueDate);
  if (days > 1) return `Due in ${days} days`;
  if (days === 1) return 'Due tomorrow';
  if (days === 0) return 'Due today';
  if (days === -1) return '1 day overdue';
  return `${Math.abs(days)} days overdue`;
}

export function isPastDue(status: InvoiceStatus, dueDate: string): boolean {
  return (status === 'sent' || status === 'viewed' || status === 'overdue') && daysUntil(dueDate) < 0;
}
