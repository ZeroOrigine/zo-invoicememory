import { Metadata } from 'next'
import LandingContent from './LandingContent'

export const metadata: Metadata = {
  title: 'InvoiceMemory - Never Lose Track of Your Invoices Again',
  description: 'Smart invoice tracking and payment reminders that help freelancers and small businesses get paid faster.',
}

export default function LandingPage() {
  return <LandingContent />
}
