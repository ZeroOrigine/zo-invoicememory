'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// RATE LIMITING: Supabase Auth limits signups + confirmation emails per
// address/IP. At scale, add an edge limit here too (e.g. 5 signups / hr / IP).
// The DB trigger handle_new_user() provisions the profile + free plan — no
// client code needed for that.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function SignupForm() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!fullName.trim()) next.name = "What should we call you? Your name goes on your invoices."
    if (!EMAIL_RE.test(email)) next.email = "That email doesn't look quite right. Mind checking it?"
    if (password.length < 8) next.password = 'Make it at least 8 characters — longer is stronger.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setAccountExists(false)
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        // Never hardcode a domain — works on localhost, previews and production.
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setAccountExists(true)
        setFormError('You already have an account with this email.')
      } else if (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('too many')) {
        setFormError('Too many signups from here right now. Try again in a few minutes.')
      } else {
        setFormError("We couldn't create your account just now. Give it another try.")
      }
      setLoading(false)
      return
    }

    // With email confirmation ON, Supabase obfuscates existing accounts by
    // returning a user with zero identities.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setAccountExists(true)
      setFormError('You already have an account with this email.')
      setLoading(false)
      return
    }

    // Email confirmation disabled in this environment → straight to the dashboard.
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setSentTo(email)
    setLoading(false)
  }

  if (sentTo) {
    return (
      <div className="animate-fade-up text-center" role="status">
        <div className="animate-pop-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
          <svg className="h-7 w-7 text-success-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-5 text-xl text-gray-900">Check your inbox</h2>
        <p className="mt-2 text-sm text-gray-600">
          We sent a confirmation link to <span className="font-semibold text-gray-900">{sentTo}</span>. Click it and you&apos;ll land in your dashboard, ready to send your first invoice.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Wrong address? Go back
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="alert-error">
          {formError}{' '}
          {accountExists && (
            <Link href="/login" className="font-semibold underline underline-offset-2">
              Sign in instead?
            </Link>
          )}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="field-label">Your name</label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="field-input"
          placeholder="Sam Rivera"
        />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>

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
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="field-label">Password</label>
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
        {errors.password && <p className="field-error">{errors.password}</p>}
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Creating your account…
          </span>
        ) : (
          'Create free account'
        )}
      </button>
    </form>
  )
}
