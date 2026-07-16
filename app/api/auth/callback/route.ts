// app/api/auth/callback/route.ts — CANONICAL (replaces both prior versions).
// OAuth + email-link code exchange. Public in middleware by design: a
// logged-out user completing sign-in MUST reach it. All redirects use the
// request origin — never a hardcoded domain.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Open-redirect protection: only same-site paths are ever allowed in `next`. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(new URL(next, request.url))
      }
      console.error('[api/auth/callback] Code exchange failed:', error.message)
    } catch (unexpectedError) {
      console.error('[api/auth/callback] Unexpected failure:', unexpectedError)
    }
  }

  // `auth_code_error` maps to friendly copy in the login form's URL_ERRORS.
  return NextResponse.redirect(new URL('/login?error=auth_code_error', request.url))
}
