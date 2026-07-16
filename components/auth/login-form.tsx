'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// RATE LIMITING: Supabase Auth applies built-in per-IP limits to sign-in
// attempts. At scale, add an edge limit in front (e.g. 10 attempts / 5 min / IP).
// CSRF: credentials go straight to Supabase over HTTPS with the anon key —
// no ambient cookie is replayed against our own server by this form.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) {
    return "That email and password don't match our records. Double-check them, or reset your password below."
  }
  if (m.includes('email not confirmed')) {
    return 'Almost there — confirm your email first. The link is waiting in your inbox.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many tries. Take a short breather and try again in a minute.'
  }
  return "We couldn't sign you in just now. Give it another try."
}

const URL_ERRORS: Record<string, string> = {
  confirmation_failed:
    'That confirmation link expired or was already used. Sign in below — or reset your password to get a fresh one.',
  auth_code_error: "That sign-in link didn't work. Try signing in again below.",
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Open-redirect protection on `next`.
  const rawNext = searchParams.get('next')
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(
    URL_ERRORS[searchParams.get('error') ?? ''] ?? null
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!EMAIL_RE.test(email)) {
      setFieldError("That email doesn't look quite right. Mind checking it?")
      return
    }
    setFieldError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setFormError(friendlyAuthError(error.message))
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="alert-error">
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => {
            if (email && !EMAIL_RE.test(email)) {
              setFieldError("That email doesn't look quite right. Mind checking it?")
            } else {
              setFieldError(null)
            }
          }}
          className="field-input"
          placeholder="you@studio.com"
        />
        {fieldError && <p className="field-error">{fieldError}</p>}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="field-label mb-0">Password</label>
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input pr-11"
            placeholder="Your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 transition-colors hover:text-gray-600"
          >
            {showPassword ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M9.9 4.9A9.7 9.7 0 0121 12c-.7 1.3-1.7 2.5-2.8 3.4M6.2 6.2A9.8 9.8 0 003 12a9.8 9.8 0 0011.4 4.9" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Signing you in…
          </span>
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  )
}
