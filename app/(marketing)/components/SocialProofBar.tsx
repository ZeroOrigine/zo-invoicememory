export function SocialProofBar() {
  const companies = [
    'TechCorp', 'DesignStudio', 'ConsultPro', 'CreativeAgency', 'StartupLab'
  ]

  return (
    <section className="py-12 bg-gray-50 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-8">
          Used by teams at
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center justify-items-center">
          {companies.map((company, index) => (
            <div 
              key={company}
              className="flex items-center justify-center h-12 px-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
            >
              <span className="text-gray-600 dark:text-gray-300 font-semibold text-sm">
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}