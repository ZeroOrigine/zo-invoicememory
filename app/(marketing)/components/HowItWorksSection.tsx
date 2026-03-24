import { Upload, Settings, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: Upload,
    title: 'Import Your Invoices',
    description: 'Upload existing invoices or connect your accounting software. Our AI extracts all the important details automatically.'
  },
  {
    number: 2,
    icon: Settings,
    title: 'Set Up Smart Reminders',
    description: 'Configure automated reminder schedules for each client. Customize email templates and set escalation rules.'
  },
  {
    number: 3,
    icon: TrendingUp,
    title: 'Get Paid Faster',
    description: 'Watch your cash flow improve as clients receive timely reminders and pay invoices before they become overdue.'
  }
]

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How InvoiceMemory Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Get started in minutes, not hours. Our simple 3-step process gets you tracking invoices immediately.
          </p>
        </div>

        <div className="relative">
          {/* Connection lines */}
          <div className="hidden lg:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 transform -translate-y-1/2"></div>
          
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="text-center relative">
                  {/* Step number */}
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold rounded-full mb-6 relative z-10">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    {step.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}