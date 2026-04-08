'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-5xl mb-4">🌊</div>
          <h1 className="text-2xl font-bold text-white mb-2">Wipeout</h1>
          <p className="text-gray-400 text-sm mb-6">
            Something went sideways. Don&apos;t worry, we&apos;re paddling back out.
          </p>
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
