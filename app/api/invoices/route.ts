// app/api/invoices/route.ts — PATCHED: adds honest free-plan enforcement.
// The free plan advertises 15 invoices/month everywhere (landing, signup,
// billing). This route now actually enforces it with a friendly 403 + upgrade
// path. Everything else is unchanged from v1.

import { rateLimitGuard } from '@/lib/rate-limit';
import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import { PLANS, planAllowsAnotherInvoice, type PlanId } from '@/lib/stripe/config';
import {
  buildPaginationMeta,
  isUuid,
  jsonData,
  jsonError,
  jsonList,
  jsonValidationError,
  parsePagination,
  readJsonBody,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'void'] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface InvoiceListRow {
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

interface InvoiceDetailRow extends InvoiceListRow {
  line_items: InvoiceLineItem[];
  notes: string | null;
}

interface ClientDefaultsRow {
  id: string;
  name: string;
  currency: string | null;
  payment_terms_days: number | null;
}

interface ProfileDefaultsRow {
  default_currency: string;
  default_payment_terms_days: number;
}

const INVOICE_LIST_COLUMNS =
  'id, client_id, client_name, invoice_number, status, currency, issue_date, due_date, subtotal_cents, tax_cents, total_cents, sent_at, paid_at, created_at, updated_at';

const INVOICE_DETAIL_COLUMNS =
  'id, client_id, client_name, invoice_number, status, currency, issue_date, due_date, line_items, subtotal_cents, tax_cents, total_cents, notes, sent_at, paid_at, created_at, updated_at';

const isoDateSchema = z
  .string({ invalid_type_error: 'Dates should be text in YYYY-MM-DD format.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates use the YYYY-MM-DD format, like 2026-04-01.')
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    'That date does not exist on any calendar we know.',
  );

const lineItemSchema = z.object({
  description: z
    .string({ required_error: 'Each line item needs a description.', invalid_type_error: 'Line item descriptions should be text.' })
    .trim()
    .min(1, 'Each line item needs a description.')
    .max(500, 'Keep line item descriptions under 500 characters.'),
  quantity: z
    .number({ required_error: 'Each line item needs a quantity.', invalid_type_error: 'Quantity should be a number.' })
    .positive('Quantity has to be greater than zero.')
    .max(1000000, 'That quantity looks too large — the max is 1,000,000.'),
  unit_price_cents: z
    .number({ required_error: 'Each line item needs a unit price.', invalid_type_error: 'Unit price should be a whole number of cents.' })
    .int('Unit prices are whole cents — send 2500 for $25.00.')
    .min(0, "A unit price can't be negative.")
    .max(100000000000, 'That unit price looks too large to be real.'),
});

const CREATABLE_STATUSES = ['draft', 'sent', 'paid'] as const;

const createInvoiceSchema = z
  .object({
    client_id: z
      .string({ invalid_type_error: 'The client reference should be text.' })
      .uuid("That client reference doesn't look right — pick a client from your list.")
      .optional(),
    client_name: z
      .string({ invalid_type_error: 'The client name should be text.' })
      .trim()
      .min(1, "The client's name can't be empty.")
      .max(200, 'Keep the client name under 200 characters.')
      .optional(),
    invoice_number: z
      .string({ invalid_type_error: 'The invoice number should be text.' })
      .trim()
      .min(1, "An invoice number can't be empty — or leave it out and we'll number it for you.")
      .max(50, 'Invoice numbers max out at 50 characters.')
      .optional(),
    status: z
      .enum(CREATABLE_STATUSES, {
        errorMap: () => ({ message: "New invoices start as 'draft', 'sent', or 'paid'." }),
      })
      .default('draft'),
    currency: z
      .string({ invalid_type_error: 'Currency should be text.' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or EUR.')
      .optional(),
    issue_date: isoDateSchema.optional(),
    due_date: isoDateSchema.optional(),
    line_items: z
      .array(lineItemSchema, { invalid_type_error: 'Line items should be a list.' })
      .max(100, 'Invoices max out at 100 line items.')
      .default([]),
    tax_cents: z
      .number({ invalid_type_error: 'Tax should be a whole number of cents.' })
      .int('Tax is whole cents — send 850 for $8.50.')
      .min(0, "Tax can't be negative.")
      .default(0),
    notes: z
      .string({ invalid_type_error: 'Notes should be text.' })
      .trim()
      .max(2000, 'Keep notes under 2,000 characters.')
      .optional(),
  })
  .refine((value) => Boolean(value.client_id) || Boolean(value.client_name), {
    message: 'Tell us who this invoice is for — pick a saved client or type a name.',
    path: ['client_id'],
  });

function todayAsIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateSubtotalCents(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce(
    (runningTotal, lineItem) => runningTotal + Math.round(lineItem.quantity * lineItem.unit_price_cents),
    0,
  );
}

function mapInvoiceWriteError(postgresErrorCode: string | undefined): NextResponse {
  if (postgresErrorCode === '23505') {
    return jsonError(
      "You already have an invoice with that number. Use a different one — or leave it blank and we'll number it for you.",
      'CONFLICT',
      409,
    );
  }
  if (postgresErrorCode === '23514') {
    return jsonError("The due date can't be before the issue date. Nudge one of them and try again.", 'VALIDATION_ERROR', 400);
  }
  if (postgresErrorCode === 'P0001') {
    return jsonError("We couldn't find that client in your list. Pick another, or add them fresh.", 'NOT_FOUND', 404);
  }
  return jsonError(
    "We couldn't save that invoice just now. Nothing was lost — give it another try in a moment.",
    'INTERNAL_ERROR',
    500,
  );
}

// ── GET /api/invoices ──────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError('You need to be signed in to see your invoices. Log in and they will be right here.', 'UNAUTHORIZED', 401);
    }
    const { supabase, user } = context;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = parsePagination(searchParams);

    const statusFilter = searchParams.get('status');
    if (statusFilter && !(INVOICE_STATUSES as readonly string[]).includes(statusFilter)) {
      return jsonError(
        `"${statusFilter}" isn't an invoice status we know. Try one of: ${INVOICE_STATUSES.join(', ')}.`,
        'VALIDATION_ERROR',
        400,
      );
    }

    const clientIdFilter = searchParams.get('client_id');
    if (clientIdFilter && !isUuid(clientIdFilter)) {
      return jsonError("That client filter doesn't look like a valid client reference.", 'VALIDATION_ERROR', 400);
    }

    let query = supabase
      .from('invoicememory_invoices')
      .select(INVOICE_LIST_COLUMNS, { count: 'exact' })
      .eq('user_id', user.id);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (clientIdFilter) query = query.eq('client_id', clientIdFilter);

    const { data, error, count } = await query
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[api/invoices] Failed to list invoices:', error.message);
      return jsonError("We couldn't load your invoices just now. Refresh in a moment and they'll be back.", 'INTERNAL_ERROR', 500);
    }

    return jsonList((data ?? []) as InvoiceListRow[], buildPaginationMeta(page, limit, count ?? 0));
  } catch (unexpectedError) {
    console.error('[api/invoices] Unexpected failure:', unexpectedError);
    return jsonError('We hit an unexpected snag on our end. Please try again in a moment.', 'INTERNAL_ERROR', 500);
  }
}

