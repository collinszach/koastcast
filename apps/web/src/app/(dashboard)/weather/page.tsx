'use client'

import dynamic from 'next/dynamic'

const WeatherPageClient = dynamic(() => import('./WeatherPageClient'), { ssr: false })

export default function WeatherPage() {
  return <WeatherPageClient />
}
