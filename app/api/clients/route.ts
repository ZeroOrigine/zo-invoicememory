// app/api/clients/route.ts
//
// Clients are InvoiceMemory's memory — every saved client makes the next
// invoice faster.
//
//   GET  /api/clients?page=&limit=&search=&include_archived=  → paginated list
//   POST /api/clients                                          → save a client

import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import {
  buildPaginationMeta,
  jsonData,
  jsonError,
  jsonList,
  jsonValidationError,
  parsePagination,
  readJsonBody,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

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

const createClientSchema = z.object({
  name: z
    .string({
      required_error: 'Give this client a name — that is all we need to remember them.',
      invalid_type_error: 'The client name should be text.',
    })
    .trim()
    .min(1, "The client's name can't be empty.")
    .max(200, 'Keep the client name under 200 characters.'),
  email: z
    .string({ invalid_type_error: 'The email should be text.' })
    .trim()
    .toLowerCase()
    .email("That email doesn't look quite right — mind checking it?")
    .max(320, 'That email is longer than any real email address.')
    .optional(),
  company: z
    .string({ invalid_type_error: 'The company name should be text.' })
    .trim()
    .max(200, 'Keep the company name under 200 characters.')
    .optional(),
  address: z
    .string({ invalid_type_error: 'The address should be text.' })
    .trim()
    .max(500, 'Keep the address under 500 characters.')
    .optional(),
  currency: z
    .string({ invalid_type_error: 'Currency should be text.' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or EUR.')
    .optional(),
  payment_terms_days: z
    .number({ invalid_type_error: 'Payment terms should be a number of days.' })
    .int('Payment terms should be whole days.')
    .min(0, "Payment terms can't be negative.")
    .max(365, 'Payment terms max out at 365 days.')
    .optional(),
  notes: z
    .string({ invalid_type_error: 'Notes should be text.' })
    .trim()
    .max(2000, 'Keep notes under 2,000 characters.')
    .optional(),
});

// ── GET /api/clients ─────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to see your clients. Log in and they will be right here.',
        'UNAUTHORIZED',
        401,
      );
    }
    const { supabase, user } = context;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = parsePagination(searchParams);

    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.length > 200) {
      return jsonError('Keep the search under 200 characters.', 'VALIDATION_ERROR', 400);
    }

    const includeArchived = searchParams.get('include_archived') === 'true';

    let query = supabase
      .from('invoicememory_clients')
      .select(CLIENT_COLUMNS, { count: 'exact' })
      .eq('user_id', user.id);

    if (!includeArchived) {
      // Active clients only — the hot autocomplete path, riding
      // idx_clients_active_name (user_id, name) WHERE archived_at IS NULL.
      query = query.is('archived_at', null);
    }

    if (searchTerm) {
      // Prefix match; escape LIKE wildcards so user input is data, not pattern.
      const escapedSearchTerm = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.ilike('name', `${escapedSearchTerm}%`);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('[api/clients] Failed to list clients:', error.message);
      return jsonError(
        "We couldn't load your clients just now. Refresh in a moment and they'll be back.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonList((data ?? []) as ClientRow[], buildPaginationMeta(page, limit, count ?? 0));
  } catch (unexpectedError) {
    console.error('[api/clients] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── POST /api/clients ────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError(
        'You need to be signed in to save a client. Log in and try again.',
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

    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const { data, error } = await supabase
      .from('invoicememory_clients')
      .insert({ ...parsed.data, user_id: user.id })
      .select(CLIENT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        // uq_clients_user_email — one active client per email per user.
        return jsonError(
          "You already have a client with that email — they're in your list, no need to add them twice.",
          'CONFLICT',
          409,
          { email: 'A client with this email already exists in your list.' },
        );
      }
      console.error('[api/clients] Failed to create client:', error.message);
      return jsonError(
        "We couldn't save that client just now. Nothing was lost — try again in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonData(data as ClientRow, 201);
  } catch (unexpectedError) {
    console.error('[api/clients] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
