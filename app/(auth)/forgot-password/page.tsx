'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// RATE LIMITING: Supabase Auth enforces built-in limits on password-reset
// emails per address/IP. For extra safety at scale, add an edge rate limit on
// this page's POST traffic (e.g. 5 requests / 15 min / IP).

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Recovery link → our callback exchanges the code → user lands on /reset-password.
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })

    if (error && (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('too many'))) {
      setFormError('Too many reset requests. Take a short breather and try again in a few minutes.')
      setLoading(false)
      return
    }

    // Anti-enumeration: always show success, whether or not the account exists.
    setSentTo(email)
    setLoading(false)
  }

  if (sentTo) {
    return (
      <div className="animate-fade-up text-center">
        <div className="animate-pop-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
          <svg className="h-7 w-7 text-success-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl text-gray-900">Check your inbox</h1>
        <p className="mt-2 text-sm text-gray-600">
          If <span className="font-semibold text-gray-900">{sentTo}</span> has an account, a reset link is on its way. It&apos;s valid for one hour.
        </p>
        <p className="mt-6 text-sm text-gray-600">
          <Link href="/login" className="font-semibold text-brand-600 transition-colors hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl text-gray-900 sm:text-3xl">Reset your password</h1>
      <p className="mt-2 text-sm text-gray-600">
        Tell us your email and we&apos;ll send you a link to set a new one.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
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
            className="field-input"
            placeholder="you@studio.com"
          />
          {fieldError && <p className="field-error">{fieldError}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            'Email me a reset link'
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand-600 transition-colors hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
