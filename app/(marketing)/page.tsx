'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/* ============================================================================
   InvoiceMemory — Marketing Landing Page (VALIDATION REWRITE)

   Why this rewrite exists (two ship-blocking defects in the prior version):
   1. Five JSX text nodes contained literal \u201c / \u2019 escape sequences —
      the documented fix was never applied, so visitors would see raw
      backslash codes on the front door.
   2. HONESTY: it advertised features the product does not have (automatic
      follow-up emails, Stripe/QuickBooks/Xero sync, cash-flow forecasts,
      SSO) and fabricated social proof (named testimonials, client logos,
      "1,000+ users", "12 days faster"). This page now sells exactly what the
      shipped product does — client memory, pre-filled invoices, honest
      tracking — with prices/limits matching lib/stripe/config.ts
      (Free 15/mo · Pro $29 · Business $99, no trials).

   Single self-contained file. No local component imports.
   ============================================================================ */

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-200 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800'

const EYEBROW = 'text-sm font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

/* Small stroke-icon paths on a 24×24 grid — zero icon libraries needed */
const ICONS: Record<string, string[]> = {
  spark: ['M12 3.5l1.9 5 5.1 1.9-5.1 1.9-1.9 5-1.9-5L5 10.4l5.1-1.9L12 3.5z', 'M18.6 14.6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z'],
  send: ['M21.5 3.5L10.2 14.8', 'M21.5 3.5L14 21l-3.8-6.2L4 11l17.5-7.5z'],
  chart: ['M3.5 3.5v17h17', 'M7.5 15.5l4-5 3 3 5.5-7'],
  bell: ['M12 4.5a5 5 0 00-5 5v3.2L5.3 16h13.4L17 12.7V9.5a5 5 0 00-5-5z', 'M10 19.5a2 2 0 004 0'],
  inbox: ['M4 5.5h16v13H4z', 'M4 12.5h4.8l1.7 2.5h3l1.7-2.5H20'],
  doc: ['M7 3.5h7.5L19 8v12.5H7z', 'M14.5 3.5V8H19', 'M10.5 13h5M10.5 16.5h3'],
  report: ['M7 3.5h7.5L19 8v12.5H7z', 'M14.5 3.5V8H19', 'M10.5 16.5v-2M13 16.5v-4M15.5 16.5v-6'],
  clock: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7.5V12l3 2'],
  arrow: ['M4 12h15', 'M13 6l6 6-6 6'],
  play: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M10 8.5l5 3.5-5 3.5v-7z'],
  check: ['M4.5 12.5l4.5 4.5L19.5 7'],
  lock: ['M6 11h12v9H6z', 'M9 11V8a3 3 0 016 0v3'],
}

/* Every claim below describes a shipped capability. Nothing aspirational. */
const FEATURES = [
  {
    title: 'Client memory',
    description:
      'Save a client once — their name, currency, and payment terms auto-fill every invoice you ever send them. Type a new name and we remember them automatically.',
    icon: ICONS.spark,
  },
  {
    title: 'Line items that come back',
    description:
      'The things you billed a client last time return as one-click chips on the next invoice. Recurring work becomes a tap, not a retype.',
    icon: ICONS.inbox,
  },
  {
    title: 'Numbering handled for you',
    description:
      'INV-0001, INV-0002… assigned atomically by the database the instant you create an invoice. Two open tabs can never collide, and you never track a sequence again.',
    icon: ICONS.report,
  },
  {
    title: 'Money math you can trust',
    description:
      'Every amount is stored as whole cents and totals are computed by the database itself — no floating-point rounding errors, ever. Multi-currency included.',
    icon: ICONS.chart,
  },
  {
    title: 'Overdue at a glance',
    description:
      'Your dashboard shows outstanding, overdue, and paid-this-month the moment you sign in. Mark invoices sent, paid, or void in one click.',
    icon: ICONS.bell,
  },
  {
    title: 'Yours to keep',
    description:
      'One click exports every client, invoice, and payment record as standard JSON — on every plan, including Free. Leave anytime, take everything.',
    icon: ICONS.lock,
  },
]

