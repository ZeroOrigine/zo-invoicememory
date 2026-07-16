import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'
import { OAuthButtons } from '@/components/auth/oauth-buttons'

// PATCHED COPY: free-plan numbers now match lib/stripe/config.ts and the
// landing page — 15 invoices a month, unlimited remembered clients.

export const metadata: Metadata = {
  title: 'Create your account — InvoiceMemory',
  description: 'Start free: 15 invoices a month, unlimited remembered clients, no card needed.',
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading signup form">
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
      <div className="skeleton-shimmer h-11 w-full" />
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl text-gray-900 sm:text-3xl">Send your next invoice in under a minute</h1>
      <p className="mt-2 text-sm text-gray-600">
        Start free — 15 invoices a month, no card needed. InvoiceMemory remembers your clients so you never retype them.
      </p>

      <div className="mt-8">
        {/* OAuthButtons reads URL params via useSearchParams — Suspense is required. */}
        <Suspense fallback={<AuthFormSkeleton />}>
          <OAuthButtons />

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or with email</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <SignupForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        Your data stays yours — export everything, anytime, in one click.
      </p>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 transition-colors hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
