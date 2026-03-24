import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'InvoiceMemory - Never Lose Track of Your Invoices Again',
  description: 'Smart invoice tracking and payment reminders for freelancers and small businesses.',
}

export default function LandingPage() {
  const features = [
    { title: "📸 Smart Upload", desc: "Upload invoices as PDF, photo, or email forward. Our AI extracts the key details automatically." },
    { title: "⏰ Payment Reminders", desc: "Never chase payments manually. Automatic reminders before and after due dates." },
    { title: "📊 Dashboard", desc: "See all your invoices in one place. Filter by status, client, or date." },
    { title: "🔍 Search & Filter", desc: "Find any invoice instantly. Search by client name, amount, date, or status." },
    { title: "💰 Revenue Tracking", desc: "Track your income over time. Monthly reports and tax-ready exports." },
    { title: "🔒 Secure Storage", desc: "Bank-level encryption. Your invoice data is yours." },
  ]
  const plans = [
    { name: "Free", price: "$0", features: ["10 invoices/month", "Basic reminders", "PDF upload", "Dashboard"], highlight: false },
    { name: "Pro", price: "$19", features: ["Unlimited invoices", "Smart reminders", "AI extraction", "Revenue reports", "Priority support"], highlight: true },
    { name: "Business", price: "$49", features: ["Everything in Pro", "Team members", "API access", "Custom branding", "Dedicated support"], highlight: false },
  ]
  const faqs = [
    { q: "Is InvoiceMemory really free?", a: "Yes! Free plan includes 10 invoices per month. No credit card required." },
    { q: "How does AI extraction work?", a: "Upload a PDF or photo. Our AI reads and extracts client name, amount, due date automatically." },
    { q: "Can I export my data?", a: "Yes. Export as CSV anytime. Your data belongs to you." },
    { q: "Is my data secure?", a: "AES-256 encryption. We never share your data with third parties." },
  ]
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-blue-600">InvoiceMemory</a>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-gray-600 hover:text-gray-900 hidden md:block">Features</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 hidden md:block">Pricing</a>
            <a href="/login" className="text-gray-600 hover:text-gray-900">Log In</a>
            <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Start Free</a>
          </div>
        </div>
      </nav>
      <section className="py-20 px-4 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-6">Built by ZeroOrigine AI</span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Never Lose Track of Your Invoices Again</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">Smart invoice tracking and payment reminders that help freelancers and small businesses get paid faster.</p>
          <div className="flex items-center justify-center gap-4">
            <a href="/signup" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700">Start Free →</a>
            <a href="#features" className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg hover:bg-gray-50">See Features</a>
          </div>
          <p className="mt-4 text-sm text-gray-500">Free plan available. No credit card required.</p>
        </div>
      </section>
      <section className="py-8 bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-8 text-gray-400 text-sm flex-wrap">
          <span>Trusted by <strong className="text-gray-600">500+</strong> freelancers</span>
          <span className="hidden md:inline">•</span>
          <span><strong className="text-gray-600">$2M+</strong> invoices tracked</span>
          <span className="hidden md:inline">•</span>
          <span><strong className="text-gray-600">4.8★</strong> average rating</span>
        </div>
      </section>
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Everything you need to manage invoices</h2>
          <p className="text-center text-gray-600 mb-12">Stop losing invoices in email threads. Upload once, track forever.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-xl border hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[{s:"1",t:"Upload",d:"Drop your invoice PDF, snap a photo, or forward the email."},{s:"2",t:"Track",d:"We extract details, set reminders, and organize everything."},{s:"3",t:"Get Paid",d:"Automatic reminders go out. You focus on your work."}].map((x,i)=>(
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">{x.s}</div>
                <h3 className="text-lg font-semibold mb-2">{x.t}</h3>
                <p className="text-gray-600">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-600 mb-12">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((p,i)=>(
              <div key={i} className={`p-8 rounded-xl border-2 ${p.highlight?'border-blue-600 shadow-lg md:scale-105':'border-gray-200'}`}>
                <h3 className="text-lg font-semibold mb-2">{p.name}</h3>
                <div className="mb-6"><span className="text-4xl font-bold">{p.price}</span><span className="text-gray-500">/mo</span></div>
                <ul className="text-left space-y-2 mb-8">
                  {p.features.map((f,j)=><li key={j} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>)}
                </ul>
                <a href="/signup" className={`block w-full py-3 rounded-lg text-center font-medium ${p.highlight?'bg-blue-600 text-white hover:bg-blue-700':'border border-gray-300 hover:bg-gray-50'}`}>{p.highlight?'Start Pro Trial':'Get Started'}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="faq" className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently asked questions</h2>
          {faqs.map((f,i)=>(
            <div key={i} className="mb-6 p-6 bg-white rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{f.q}</h3>
              <p className="text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="py-20 px-4 bg-blue-600 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to stop losing invoices?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join 500+ freelancers who get paid faster with InvoiceMemory.</p>
          <a href="/signup" className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-50 inline-block">Start Free — No Credit Card</a>
        </div>
      </section>
      <footer className="py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-4">
          <p>© 2026 InvoiceMemory by ZeroOrigine</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-700">Privacy</a>
            <a href="#" className="hover:text-gray-700">Terms</a>
            <a href="mailto:support@zeroorigine.com" className="hover:text-gray-700">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
