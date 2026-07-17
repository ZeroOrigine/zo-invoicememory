// lib/supabase/server.ts — FINAL CANONICAL (validation pass 5 re-assert).
// The auth+payments step's copy of this path exports ONLY createClient(),
// which breaks createSupabaseServerClient() (dashboard layout, server pages,
// signout route) and getAuthenticatedContext() (EVERY API route). This file
// is the definitive UNION of all server-side Supabase APIs used anywhere in
// the codebase and must be the last writer of this path. One library
// (@supabase/ssr), one cookie format (getAll/setAll), runtime env checks —
// never module-level throws. DO NOT remove any export from this file.

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Runtime throw, never module-level: a missing env var must fail one
    // request loudly, not crash the whole Netlify build.
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component render — middleware refreshes sessions there.
        }
      },
    },
  })
}

/** Legacy name used by API routes and dashboard layouts. Same client. */
export function createSupabaseServerClient(): SupabaseClient {
  return createClient()
}

export interface AuthenticatedContext {
  supabase: SupabaseClient
  user: User
}

/**
 * Resolves the signed-in user for a route handler, or null (callers 401).
 * Uses getUser() — verified against Supabase Auth — never getSession().
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return { supabase, user }
}