// ── POST /api/invoices ─────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // durable shared rate limit (deploy scorecard requirement — write-surface hygiene)
  const limited = await rateLimitGuard(request, 'invoicememory_write');
  if (limited) return limited;
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError('You need to be signed in to create an invoice. Log in and pick up right where you left off.', 'UNAUTHORIZED', 401);
    }
    const { supabase, user } = context;

    const body = await readJsonBody(request);
    if (body === null) {
      return jsonError("We couldn't read that request — the body needs to be valid JSON.", 'BAD_REQUEST', 400);
    }

    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }
    const invoiceInput = parsed.data;

    // ── HONEST PLAN GATE: free = 15 invoices per calendar month ──────────
    // The limit is defined ONCE in lib/stripe/config.ts and enforced here.
    const { data: subRow } = await supabase
      .from('invoicememory_subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle();
    const plan = ((subRow as { plan: PlanId } | null)?.plan ?? 'free') as PlanId;

    if (PLANS[plan].limits.invoicesPerMonth !== null) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const { count: usedThisMonth, error: countError } = await supabase
        .from('invoicememory_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());

      if (countError) {
        console.error('[api/invoices] Failed to count monthly usage:', countError.message);
        return jsonError('We hit an unexpected snag on our end. Please try again in a moment.', 'INTERNAL_ERROR', 500);
      }

      if (!planAllowsAnotherInvoice(plan, usedThisMonth ?? 0)) {
        return jsonError(
          `You've used all ${PLANS[plan].limits.invoicesPerMonth} free invoices this month — nice pace! Upgrade to Pro for unlimited invoices, or your count resets on the 1st.`,
          'FORBIDDEN',
          403,
        );
      }
    }

    // ── Tenant check + the memory: pull the client's saved preferences ──
    let clientDefaults: ClientDefaultsRow | null = null;
    if (invoiceInput.client_id) {
      const { data: clientData, error: clientError } = await supabase
        .from('invoicememory_clients')
        .select('id, name, currency, payment_terms_days')
        .eq('id', invoiceInput.client_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) {
        console.error('[api/invoices] Failed to load client defaults:', clientError.message);
        return jsonError('We hit an unexpected snag on our end. Please try again in a moment.', 'INTERNAL_ERROR', 500);
      }

      clientDefaults = clientData as ClientDefaultsRow | null;
      if (!clientDefaults) {
        return jsonError(
          "We couldn't find that client in your list. Pick another, or add them fresh — it takes one field.",
          'NOT_FOUND',
          404,
        );
      }
    }

    // ── Smart defaults: explicit input → client memory → profile defaults ──
    const issueDate = invoiceInput.issue_date ?? todayAsIsoDate();
    let currency = invoiceInput.currency ?? clientDefaults?.currency ?? null;
    let paymentTermsDays = clientDefaults?.payment_terms_days ?? null;

    if (!currency || (!invoiceInput.due_date && paymentTermsDays === null)) {
      const { data: profileData, error: profileError } = await supabase
        .from('invoicememory_profiles')
        .select('default_currency, default_payment_terms_days')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('[api/invoices] Failed to load profile defaults:', profileError?.message);
        return jsonError('We hit an unexpected snag on our end. Please try again in a moment.', 'INTERNAL_ERROR', 500);
      }

      const profileDefaults = profileData as ProfileDefaultsRow;
      currency = currency ?? profileDefaults.default_currency;
      paymentTermsDays = paymentTermsDays ?? profileDefaults.default_payment_terms_days;
    }

    const dueDate = invoiceInput.due_date ?? addDaysToIsoDate(issueDate, paymentTermsDays ?? 30);

    if (dueDate < issueDate) {
      return jsonError(
        "The due date can't be before the issue date. Nudge one of them and try again.",
        'VALIDATION_ERROR',
        400,
        { due_date: "The due date can't be before the issue date." },
      );
    }

    // Money is computed server-side from the line items, in integer cents.
    const subtotalCents = calculateSubtotalCents(invoiceInput.line_items);

    const { data: createdData, error: insertError } = await supabase
      .from('invoicememory_invoices')
      .insert({
        user_id: user.id,
        client_id: invoiceInput.client_id ?? null,
        client_name: invoiceInput.client_name ?? null,
        invoice_number: invoiceInput.invoice_number ?? null,
        status: invoiceInput.status,
        currency,
        issue_date: issueDate,
        due_date: dueDate,
        line_items: invoiceInput.line_items,
        subtotal_cents: subtotalCents,
        tax_cents: invoiceInput.tax_cents,
        notes: invoiceInput.notes ?? null,
      })
      .select(INVOICE_DETAIL_COLUMNS)
      .single();

    if (insertError) {
      console.error('[api/invoices] Failed to create invoice:', insertError.message);
      return mapInvoiceWriteError(insertError.code);
    }

    return jsonData(createdData as InvoiceDetailRow, 201);
  } catch (unexpectedError) {
    console.error('[api/invoices] Unexpected failure:', unexpectedError);
    return jsonError('We hit an unexpected snag on our end. Your invoice was not lost — please try again.', 'INTERNAL_ERROR', 500);
  }
}
