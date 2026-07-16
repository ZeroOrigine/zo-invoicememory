// app/api/invoices/prefill/route.ts
//
// The InvoiceMemory magic trick. One GET returns everything needed to render
// a new invoice that is ALREADY FILLED IN:
//
//   GET /api/invoices/prefill              → your defaults + recent line items
//   GET /api/invoices/prefill?client_id=…  → that client's memory: their
//        currency, their payment terms, the line items you last billed them
//
// The UI calls this the instant the user says "new invoice" — before they
// type a single character. Show, don't ask.
//
// (Static segment `prefill` wins over the dynamic `[id]` sibling in the App
// Router, so there is no route conflict.)

import type { NextResponse } from 'next/server';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import { isUuid, jsonData, jsonError } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────

interface SuggestedLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
  last_used_on: string;
}

interface PrefillClient {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  currency: string | null;
  payment_terms_days: number | null;
}

interface PrefillResponse {
  client: PrefillClient | null;
  currency: string;
  payment_terms_days: number;
  issue_date: string;
  due_date: string;
  next_invoice_number: string;
  suggested_line_items: SuggestedLineItem[];
}

interface ProfilePrefillRow {
  default_currency: string;
  default_payment_terms_days: number;
  invoice_seq: number;
}

interface RecentInvoiceRow {
  line_items: unknown;
  issue_date: string;
}

const SUGGESTION_SOURCE_INVOICE_COUNT = 5;
const SUGGESTION_LIMIT = 10;

// ── Helpers ──────────────────────────────────────────────────────────────

function todayAsIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ── GET /api/invoices/prefill ────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError('You need to be signed in for this. Log in and try again.', 'UNAUTHORIZED', 401);
    }
    const { supabase, user } = context;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    if (clientId && !isUuid(clientId)) {
      return jsonError(
        "That client reference doesn't look right — pick a client from your list.",
        'VALIDATION_ERROR',
        400,
      );
    }

    const { data: profileData, error: profileError } = await supabase
      .from('invoicememory_profiles')
      .select('default_currency, default_payment_terms_days, invoice_seq')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('[api/invoices/prefill] Failed to load profile:', profileError?.message);
      return jsonError(
        "We couldn't warm up your invoice just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }
    const profile = profileData as ProfilePrefillRow;

    let client: PrefillClient | null = null;
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from('invoicememory_clients')
        .select('id, name, email, company, currency, payment_terms_days')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) {
        console.error('[api/invoices/prefill] Failed to load client:', clientError.message);
        return jsonError(
          "We couldn't warm up your invoice just now. Give it another try in a moment.",
          'INTERNAL_ERROR',
          500,
        );
      }

      client = clientData as PrefillClient | null;
      if (!client) {
        return jsonError(
          "We couldn't find that client in your list. Pick another, or add them fresh.",
          'NOT_FOUND',
          404,
        );
      }
    }

    // Anticipate, don't ask: client memory wins, profile defaults fill the rest.
    const currency = client?.currency ?? profile.default_currency;
    const paymentTermsDays = client?.payment_terms_days ?? profile.default_payment_terms_days;
    const issueDate = todayAsIsoDate();
    const dueDate = addDaysToIsoDate(issueDate, paymentTermsDays);

    // The "remember my line items" memory: recent invoices (this client's when
    // scoped, otherwise the user's), deduped by description, newest first.
    // Suggestions are a bonus, never a blocker — failures degrade gracefully.
    let recentInvoicesQuery = supabase
      .from('invoicememory_invoices')
      .select('line_items, issue_date')
      .eq('user_id', user.id);
    if (clientId) {
      recentInvoicesQuery = recentInvoicesQuery.eq('client_id', clientId);
    }

    const { data: recentInvoicesData, error: recentInvoicesError } = await recentInvoicesQuery
      .order('issue_date', { ascending: false })
      .limit(SUGGESTION_SOURCE_INVOICE_COUNT);

    if (recentInvoicesError) {
      console.error('[api/invoices/prefill] Failed to load suggestions:', recentInvoicesError.message);
    }

    const suggestedLineItems: SuggestedLineItem[] = [];
    const seenDescriptions = new Set<string>();

    for (const invoiceRow of (recentInvoicesData ?? []) as RecentInvoiceRow[]) {
      if (!Array.isArray(invoiceRow.line_items)) {
        continue;
      }
      for (const rawLineItem of invoiceRow.line_items as Array<Record<string, unknown>>) {
        const description = rawLineItem.description;
        if (typeof description !== 'string' || description.trim().length === 0) {
          continue;
        }
        const normalizedDescription = description.trim().toLowerCase();
        if (seenDescriptions.has(normalizedDescription)) {
          continue;
        }
        seenDescriptions.add(normalizedDescription);
        suggestedLineItems.push({
          description: description.trim(),
          quantity: typeof rawLineItem.quantity === 'number' ? rawLineItem.quantity : 1,
          unit_price_cents:
            typeof rawLineItem.unit_price_cents === 'number' ? rawLineItem.unit_price_cents : 0,
          last_used_on: invoiceRow.issue_date,
        });
        if (suggestedLineItems.length >= SUGGESTION_LIMIT) {
          break;
        }
      }
      if (suggestedLineItems.length >= SUGGESTION_LIMIT) {
        break;
      }
    }

    const prefill: PrefillResponse = {
      client,
      currency,
      payment_terms_days: paymentTermsDays,
      issue_date: issueDate,
      due_date: dueDate,
      // Preview only — the database assigns the real number atomically at
      // insert time, so two open tabs can never collide.
      next_invoice_number: `INV-${String(profile.invoice_seq + 1).padStart(4, '0')}`,
      suggested_line_items: suggestedLineItems,
    };

    return jsonData(prefill);
  } catch (unexpectedError) {
    console.error('[api/invoices/prefill] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
