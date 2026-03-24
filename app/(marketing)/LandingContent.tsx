"use client"

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

export default function LandingContent() {
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
