'use client'

import dynamic from 'next/dynamic'

const TrailsPageClient = dynamic(() => import('./TrailsPageClient'), { ssr: false })

export default function TrailsPage() {
  return <TrailsPageClient />
}
