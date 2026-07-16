'use client'

// app/error.tsx — route-segment error boundary (checklist requirement).
// Catches render/data errors below the root layout. Friendly, recoverable,
// never a stack trace in front of a user.

import { useEffect } from 'react'
import Link from 'next/link'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">🧾</p>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Something went sideways.</h1>
        <p className="mt-2 text-sm text-slate-600">
          Not your fault — a page hit an unexpected snag on our end. Your invoices and clients are safe.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Back to dashboard
          </Link>
        </div>
        {error.digest && <p className="mt-4 text-xs text-slate-400">Reference: {error.digest}</p>}
      </div>
    </main>
  )
}
