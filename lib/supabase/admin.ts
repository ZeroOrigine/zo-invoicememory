import 'server-only'

// ---------------------------------------------------------------------------
// Service-role Supabase client (server ONLY — `server-only` makes any client
// bundle import a hard build error).
//
// WHY THIS FILE EXISTS alongside client.ts/server.ts/middleware.ts:
// The schema revokes INSERT/UPDATE/DELETE on `invoicememory_subscriptions` and `invoicememory_payments`
// from anon + authenticated. Billing state is written ONLY by Stripe webhook
// handlers via service_role (see schema §2.4/§2.5). This client does ZERO
// auth/cookie handling — it is a pure data-plane client, so it cannot cause
// the cookie-format conflicts the \"three supabase files\" rule protects against.
//
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser. NEVER prefix it with
// NEXT_PUBLIC_. Lazy init: no module-level throws (build-time env may be absent).
// ---------------------------------------------------------------------------
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set them in Netlify env vars.'
      )
    }
    _admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _admin
}
