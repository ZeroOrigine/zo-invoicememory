// app/api/auth/signout/route.ts
//
// Signs the user out. POST only — sign-out changes state, so it is never a GET.
// Serves both callers gracefully:
//   * <form method="post"> → 303 redirect home
//   * fetch() with Accept: application/json → { data: { signed_out: true } }

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonData } from '@/lib/api';

export const dynamic = 'force-dynamic';

// rate-limit-exempt: session-required, idempotent, free — signout can only clear the caller's own session
export async function POST(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);

  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (unexpectedError) {
    // Log it, but never strand someone who is trying to leave.
    console.error('[api/auth/signout] Sign-out failed:', unexpectedError);
  }

  const acceptHeader = request.headers.get('accept') ?? '';
  if (acceptHeader.includes('application/json')) {
    return jsonData({ signed_out: true });
  }

  // 303 See Other — the correct redirect status after a POST.
  return NextResponse.redirect(new URL('/', requestUrl.origin), { status: 303 });
}
