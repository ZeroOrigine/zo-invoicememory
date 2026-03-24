export const dynamic = "force-dynamic"
import { Metadata } from 'next'
import { Navigation } from './components/Navigation'
import { HeroSection } from './components/HeroSection'
import { SocialProofBar } from './components/SocialProofBar'
import { FeaturesSection } from './components/FeaturesSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import { PricingSection } from './components/PricingSection'
import { TestimonialsSection } from './components/TestimonialsSection'
import { FAQSection } from './components/FAQSection'
import { FinalCTASection } from './components/FinalCTASection'
import { Footer } from './components/Footer'

export const metadata: Metadata = {
  title: 'InvoiceMemory - Never Lose Track of Your Invoices Again',
  description: 'Smart invoice tracking and payment reminders that help freelancers and small businesses get paid faster. Free plan available.',
  keywords: 'invoice tracking, payment reminders, freelancer tools, small business invoicing',
  openGraph: {
    title: 'InvoiceMemory - Never Lose Track of Your Invoices Again',
    description: 'Smart invoice tracking and payment reminders that help freelancers and small businesses get paid faster.',
    type: 'website',
    url: 'https://invoicememory.com',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'InvoiceMemory - Smart Invoice Tracking'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InvoiceMemory - Never Lose Track of Your Invoices Again',
    description: 'Smart invoice tracking and payment reminders that help freelancers and small businesses get paid faster.',
    images: ['/og-image.png']
  }
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navigation />
      <main>
        <HeroSection />
        <SocialProofBar />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  )
}