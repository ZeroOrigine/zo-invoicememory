// app/api/invoices/[id]/route.ts
//
//   GET    → one invoice, line items included
//   PATCH  → edit fields or move the invoice through its lifecycle
//   DELETE → drafts only — issued invoices are financial records and must be
//            voided (status = 'void'), never erased. RLS enforces the same
//            rule at the database layer; this route just says it kindly.
//
// Status transitions to 'sent' / 'paid' stamp sent_at / paid_at via the
// database trigger — the API never sets those timestamps by hand.

import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import { isUuid, jsonData, jsonError, jsonValidationError, readJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

// ── Types ────────────────────────────────────────────────────────────────

const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'void'] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface InvoiceDetailRow {
  id: string;
  client_id: string | null;
  client_name: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string;
  line_items: InvoiceLineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

const INVOICE_DETAIL_COLUMNS =
  'id, client_id, client_name, invoice_number, status, currency, issue_date, due_date, line_items, subtotal_cents, tax_cents, total_cents, notes, sent_at, paid_at, created_at, updated_at';

// ── Validation ───────────────────────────────────────────────────────────

const isoDateSchema = z
  .string({ invalid_type_error: 'Dates should be text in YYYY-MM-DD format.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates use the YYYY-MM-DD format, like 2026-04-01.')
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    'That date does not exist on any calendar we know.',
  );

const lineItemSchema = z.object({
  description: z
    .string({
      required_error: 'Each line item needs a description.',
      invalid_type_error: 'Line item descriptions should be text.',
    })
    .trim()
    .min(1, 'Each line item needs a description.')
    .max(500, 'Keep line item descriptions under 500 characters.'),
  quantity: z
    .number({
      required_error: 'Each line item needs a quantity.',
      invalid_type_error: 'Quantity should be a number.',
    })
    .positive('Quantity has to be greater than zero.')
    .max(1000000, 'That quantity looks too large — the max is 1,000,000.'),
  unit_price_cents: z
    .number({
      required_error: 'Each line item needs a unit price.',
      invalid_type_error: 'Unit price should be a whole number of cents.',
    })
    .int('Unit prices are whole cents — send 2500 for $25.00.')
    .min(0, "A unit price can't be negative.")
    .max(100000000000, 'That unit price looks too large to be real.'),
});

const updateInvoiceSchema = z
  .object({
    client_id: z
      .string({ invalid_type_error: 'The client reference should be text.' })
      .uuid("That client reference doesn't look right — pick a client from your list.")
      .nullable()
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
      .min(1, "An invoice number can't be empty.")
      .max(50, 'Invoice numbers max out at 50 characters.')
      .optional(),
    status: z
      .enum(INVOICE_STATUSES, {
        errorMap: () => ({ message: `Status must be one of: ${INVOICE_STATUSES.join(', ')}.` }),
      })
      .optional(),
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
      .optional(),
    tax_cents: z
      .number({ invalid_type_error: 'Tax should be a whole number of cents.' })
      .int('Tax is whole cents — send 850 for $8.50.')
      .min(0, "Tax can't be negative.")
      .optional(),
    notes: z
      .string({ invalid_type_error: 'Notes should be text.' })
      .trim()
      .max(2000, 'Keep notes under 2,000 characters.')
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Send at least one field to update.',
  });

// ── Helpers ──────────────────────────────────────────────────────────────

function calculateSubtotalCents(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce(
    (runningTotal, lineItem) =>
      runningTotal + Math.round(lineItem.quantity * lineItem.unit_price_cents),
    0,
  );
}

function mapInvoiceWriteError(postgresErrorCode: string | undefined): NextResponse {
  if (postgresErrorCode === '23505') {
    return jsonError(
      'You already have an invoice with that number. Use a different one and try again.',
      'CONFLICT',
      409,
    );
  }
  if (postgresErrorCode === '23514') {
    return jsonError(
      "The due date can't be before the issue date. Nudge one of them and try again.",
      'VALIDATION_ERROR',
      400,
    );
  }
  if (postgresErrorCode === 'P0001') {
    return jsonError(
      "We couldn't find that client in your list. Pick another, or add them fresh.",
      'NOT_FOUND',
      404,
    );
  }
  return jsonError(
    "We couldn't save those changes just now. Nothing was lost — give it another try in a moment.",
    'INTERNAL_ERROR',
    500,
  );
}

const INVALID_REFERENCE_MESSAGE =
  "That invoice reference doesn't look right. Head back to your invoices and try again.";
const NOT_FOUND_MESSAGE =
  "We couldn't find that invoice. It may have been deleted, or the link is stale.";

// ── GET /api/invoices/:id ────────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to view an invoice. Log in and it will be right here.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const { data, error } = await supabase
      .from('invoicememory_invoices')
      .select(INVOICE_DETAIL_COLUMNS)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[api/invoices/:id] Failed to load invoice:', error.message);
      return jsonError(
        "We couldn't load that invoice just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    if (!data) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    return jsonData(data as InvoiceDetailRow);
  } catch (unexpectedError) {
    console.error('[api/invoices/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── PATCH /api/invoices/:id ──────────────────────────────────────────────

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to edit an invoice. Log in and pick up where you left off.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const body = await readJsonBody(request);
    if (body === null) {
      return jsonError(
        "We couldn't read that request — the body needs to be valid JSON.",
        'BAD_REQUEST',
        400,
      );
    }

    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }
    const updates = parsed.data;

    const { data: existingData, error: fetchError } = await supabase
      .from('invoicememory_invoices')
      .select('id, status, issue_date, due_date')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[api/invoices/:id] Failed to load invoice before update:', fetchError.message);
      return jsonError(
        'We hit an unexpected snag on our end. Please try again in a moment.',
        'INTERNAL_ERROR',
        500,
      );
    }

    const existingInvoice = existingData as
      | { id: string; status: InvoiceStatus; issue_date: string; due_date: string }
      | null;
    if (!existingInvoice) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    // Cross-field date check against the FINAL values (payload merged over
    // current row) — a friendly 400 beats a raw constraint violation.
    const finalIssueDate = updates.issue_date ?? existingInvoice.issue_date;
    const finalDueDate = updates.due_date ?? existingInvoice.due_date;
    if (finalDueDate < finalIssueDate) {
      return jsonError(
        "The due date can't be before the issue date. Nudge one of them and try again.",
        'VALIDATION_ERROR',
        400,
        { due_date: "The due date can't be before the issue date." },
      );
    }

    const updatePayload: Record<string, unknown> = { ...updates };
    if (updates.line_items) {
      // Money is recomputed server-side whenever line items change.
      updatePayload.subtotal_cents = calculateSubtotalCents(updates.line_items);
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('invoicememory_invoices')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select(INVOICE_DETAIL_COLUMNS)
      .single();

    if (updateError) {
      console.error('[api/invoices/:id] Failed to update invoice:', updateError.message);
      return mapInvoiceWriteError(updateError.code);
    }

    return jsonData(updatedData as InvoiceDetailRow);
  } catch (unexpectedError) {
    console.error('[api/invoices/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Your changes were not lost — please try again.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── DELETE /api/invoices/:id ─────────────────────────────────────────────

export async function DELETE(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to delete an invoice. Log in and try again.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const { data: existingData, error: fetchError } = await supabase
      .from('invoicememory_invoices')
      .select('id, status')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[api/invoices/:id] Failed to load invoice before delete:', fetchError.message);
      return jsonError(
        'We hit an unexpected snag on our end. Please try again in a moment.',
        'INTERNAL_ERROR',
        500,
      );
    }

    const existingInvoice = existingData as { id: string; status: InvoiceStatus } | null;
    if (!existingInvoice) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    if (existingInvoice.status !== 'draft') {
      return jsonError(
        "This invoice has been issued, so it's a financial record now. Void it instead — set its status to 'void' — and your paper trail stays intact.",
        'CONFLICT',
        409,
      );
    }

    const { error: deleteError } = await supabase
      .from('invoicememory_invoices')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[api/invoices/:id] Failed to delete draft:', deleteError.message);
      return jsonError(
        "We couldn't delete that draft just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonData({ id: existingInvoice.id, deleted: true });
  } catch (unexpectedError) {
    console.error('[api/invoices/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
