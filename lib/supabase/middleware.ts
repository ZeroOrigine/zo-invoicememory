import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// API prefixes reachable WITHOUT a session:
//  - /api/webhooks/* : authenticated via Stripe signature, not cookies
//  - /api/auth/*     : the OAuth/email callback MUST work for logged-out users
const PUBLIC_API_PREFIXES = ['/api/webhooks', '/api/auth']

// PATCHED: every signed-in surface, not just /dashboard. Route groups don't
// affect URLs, so the (dashboard) pages live at these top-level paths.
const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/invoices', '/clients', '/settings', '/billing']

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Belt-and-braces: webhooks are excluded by the matcher, but never touch them here either.
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next({ request })
  }

  // ---------------------------------------------------------------------
  // CSRF / CORS posture: our API authenticates via cookies, so every
  // state-changing request must originate from our own origin. This IS the
  // CORS configuration — deny-by-default for cross-origin writes.
  // ---------------------------------------------------------------------
  if (pathname.startsWith('/api') && !SAFE_METHODS.has(request.method)) {
    const allowedHosts = new Set<string>([request.nextUrl.host])
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      try {
        allowedHosts.add(new URL(appUrl).host)
      } catch {
        /* malformed env — ignore */
      }
    }
    const origin = request.headers.get('origin')
    let originOk = false
    if (origin) {
      try {
        originOk = allowedHosts.has(new URL(origin).host)
      } catch {
        originOk = false
      }
    }
    if (!originOk) {
      return NextResponse.json(
        { data: null, error: 'Request blocked for your security. Refresh the page and try again.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail open so the site isn't bricked by a missing env var — every protected
    // page (layout) and API route re-verifies the session itself.
    console.error('[middleware] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: no logic between client creation and getUser() — token refresh
  // happens inside this call and must run first.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  const isProtectedApi = pathname.startsWith('/api') && !isPublicApi
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  const redirectWithCookies = (url: URL) => {
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  if (!user && isProtectedApi) {
    return NextResponse.json({ data: null, error: 'Sign in to continue.', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return redirectWithCookies(url)
  }

  return supabaseResponse
}