const STEPS = [
  {
    title: 'Save a client',
    description:
      'A name is enough — one field. Add their currency and payment terms if you like, and InvoiceMemory keeps them forever.',
  },
  {
    title: 'Open a new invoice — it\u2019s already filled in',
    description:
      'Number, dates, currency, and terms are set before you type a character. Pick a client and the line items you billed them last time appear as one-click chips.',
  },
  {
    title: 'Send it your way, track it here',
    description:
      'Print or save a clean PDF and deliver it however you like. Mark it sent, then paid — your dashboard keeps every overdue invoice impossible to miss.',
  },
]

/* Prices and limits mirror lib/stripe/config.ts exactly. No trial exists,
   so no button ever says "trial". */
const TIERS = [
  {
    name: 'Free',
    tagline: 'The real product, for lighter invoice volume.',
    monthly: 0,
    annual: 0,
    annualBill: '',
    cta: 'Start Free',
    href: '/signup',
    highlight: false,
    note: 'No credit card. Free forever.',
    features: [
      '15 invoices per month',
      'Unlimited remembered clients',
      'Invoices pre-filled from client memory',
      'Automatic invoice numbering (INV-0001…)',
      'One-click JSON export — your data is yours',
      'Email support from a real human',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For working freelancers who invoice weekly.',
    monthly: 29,
    annual: 24,
    annualBill: 'Billed $290/year — 2 months free',
    cta: 'Get Pro',
    href: '/signup?plan=pro',
    highlight: true,
    note: 'No trial — you\u2019re charged when you upgrade. Cancel anytime.',
    features: [
      'Everything in Free, plus:',
      'Unlimited invoices',
      'Full line-item memory & suggestions',
      'Overdue tracking across every client',
      'Multi-currency invoicing',
      'Priority support',
    ],
  },
]

const FAQS = [
  {
    q: 'Is the free plan actually useful, or is it a demo?',
    a: 'It\u2019s the real thing. You get the full client memory, pre-filled invoices, automatic numbering, and one-click export for up to 15 invoices a month — free forever, no card. If you invoice a handful of clients a month, you may honestly never need to pay us.',
  },
  {
    q: 'What exactly does InvoiceMemory remember?',
    a: 'Everything you\u2019d otherwise retype: each client\u2019s name, email, currency, and payment terms, plus the line items you last billed them. Open a new invoice and the number, dates, currency, terms, and suggested line items are already in place.',
  },
  {
    q: 'Does InvoiceMemory email my clients for me?',
    a: 'Not yet — and we won\u2019t pretend otherwise. Version 1 is about creating invoices fast and tracking them honestly: print or save any invoice as a clean PDF, send it however you like, then mark it sent, paid, or void. Your dashboard keeps overdue invoices front and center.',
  },
  {
    q: 'Is my financial data secure?',
    a: 'Your data is encrypted in transit and at rest, and every row is isolated to your account with Postgres row-level security. Payments run entirely through Stripe — your card details never touch our servers. And you can export or delete everything, anytime.',
  },
  {
    q: 'Can I export my data if I ever leave?',
    a: 'Always. One click downloads every client, invoice, and payment record as standard JSON — on every plan, including Free. Your data is yours, full stop.',
  },
  {
    q: 'What support do I get?',
    a: 'Email support on every plan, priority support on Pro and Business. A real human reads and replies — usually within a few hours.',
  },
]

function Icon({ paths, className = 'h-5 w-5' }: { paths: string[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-md shadow-brand-600/30 ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3.5h7.5L19 8v12.5H7z" />
        <path d="M10.5 12h5M10.5 15.5h3" />
      </svg>
    </span>
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [annual, setAnnual] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Scroll-reveal: JS-gated so content is ALWAYS visible without JS */
  useEffect(() => {
    document.documentElement.classList.add('js-reveal')
    const els = Array.from(document.querySelectorAll('[data-animate]'))
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="overflow-x-clip bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* ============================== NAVIGATION ============================== */}
      <header
        className={`sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md transition-shadow duration-300 dark:border-slate-800/70 dark:bg-slate-950/80 ${
          scrolled ? 'shadow-md shadow-slate-900/[0.06] dark:shadow-black/20' : ''
        }`}
      >
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-h-[44px] items-center gap-2.5" aria-label="InvoiceMemory home">
            <LogoMark />
            <span className="font-display text-lg font-extrabold tracking-tight">
              Invoice<span className="text-brand-600 dark:text-brand-400">Memory</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Log in
            </Link>
            <Link href="/signup" className={`${BTN_PRIMARY} h-11 px-5 text-sm`}>
              Get Started Free
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </nav>

        {menuOpen && (
          <div id="mobile-nav" className="border-t border-slate-200 bg-white px-4 pb-6 pt-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <div className="space-y-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Link href="/login" onClick={() => setMenuOpen(false)} className={`${BTN_SECONDARY} h-12 w-full text-base`}>
                Log in
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className={`${BTN_PRIMARY} h-12 w-full text-base`}>
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main">
        {/* ================================ HERO ================================ */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/15" />
            <div className="absolute left-[-15%] top-1/3 h-[380px] w-[380px] rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
            <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
              {/* Copy column */}
              <div>
                <div
                  className="hero-item inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-800/60 dark:bg-brand-950/40 dark:text-brand-300 sm:text-sm"
                  style={{ animationDelay: '0s' }}
                >
                  <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Free plan — 15 invoices a month, no card required
                </div>

                <h1
                  className="hero-item mt-6 font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
                  style={{ animationDelay: '0.1s' }}
                >
                  Invoices that{' '}
                  <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent dark:from-brand-400 dark:to-violet-400">
                    fill themselves in
                  </span>
                  .
                </h1>

                <p
                  className="hero-item mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl"
                  style={{ animationDelay: '0.2s' }}
                >
                  InvoiceMemory remembers your clients — their currency, their payment terms, the exact line items you
                  billed them last time — so every new invoice arrives pre-filled. From blank to sent in under a minute.
                </p>

                <div className="hero-item mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '0.3s' }}>
                  <Link href="/signup" className={`${BTN_PRIMARY} h-14 px-8 text-base`}>
                    Get Started Free
                    <Icon paths={ICONS.arrow} className="h-4 w-4" />
                  </Link>
                  <a href="#demo" className={`${BTN_SECONDARY} h-14 px-8 text-base`}>
                    <Icon paths={ICONS.play} className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    See how it works
                  </a>
                </div>

                <p className="hero-item mt-4 text-sm text-slate-500 dark:text-slate-400" style={{ animationDelay: '0.4s' }}>
                  No credit card required · Free plan forever · Export everything, anytime
                </p>
              </div>

              {/* Demo column — the real product flow, before signup */}
              <div id="demo" className="hero-item relative scroll-mt-24 lg:justify-self-end" style={{ animationDelay: '0.35s' }}>
                <div className="relative mx-auto w-full max-w-[520px]">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-500/25 via-violet-500/20 to-emerald-400/25 blur-2xl"
                  />
                  <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-brand-900/10 dark:border-slate-800 dark:bg-slate-900">
                    {/* Window chrome */}
                    <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      <span className="ml-3 flex-1 truncate rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        invoicememory · new invoice
                      </span>
                    </div>

                    {/* Timeline: pick client → memory applies → created → paid */}
                    <div className="space-y-3 p-4 sm:p-5">
                      <div
                        className="demo-item flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                        style={{ animationDelay: '0.8s' }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                            <Icon paths={ICONS.doc} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">New invoice · you pick Acme Studio</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">One click from your saved clients</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          0:03
                        </span>
                      </div>

                      <div
                        className="demo-item rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-800/50 dark:bg-brand-950/40"
                        style={{ animationDelay: '1.5s' }}
                      >
                        <div className="flex gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-sm">
                            <Icon paths={ICONS.spark} className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">Memory applied</p>
                            <p className="mt-0.5 text-sm leading-snug text-slate-700 dark:text-slate-200">
                              USD · Net 14 · 3 remembered line items snap in. Numbered{' '}
                              <span className="font-semibold text-slate-900 dark:text-white">INV-0042</span> automatically — dates computed
                              from Acme&apos;s terms.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="demo-item flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                        style={{ animationDelay: '2.2s' }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                          <Icon paths={ICONS.send} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Created &amp; marked sent · $4,800 · due Jun 14</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Print or save a clean PDF — deliver it your way</p>
                        </div>
                      </div>

                      <div
                        className="demo-item flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/30"
                        style={{ animationDelay: '2.9s' }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                            <Icon paths={ICONS.check} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Marked paid · $4,800 in the bank</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Tracked from sent to paid on your dashboard</p>
                          </div>
                        </div>
                        <span className="demo-paid shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white" style={{ animationDelay: '3.5s' }}>
                          PAID ✓
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Floating capability chip — a product fact, not a fabricated stat */}
                  <div
                    className="demo-item absolute -bottom-5 left-4 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:flex"
                    style={{ animationDelay: '3.9s' }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <Icon paths={ICONS.clock} className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">Under a minute</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">from blank invoice to sent</span>
                    </span>
                  </div>
                </div>

                <p className="mt-9 text-center text-xs text-slate-500 dark:text-slate-400">
                  This is the actual product flow — the form is pre-filled before you type a character.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== HONEST VALUE STRIP (no fake logos) ===================== */}
        <section aria-label="What you get" className="border-y border-slate-200/70 bg-slate-50/60 dark:border-slate-800/70 dark:bg-slate-900/40">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              ['Under a minute', 'from blank invoice to sent — numbers, dates, and totals handled for you'],
              ['Zero retyping', 'clients, currencies, terms, and line items are remembered forever'],
              ['15 free every month', 'the full memory engine on the Free plan — no card, no catch'],
            ].map(([stat, detail]) => (
              <div key={stat} className="text-center sm:text-left">
                <p className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{stat}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* =============================== FEATURES =============================== */}
        <section id="features" className="scroll-mt-24 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center" data-animate>
              <p className={EYEBROW}>Features</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                A memory for your invoicing.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Everything InvoiceMemory remembers goes toward one job: your next invoice, ready before you type.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  data-animate
                  style={{ transitionDelay: `${i * 60}ms` }}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-600/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800 sm:p-8"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-md shadow-brand-600/25 transition-transform duration-300 group-hover:scale-110">
                    <Icon paths={f.icon} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= HOW IT WORKS ============================= */}
        <section id="how-it-works" className="scroll-mt-24 bg-slate-50 py-20 dark:bg-slate-900/40 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center" data-animate>
              <p className={EYEBROW}>How it works</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Type it once. Never again.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Three steps the first time. One step every time after.
              </p>
            </div>

            <div className="relative mt-14">
              <div
                aria-hidden="true"
                className="absolute left-[12%] right-[12%] top-8 hidden h-0.5 bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400 opacity-30 lg:block"
              />
              <div className="grid gap-12 lg:grid-cols-3 lg:gap-10">
                {STEPS.map((s, i) => (
                  <div key={s.title} data-animate style={{ transitionDelay: `${i * 100}ms` }} className="relative flex flex-col items-center text-center">
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white font-display text-2xl font-extrabold text-brand-600 shadow-lg shadow-brand-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-400">
                      {i + 1}
                    </div>
                    <h3 className="mt-5 font-display text-xl font-bold text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-14 text-center" data-animate>
              <Link
                href="/signup"
                className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Create your first invoice free
                <Icon paths={ICONS.arrow} className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ================================ PRICING ================================ */}
        <section id="pricing" className="scroll-mt-24 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center" data-animate>
              <p className={EYEBROW}>Pricing</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Honest pricing. Genuinely free to start.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                The free plan isn&apos;t a teaser — it&apos;s the full memory engine for lighter invoice volume. There are no
                trials: upgrading charges you immediately, and you can cancel anytime.
              </p>
            </div>

            {/* Billing toggle */}
            <div className="mt-10 flex justify-center" data-animate>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Billing period">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  aria-pressed={!annual}
                  className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-all ${
                    !annual ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  aria-pressed={annual}
                  className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-all ${
                    annual ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Annual
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                    2 months free
                  </span>
                </button>
              </div>
            </div>
            <p className="mt-3 h-5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {annual ? 'Nice — two months free, every year.' : ''}
            </p>

            <div className="mt-10 grid items-stretch gap-8 sm:grid-cols-2 max-w-3xl mx-auto">
              {TIERS.map((t, i) => (
                <div
                  key={t.name}
                  data-animate
                  style={{ transitionDelay: `${i * 80}ms` }}
                  className={`relative flex flex-col rounded-2xl p-8 ${
                    t.highlight
                      ? 'border-2 border-brand-600 bg-white shadow-2xl shadow-brand-600/15 dark:border-brand-500 dark:bg-slate-900'
                      : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  {t.highlight && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                      Most popular
                    </span>
                  )}

                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.tagline}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-display text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      ${annual ? t.annual : t.monthly}
                    </span>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/month</span>
                  </div>
                  <p className="mt-1 min-h-[16px] text-xs text-slate-500 dark:text-slate-400">
                    {t.monthly === 0 ? 'Free forever. Seriously.' : annual ? t.annualBill : 'Billed monthly · cancel anytime'}
                  </p>

                  <Link href={t.href} className={`mt-6 h-12 w-full text-sm ${t.highlight ? BTN_PRIMARY : BTN_SECONDARY}`}>
                    {t.cta}
                  </Link>
                  <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{t.note}</p>

                  <ul className="mt-8 space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                        {f.endsWith(':') ? (
                          <span className="font-semibold text-slate-900 dark:text-white">{f}</span>
                        ) : (
                          <>
                            <Icon paths={ICONS.check} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{f}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400" data-animate>
              <Icon paths={ICONS.lock} className="h-4 w-4" />
              Secure checkout by Stripe — we never see your card · Encrypted in transit &amp; at rest · Export everything on any plan
            </p>
          </div>
        </section>

        {/* ================================== FAQ ================================== */}
        <section id="faq" className="scroll-mt-24 bg-slate-50 py-20 dark:bg-slate-900/40 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center" data-animate>
              <p className={EYEBROW}>FAQ</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Questions, answered honestly.
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Something else on your mind?{' '}
                <a href="mailto:hello@zeroorigine.com" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                  hello@zeroorigine.com
                </a>{' '}
                — a human replies.
              </p>
            </div>

            <div className="mt-12 space-y-3">
              {FAQS.map((f, i) => (
                <details
                  key={f.q}
                  data-animate
                  style={{ transitionDelay: `${i * 50}ms` }}
                  className="group rounded-xl border border-slate-200 bg-white transition-shadow open:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-base font-semibold text-slate-900 dark:text-white [&::-webkit-details-marker]:hidden sm:px-6 sm:py-5">
                    {f.q}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-transform duration-300 group-open:rotate-45 dark:border-slate-700 dark:text-slate-400"
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 sm:px-6 sm:pb-6">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* =============================== FINAL CTA =============================== */}
        <section className="relative isolate overflow-hidden bg-slate-950 py-20 sm:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/4 h-[360px] w-[360px] rounded-full bg-brand-600/20 blur-3xl" />
            <div className="absolute -bottom-24 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-600/20 blur-3xl" />
          </div>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8" data-animate>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Ready to stop retyping invoices?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Save your first client, and your next invoice fills itself in — number, dates, currency, terms, and the line
              items you always bill. You just hit send.
            </p>
            <div className="mt-9">
              <Link
                href="/signup"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-10 text-base font-bold text-slate-900 shadow-2xl shadow-white/10 transition-all duration-200 hover:bg-slate-100 hover:shadow-white/20 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Started Free
                <Icon paths={ICONS.arrow} className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-400">No credit card required · Free plan forever · Cancel anytime</p>
          </div>
        </section>
      </main>

      {/* ================================= FOOTER ================================= */}
      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <span className="font-display text-lg font-extrabold tracking-tight">
                  Invoice<span className="text-brand-600 dark:text-brand-400">Memory</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">The memory layer for your invoices.</p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/privacy" className="inline-flex min-h-[44px] items-center py-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="inline-flex min-h-[44px] items-center py-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Terms of Service
              </Link>
              <a href="mailto:hello@zeroorigine.com" className="inline-flex min-h-[44px] items-center py-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Contact
              </a>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} InvoiceMemory. All rights reserved.</p>
            <p>
              Built with care by{' '}
              <a href="https://zeroorigine.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                ZeroOrigine
              </a>{' '}
              — for people who&apos;d rather do the work than retype it.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
