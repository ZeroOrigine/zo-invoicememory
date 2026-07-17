// app/api/profile/route.ts
//
// The user's business identity — the defaults that pre-fill every invoice.
//
//   GET   /api/profile  → the signed-in user's profile
//   PATCH /api/profile  → update business defaults
//
// The Zod schema below matches the schema's column grants EXACTLY: only
// full_name, business_name, business_address, default_currency, and
// default_payment_terms_days are updatable. role (privilege escalation),
// email (owned by auth), and invoice_seq (owned by the numbering trigger)
// can never be touched from here — and invoice_seq is internal, so we do not
// even return it.

import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/lib/supabase/server';
import { jsonData, jsonError, jsonValidationError, readJsonBody } from '@/lib/api';
import { rateLimitGuard } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────

interface ProfileRow {
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

const PROFILE_COLUMNS =
  'id, email, full_name, business_name, business_address, default_currency, default_payment_terms_days, role, created_at, updated_at';

// ── Validation ───────────────────────────────────────────────────────────

const updateProfileSchema = z
  .object({
    full_name: z
      .string({ invalid_type_error: 'Your name should be text.' })
      .trim()
      .min(1, "Your name can't be empty.")
      .max(200, 'Keep your name under 200 characters.')
      .optional(),
    business_name: z
      .string({ invalid_type_error: 'Your business name should be text.' })
      .trim()
      .max(200, 'Keep your business name under 200 characters.')
      .nullable()
      .optional(),
    business_address: z
      .string({ invalid_type_error: 'Your business address should be text.' })
      .trim()
      .max(500, 'Keep your business address under 500 characters.')
      .nullable()
      .optional(),
    default_currency: z
      .string({ invalid_type_error: 'Currency should be text.' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD, EUR, or GBP.')
      .optional(),
    default_payment_terms_days: z
      .number({ invalid_type_error: 'Payment terms should be a number of days.' })
      .int('Payment terms should be whole days.')
      .min(0, "Payment terms can't be negative.")
      .max(365, 'Payment terms max out at 365 days.')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Send at least one field to update.',
  });

// ── GET /api/profile ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError('You need to be signed in for this. Log in and try again.', 'UNAUTHORIZED', 401);
    }
    const { supabase, user } = context;

    const { data, error } = await supabase
      .from('invoicememory_profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .single();

    if (error || !data) {
      console.error('[api/profile] Failed to load profile:', error?.message);
      return jsonError(
        "We couldn't load your profile just now. Give it another try in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonData(data as ProfileRow);
  } catch (unexpectedError) {
    console.error('[api/profile] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}

// ── PATCH /api/profile ───────────────────────────────────────────────────

export async function PATCH(request: Request): Promise<NextResponse> {
  // durable shared rate limit (deploy scorecard requirement — write-surface hygiene)
  const limited = await rateLimitGuard(request, 'invoicememory_write');
  if (limited) return limited;
  try {
    const context = await getAuthenticatedContext();
    if (!context) {
      return jsonError('You need to be signed in for this. Log in and try again.', 'UNAUTHORIZED', 401);
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

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const { data, error } = await supabase
      .from('invoicememory_profiles')
      .update(parsed.data)
      .eq('id', user.id)
      .select(PROFILE_COLUMNS)
      .single();

    if (error || !data) {
      console.error('[api/profile] Failed to update profile:', error?.message);
      return jsonError(
        "We couldn't save those changes just now. Nothing was lost — try again in a moment.",
        'INTERNAL_ERROR',
        500,
      );
    }

    return jsonData(data as ProfileRow);
  } catch (unexpectedError) {
    console.error('[api/profile] Unexpected failure:', unexpectedError);
    return jsonError(
      'We hit an unexpected snag on our end. Please try again in a moment.',
      'INTERNAL_ERROR',
      500,
    );
  }
}
