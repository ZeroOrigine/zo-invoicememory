import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { OAuthButtons } from '@/components/auth/oauth-buttons'

export const metadata: Metadata = {
  title: 'Sign in — InvoiceMemory',
  description: 'Sign in to InvoiceMemory. Your clients, rates and invoice defaults are right where you left them.',
}

// Skeleton (not a spinner, not "Loading...") shown while the client forms hydrate.
function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading sign-in form">
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-5 w-2/3" />
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl text-gray-900 sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-gray-600">
        Your clients, rates and defaults are right where you left them.
      </p>

      <div className="mt-8">
        {/* LoginForm + OAuthButtons read URL params (next, error) via useSearchParams —
            Next.js 14 REQUIRES a Suspense boundary around them. */}
        <Suspense fallback={<AuthFormSkeleton />}>
          <OAuthButtons />

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or with email</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-brand-600 transition-colors hover:text-brand-700">
          Create a free account
        </Link>
      </p>
    </div>
  )
}
