import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ZoAuthFragmentBridge from '@/components/ZoAuthFragmentBridge'

/*
  InvoiceMemory — Root Layout (HONESTY PATCH, validation pass 4).
  The previous metadata advertised automatic follow-up emails and a fabricated
  "12 days faster" statistic — capabilities and claims the shipped product
  does not have, and which the honesty-rewritten landing page deliberately
  removed. Search and social snippets are the FIRST thing many visitors read;
  they must describe exactly what ships: client memory, pre-filled invoices,
  honest tracking. Keywords no longer include "invoice follow up" or
  "cash flow forecast" (features we do not have).
*/

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
}

const TITLE = 'InvoiceMemory — Invoices That Fill Themselves In'
const DESCRIPTION =
  'InvoiceMemory remembers your clients — their currency, payment terms, and the line items you billed last time — so every new invoice arrives pre-filled. From blank to sent in under a minute. Free plan: 15 invoices a month, no card required.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: TITLE,
    template: '%s — InvoiceMemory',
  },
  description: DESCRIPTION,
  keywords: [
    'invoicing',
    'invoice generator',
    'freelance invoicing',
    'invoice tracking',
    'automatic invoice numbering',
    'client memory',
    'small business invoicing',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'InvoiceMemory',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="font-sans antialiased">
        <ZoAuthFragmentBridge />{children}</body>
    </html>
  )
}
