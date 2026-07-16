'use client'

// lib/supabase/client.ts — FINAL CANONICAL (validation pass 5 re-assert).
// The auth+payments step's copy exported only createClient(), but
// app/(dashboard)/billing/page.tsx imports getSupabaseBrowserClient(). This
// definitive version exports BOTH browser entry points used across the
// codebase:
//   createClient()             — auth components
//   getSupabaseBrowserClient() — dashboard client pages (billing)
// @supabase/ssr ONLY. createBrowserClient caches internally, so both entry
// points share one underlying client and one cookie format. DO NOT remove
// either export.

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

let browserClient: SupabaseClient | null = null

/** Lazy singleton alias — legacy name used by dashboard client pages. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient()
  }
  return browserClient
}
