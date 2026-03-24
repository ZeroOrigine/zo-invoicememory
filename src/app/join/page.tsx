export const dynamic = "force-dynamic"
import Link from 'next/link';
import DonateButton from '@/components/DonateButton';
import JoinRevealObserver from '@/components/JoinRevealObserver';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join ZeroOrigine — Fund the Future of Fair Intelligence',
  description: 'Help close the intelligence gap. Fund ZeroOrigine\'s autonomous ecosystem that builds free AI tools for everyone.',
  openGraph: {
    title: 'Join ZeroOrigine — Close the Gap',
    description: 'The gap between those who have access to intelligent tools and those who don\'t is the defining inequality of our time.',
    type: 'website',
    url: 'https://zeroorigine.com/join',
  },
};

export default function JoinPage() {
  return (
    <>
      <JoinRevealObserver />

      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Navigation */}
      <nav className="join-nav">
        <div className="nav-container">
          <div className="nav-logo" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Zero<span className="nav-logo-origin">Origine</span>
          </div>
          <Link href="/" className="nav-back" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            &larr; Back to ZeroOrigine
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main id="main" style={{ paddingTop: '72px' }}>
        {/* Hero Section */}
        <section className="join-hero reveal">
          <div className="hero-content">
            <h1>The gap is not technology. The gap is <span className="gradient-text">access</span>.</h1>
            <p>Intelligence is no longer scarce. But the tools that unlock it are locked behind price tags that most humans can&apos;t reach. We&apos;re building something different — a fully autonomous ecosystem that discovers problems, builds solutions, and deploys them freely to everyone.</p>
          </div>
        </section>

        {/* The Five Gaps */}
        <section className="gaps-section join-container">
          <div className="gap-item reveal">
            <div className="gap-number">01</div>
            <div className="gap-content">
              <h3>The Intelligence Gap</h3>
              <p>A small business owner in Hamilton has the same dreams as a Stanford MBA. But one has AI tools. The other has Excel. The technology exists. The gap is who can afford it.</p>
            </div>
          </div>

          <div className="gap-item reveal">
            <div className="gap-number">02</div>
            <div className="gap-content">
              <h3>The Financial Literacy Gap</h3>
              <p>The tax code rewards those who can afford advisors. Everyone else overpays and underclaims. A freelancer loses thousands yearly because they don&apos;t know what they don&apos;t know. Knowledge should not be a luxury good.</p>
            </div>
          </div>

          <div className="gap-item reveal">
            <div className="gap-number">03</div>
            <div className="gap-content">
              <h3>The Access Gap</h3>
              <p>Grant funding exists. Millions of dollars wait for projects that could change lives. But only organizations with grant writers know how to get it. Opportunity shouldn&apos;t be invisible to those who need it most.</p>
            </div>
          </div>

          <div className="gap-item reveal">
            <div className="gap-number">04</div>
            <div className="gap-content">
              <h3>The Time Gap</h3>
              <p>A freelancer spends 30% of their time on invoicing, tracking, and admin. That&apos;s time stolen from their actual craft. Humans should do human work. Machines should handle the rest.</p>
            </div>
          </div>

          <div className="gap-item reveal">
            <div className="gap-number">05</div>
            <div className="gap-content">
              <h3>The Dignity Gap</h3>
              <p>Most &ldquo;AI tools&rdquo; treat users as data sources. We treat them as humans with rights. Your data isn&apos;t currency. Your privacy isn&apos;t negotiable. Respect isn&apos;t a feature — it&apos;s the foundation.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-section join-container reveal">
          <h2>How It Works</h2>
          <p className="how-intro">This is not charity. This is infrastructure.</p>
          <p>Every dollar you contribute funds the autonomous ecosystem. Eight Minds — research, architecture, ethics, building, quality, marketing, finance, and communication — work together in a pipeline that never stops. They discover real problems, design elegant solutions, and deploy them with no human overhead.</p>
          <p>You&apos;re not donating to a company. You&apos;re funding a system that builds itself. As long as the servers run and the Minds think, new products emerge. Free. Forever. No subscription traps. No data harvesting. No upselling.</p>
          <p>When you become a supporter, you&apos;re not buying anything. You&apos;re becoming part of something that&apos;s already working.</p>
        </section>

        {/* Tiers */}
        <section className="tiers-section join-container" id="tiers">
          <h2>Choose Your Tier</h2>
          <p className="tiers-intro">Every contribution compounds. Start where it feels right.</p>

          <div className="tiers-grid">
            {/* Seed Tier */}
            <div className="tier-card reveal">
              <div className="tier-price"><span className="tier-price-currency">$</span>1<span className="tier-price-currency">/mo</span></div>
              <h3 className="tier-name">Seed</h3>
              <p className="tier-tagline">Plant one idea. Keep the ecosystem thinking.</p>
              <div className="tier-perks">
                <div className="tier-perk">Daily product alerts</div>
                <div className="tier-perk">Community access</div>
                <div className="tier-perk">Early updates</div>
              </div>
              <DonateButton amount={1} label="Seed" />
            </div>

            {/* Root Tier */}
            <div className="tier-card reveal">
              <div className="tier-price"><span className="tier-price-currency">$</span>5<span className="tier-price-currency">/mo</span></div>
              <h3 className="tier-name">Root</h3>
              <p className="tier-tagline">Ground the ecosystem. Fund the build cycle.</p>
              <div className="tier-perks">
                <div className="tier-perk">All Seed benefits</div>
                <div className="tier-perk">Early access to products</div>
                <div className="tier-perk">Member-only pricing</div>
                <div className="tier-perk">Build progress updates</div>
              </div>
              <DonateButton amount={5} label="Root" />
            </div>

            {/* Origin Tier */}
            <div className="tier-card reveal">
              <div className="tier-price"><span className="tier-price-currency">$</span>25<span className="tier-price-currency">/mo</span></div>
              <h3 className="tier-name">Origin</h3>
              <p className="tier-tagline">Become origin. Fund the mission.</p>
              <div className="tier-perks">
                <div className="tier-perk">All Root benefits</div>
                <div className="tier-perk">Founder updates</div>
                <div className="tier-perk">Priority support</div>
                <div className="tier-perk">Name on supporter wall</div>
              </div>
              <DonateButton amount={25} label="Origin" />
            </div>
          </div>
        </section>

        {/* The Promise */}
        <section className="promise-section join-container reveal">
          <h2>The Promise</h2>
          <div className="promise-list">
            <div className="promise-item">We will never sell your data.</div>
            <div className="promise-item">We will never send you spam.</div>
            <div className="promise-item">We will never guilt-trip you for canceling.</div>
            <div className="promise-item">We will never hide how we spend your money.</div>
          </div>
          <p className="promise-closing">If we fail — if the ecosystem produces nothing of value — we&apos;ll tell you. Because honesty is Article III of our constitution.</p>
        </section>

        {/* Final CTA */}
        <section className="final-cta-section join-container reveal">
          <h2>Every gap we close makes the world slightly more <span className="gradient-text">fair</span>.</h2>
          <button className="final-cta-button" id="scroll-to-tiers-btn">Choose Your Tier</button>
        </section>
      </main>

      {/* Footer */}
      <footer className="join-footer">
        <div className="footer-content">
          <div className="footer-left">&copy; 2026 ZeroOrigine <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: '#525259', marginLeft: '0.5rem' }}>v3.6.0</span></div>
          <div className="footer-right">
            <Link href="/">&larr; Back to main site</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
