export default function SpotPageLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 bg-gray-800 rounded" />

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-800 rounded" />
            <div className="h-4 w-32 bg-gray-800 rounded" />
          </div>
          <div className="h-8 w-24 bg-gray-800 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 bg-gray-800 rounded" />
              <div className="h-6 w-12 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Viz row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-48" />
        ))}
      </div>

      {/* Forecast timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="h-5 w-32 bg-gray-800 rounded mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-shrink-0 w-24 h-32 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
