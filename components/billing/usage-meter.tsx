'use client'

// Usage meter for free-plan limits. Numbers always come with context —
// "3 of 5 free invoices" — never bare figures.

export function UsageMeter({
  label,
  used,
  limit,
  upgradeHint,
}: {
  label: string
  used: number
  /** null = unlimited on this plan */
  limit: number | null
  upgradeHint?: string
}) {
  if (limit === null) {
    return (
      <div className="rounded-xl bg-white p-5 ring-1 ring-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Unlimited on your plan
          </span>
        </div>
        <p className="mt-1.5 text-sm text-gray-500">{used} so far — no ceiling.</p>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((used / limit) * 100))
  const atLimit = used >= limit
  const nearLimit = !atLimit && pct >= 70
  const barColor = atLimit ? 'bg-danger-500' : nearLimit ? 'bg-warning-500' : 'bg-brand-500'

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm font-semibold text-gray-900">
          {used} <span className="font-normal text-gray-500">of {limit}</span>
        </p>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {atLimit ? (
        <p className="mt-2 text-sm font-medium text-danger-700">
          {upgradeHint ?? `You've used all ${limit} for this month — upgrade for unlimited.`}
        </p>
      ) : nearLimit ? (
        <p className="mt-2 text-sm text-warning-700">
          {limit - used} left this month. {upgradeHint ?? 'Upgrading removes the ceiling.'}
        </p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{limit - used} left this month.</p>
      )}
    </div>
  )
}
