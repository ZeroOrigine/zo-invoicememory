'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Google OAuth. The redirect flows through /api/auth/callback which
// exchanges the PKCE code for a session. `next` is validated against open
// redirects before use.

type Provider = 'google'

export function OAuthButtons() {
  const searchParams = useSearchParams()
  const rawNext = searchParams.get('next')
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signInWith(provider: Provider) {
    setPending(provider)
    setError(null)

    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (oauthError) {
      setError(
        `We couldn't reach Google just now. Try email below, or give it another go in a moment.`
      )
      setPending(null)
    }
    // On success the browser navigates to the provider — no cleanup needed.
  }

  return (
    <div>
      {error && (
        <div role="alert" className="alert-error mb-4">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => signInWith('google')}
          disabled={pending !== null}
          className="btn-secondary w-full gap-2.5"
        >
          {pending === 'google' ? (
            <svg className="h-5 w-5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 01-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.19 7.19 0 01-10.71-3.78H1.35v3.1A12 12 0 0012 24z" />
              <path fill="#FBBC05" d="M5.35 14.3a7.2 7.2 0 010-4.6V6.6H1.35a12 12 0 000 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 001.35 6.6l4 3.1A7.19 7.19 0 0112 4.75z" />
            </svg>
          )}
          Google
        </button>

      </div>
    </div>
  )
}
