import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Email confirmation handler → URL: /auth/confirm (route group doesn't affect path).
// Handles BOTH Supabase email link styles:
//   1. token_hash + type  (custom email templates using {{ .TokenHash }})
//   2. code               (default {{ .ConfirmationURL }} PKCE flow fallback)
// Recovery links land the user on /reset-password to set a new password.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

/** Open-redirect protection: only same-site paths are ever allowed in `next`. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  const supabase = createClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const destination = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(new URL(destination, request.url))
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // #1057: recovery links carry the session in the URL FRAGMENT, which this
  // server route can never see but browsers re-attach across the redirect.
  // Forward recovery traffic to the reset page; the root-layout fragment
  // bridge consumes the hash there.
  const zoRecover = new URL(request.url)
  if (zoRecover.searchParams.get('type') === 'recovery' || (zoRecover.searchParams.get('next') || '').includes('reset-password')) {
    return NextResponse.redirect(new URL('/reset-password', request.url))
  }
  return NextResponse.redirect(new URL('/login?error=confirmation_failed', request.url))
}
