export default function MapLoading() {
  return (
    <div className="flex h-[calc(100vh-56px)]">
      <div className="flex-1 bg-gray-900 animate-pulse" />
      <div className="w-72 bg-gray-950 border-l border-gray-800 p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-gray-800 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
