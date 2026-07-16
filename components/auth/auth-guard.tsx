'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Client-side auth guard — defense in depth on top of middleware. Wrap any
// client-rendered subtree that must never show to a logged-out user:
//
//   <AuthGuard>{children}</AuthGuard>
//
// Middleware is the PRIMARY gate (it redirects before render); this guard
// covers client-side navigation edge cases and reacts to live sign-outs in
// other tabs via onAuthStateChange.
// ---------------------------------------------------------------------------

export function AuthGuard({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<'checking' | 'authed'>('checking')

  useEffect(() => {
    const supabase = createClient()
    let active = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return
      if (user) {
        setStatus('authed')
      } else {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router, pathname])

  if (status === 'checking') {
    return (
      <>
        {fallback ?? (
          <div className="space-y-4 p-6" aria-busy="true" aria-label="Checking your session">
            <div className="skeleton-shimmer h-8 w-1/3" />
            <div className="skeleton-shimmer h-24 w-full" />
            <div className="skeleton-shimmer h-24 w-full" />
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}
