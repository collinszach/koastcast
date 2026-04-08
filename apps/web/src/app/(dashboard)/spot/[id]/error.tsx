'use client'

import Link from 'next/link'

export default function SpotError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">🌊</div>
      <h2 className="text-xl font-bold text-white mb-2">Forecast unavailable</h2>
      <p className="text-gray-400 text-sm mb-6">
        {error.message || 'Could not load forecast data. The NUC might be offline.'}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
        <Link
          href="/map"
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Back to map
        </Link>
      </div>
    </div>
  )
}
