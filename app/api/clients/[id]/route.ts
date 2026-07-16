// app/api/clients/[id]/route.ts
//
//   GET    → one client
//   PATCH  → update details, archive, or un-archive (send { archived: true|false })
//   DELETE → archive (soft delete)
//
// DELETE deliberately archives instead of destroying: archived clients vanish
// from pickers and autocomplete, but every invoice they appear on keeps its
// history (invoices.client_id is ON DELETE SET NULL, and client_name is a
// snapshot). Financial memory should never have holes in it.

import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import { isUuid, jsonData, jsonError, jsonValidationError, readJsonBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

// ── Types ────────────────────────────────────────────────────────────────

interface ClientRow {
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

const CLIENT_COLUMNS =
  'id, name, email, company, address, currency, payment_terms_days, notes, archived_at, created_at, updated_at';

// ── Validation ───────────────────────────────────────────────────────────
// Nullable fields are meaningful here: currency/payment_terms_days set to null
// means "go back to my profile defaults" (schema comment on clients).

const updateClientSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'The client name should be text.' })
      .trim()
      .min(1, "The client's name can't be empty.")
      .max(200, 'Keep the client name under 200 characters.')
      .optional(),
    email: z
      .string({ invalid_type_error: 'The email should be text.' })
      .trim()
      .toLowerCase()
      .email("That email doesn't look quite right — mind checking it?")
      .max(320, 'That email is longer than any real email address.')
      .nullable()
      .optional(),
    company: z
      .string({ invalid_type_error: 'The company name should be text.' })
      .trim()
      .max(200, 'Keep the company name under 200 characters.')
      .nullable()
      .optional(),
    address: z
      .string({ invalid_type_error: 'The address should be text.' })
      .trim()
      .max(500, 'Keep the address under 500 characters.')
      .nullable()
      .optional(),
    currency: z
      .string({ invalid_type_error: 'Currency should be text.' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or EUR.')
      .nullable()
      .optional(),
    payment_terms_days: z
      .number({ invalid_type_error: 'Payment terms should be a number of days.' })
      .int('Payment terms should be whole days.')
      .min(0, "Payment terms can't be negative.")
      .max(365, 'Payment terms max out at 365 days.')
      .nullable()
      .optional(),
    notes: z
      .string({ invalid_type_error: 'Notes should be text.' })
      .trim()
      .max(2000, 'Keep notes under 2,000 characters.')
      .nullable()
      .optional(),
    archived: z
      .boolean({ invalid_type_error: 'archived should be true or false.' })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Send at least one field to update.',
  });

const INVALID_REFERENCE_MESSAGE =
  "That client reference doesn't look right. Head back to your client list and try again.";
const NOT_FOUND_MESSAGE =
  "We couldn't find that client. They may have been removed, or the link is stale.";

// ── GET /api/clients/:id ─────────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to view a client. Log in and they will be right here.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const { data, error } = await supabase
      .from('invoicememory_clients')
      .select(CLIENT_COLUMNS)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[api/clients/:id] Failed to load client:', error.message);
      return jsonError(
        "We couldn't load that client just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    if (!data) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    return jsonData(data as ClientRow);
  } catch (unexpectedError) {
    console.error('[api/clients/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── PATCH /api/clients/:id ───────────────────────────────────────────────

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to edit a client. Log in and try again.',
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

    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const { archived, ...clientFields } = parsed.data;
    const updatePayload: Record<string, unknown> = { ...clientFields };
    if (archived !== undefined) {
      updatePayload.archived_at = archived ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('invoicememory_clients')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select(CLIENT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        // Un-archiving or re-emailing collided with another active client.
        return jsonError(
          'Another client in your list already uses that email. Give this one a different email, or merge them.',
          'CONFLICT',
          409,
          { email: 'Another active client already uses this email.' },
        );
      }
      console.error('[api/clients/:id] Failed to update client:', error.message);
      return jsonError(
        "We couldn't save those changes just now. Nothing was lost — try again in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    if (!data) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    return jsonData(data as ClientRow);
  } catch (unexpectedError) {
    console.error('[api/clients/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── DELETE /api/clients/:id (soft — archives) ────────────────────────────

export async function DELETE(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    if (!isUuid(params.id)) {
      return jsonError(INVALID_REFERENCE_MESSAGE, 'VALIDATION_ERROR', 400);
    }

    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to archive a client. Log in and try again.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const { data: existingData, error: fetchError } = await supabase
      .from('invoicememory_clients')
      .select('id, archived_at')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[api/clients/:id] Failed to load client before archive:', fetchError.message);
      return jsonError(
        'We hit an unexpected snag on our end. Please try again in a moment.',
        'INTERNAL_ERROR',
        500,
      );
    }

    const existingClient = existingData as { id: string; archived_at: string | null } | null;
    if (!existingClient) {
      return jsonError(NOT_FOUND_MESSAGE, 'NOT_FOUND', 404);
    }

    if (existingClient.archived_at) {
      // Already archived — archiving is idempotent.
      return jsonData({ id: existingClient.id, archived: true });
    }

    const { error: archiveError } = await supabase
      .from('invoicememory_clients')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (archiveError) {
      console.error('[api/clients/:id] Failed to archive client:', archiveError.message);
      return jsonError(
        "We couldn't archive that client just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonData({ id: existingClient.id, archived: true });
  } catch (unexpectedError) {
    console.error('[api/clients/:id] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
