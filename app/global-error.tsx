'use client'

// app/global-error.tsx — last-resort boundary covering the ROOT layout itself.
// Must render its own <html>/<body>. Inline styles only: if we're here, the
// stylesheet may not have loaded.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('[global-error-boundary]', error)
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f8fafc' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32 }}>
            <h1 style={{ fontSize: 20, margin: 0, color: '#0f172a' }}>InvoiceMemory hit a snag.</h1>
            <p style={{ fontSize: 14, color: '#475569', marginTop: 8 }}>
              Nothing was lost. Give it one more try — if it keeps happening, we&apos;re at hello@zeroorigine.com.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, background: '#1d4ed8', color: '#fff', border: 0, borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
