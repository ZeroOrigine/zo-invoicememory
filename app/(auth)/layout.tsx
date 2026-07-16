import Link from 'next/link'

// Centered card layout for all auth pages. Everything inline — no external
// component imports beyond Next built-ins.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5" aria-label="InvoiceMemory home">
            <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#294ce4" />
              <path d="M18 17h28v6H18zM18 28h28v5H18zM18 38h17v5H18z" fill="#fff" />
              <circle cx="44" cy="44" r="8" fill="#8fd6a4" />
              <path d="M40.5 44l2.6 2.6 4.4-4.8" stroke="#1f2f85" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-xl font-bold tracking-tight text-gray-900">InvoiceMemory</span>
          </Link>

          <div className="rounded-2xl bg-white p-6 shadow-xl shadow-brand-900/5 ring-1 ring-gray-100 sm:p-10">
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Bank-grade security &middot; Your data is yours — export it anytime
          </p>
        </div>
      </div>
    </main>
  )
}
