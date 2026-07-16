'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// The recovery email link lands here (via /api/auth/callback) with a live
// recovery session in the cookie. If the session is missing, the link expired.

export default function ResetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'checking' | 'ready' | 'expired' | 'saved'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return
      setPhase(user ? 'ready' : 'expired')
    })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Make it at least 8 characters — longer is stronger.')
      return
    }
    if (password !== confirm) {
      setError("Those passwords don't match. One more try?")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      const m = updateError.message.toLowerCase()
      setError(
        m.includes('different from the old')
          ? "That's your current password. Pick something new."
          : "We couldn't save that password just now. Give it another try."
      )
      setLoading(false)
      return
    }

    setPhase('saved')
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1200)
  }

  if (phase === 'checking') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Checking your reset link">
        <div className="skeleton-shimmer h-8 w-2/3" />
        <div className="skeleton-shimmer h-11 w-full" />
        <div className="skeleton-shimmer h-11 w-full" />
        <div className="skeleton-shimmer h-11 w-full" />
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <div className="animate-fade-up text-center">
        <h1 className="text-2xl text-gray-900">This reset link has expired</h1>
        <p className="mt-2 text-sm text-gray-600">
          No worries — links only live for an hour. Grab a fresh one and you&apos;ll be back in.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full">
          Request a fresh link
        </Link>
      </div>
    )
  }

  if (phase === 'saved') {
    return (
      <div className="animate-fade-up text-center" role="status">
        <div className="animate-pop-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
          <svg className="h-7 w-7 text-success-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl text-gray-900">Password updated</h1>
        <p className="mt-2 text-sm text-gray-600">Taking you to your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl text-gray-900 sm:text-3xl">Set a new password</h1>
      <p className="mt-2 text-sm text-gray-600">Make it strong — this guards your invoices and client data.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {error && (
          <div role="alert" className="alert-error">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="field-label">New password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input pr-11"
              placeholder="At least 8 characters"
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

        <div>
          <label htmlFor="confirm" className="field-label">Confirm new password</label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field-input"
            placeholder="Same again"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            'Save new password'
          )}
        </button>
      </form>
    </div>
  )
}
