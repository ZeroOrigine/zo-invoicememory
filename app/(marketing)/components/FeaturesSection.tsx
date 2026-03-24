import { Clock, Bell, BarChart3, Zap, Shield, Smartphone } from 'lucide-react'

const features = [
  {
    icon: Clock,
    title: 'Smart Invoice Tracking',
    description: 'Automatically track invoice status, payment dates, and overdue amounts in one centralized dashboard.'
  },
  {
    icon: Bell,
    title: 'Automated Reminders',
    description: 'Send personalized payment reminders via email and SMS before invoices become overdue.'
  },
  {
    icon: BarChart3,
    title: 'Payment Analytics',
    description: 'Get insights into payment patterns, average collection time, and cash flow forecasting.'
  },
  {
    icon: Zap,
    title: 'Quick Invoice Import',
    description: 'Import invoices from popular accounting software or upload PDFs with automatic data extraction.'
  },
  {
    icon: Shield,
    title: 'Client Portal Access',
    description: 'Give clients a secure portal to view outstanding invoices and make payments directly.'
  },
  {
    icon: Smartphone,
    title: 'Mobile Notifications',
    description: 'Get instant notifications when invoices are viewed, paid, or become overdue on any device.'
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything you need to get paid faster
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Stop losing money to forgotten invoices. Our smart tracking system ensures you never miss a payment again.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div 
                key={index}
                className="group p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg transition-all duration-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}