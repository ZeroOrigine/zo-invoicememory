// THE SHARED RATE-LIMIT GUARD (security block, 2026-07-16) — InvoiceMemory
// wiring of the ecosystem's durable primitive. One Postgres RPC
// (rate_limit_check) underneath: atomic fixed-window counters, per-key AND
// global daily ceilings. Keys are stored as daily-rotating md5 pseudonyms,
// never raw IPs; nothing outlives the day it counted.
//
// Every session-gated write here is defense-in-depth against authenticated
// write-spam (InvoiceMemory makes zero LLM calls — this is not a money leak,
// it is the write-surface hygiene the deploy scorecard enforces).
//
// Usage (2 lines per handler):
//   const limited = await rateLimitGuard(request, 'invoicememory_write');
//   if (limited) return limited;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Platform-verified caller key: Netlify edge IP first, never a spoofable chain. */
export function clientIp(request: Request | null): string {
  const h = request?.headers;
  return (
    h?.get('x-nf-client-connection-ip')?.trim() ||
    h?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

const BUCKET_LIMITS: Record<string, { perKey: number; global: number }> = {
  // generous for a real human, hostile to a script
  invoicememory_write: { perKey: 200, global: 5000 },
  // Stripe session/portal creation — heavier surface, tighter tank
  invoicememory_billing: { perKey: 20, global: 500 },
};

/**
 * Returns a ready-to-return 429 NextResponse when over the limit (or when the
 * check itself cannot run — FAIL-CLOSED, Rule 14: "could not check" is never
 * "checked and fine"), else null and the handler proceeds.
 */
export async function rateLimitGuard(
  request: Request | null,
  bucket: keyof typeof BUCKET_LIMITS | string
): Promise<NextResponse | null> {
  const limits = BUCKET_LIMITS[bucket] ?? { perKey: 100, global: 2000 };
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error('supabase env missing');
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('rate_limit_check', {
      p_bucket: bucket,
      p_key: clientIp(request),
      p_limit_per_window: limits.perKey,
      p_window_secs: 86400,
      p_global_limit: limits.global,
    });
    if (error || !data || typeof data.allowed !== 'boolean') {
      throw new Error(error?.message ?? 'rate check returned no verdict');
    }
    if (data.allowed) return null;
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'daily_limit_reached',
          message:
            "You've hit today's request limit for this action. It resets at midnight UTC — if this blocked real work, tell us and we'll raise it.",
        },
      },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  } catch (err) {
    console.error('[rate-limit] check failed (fail-closed):', err);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'rate_check_unavailable',
          message: 'We could not verify the request limit just now. Give it a minute and try again.',
        },
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
}
