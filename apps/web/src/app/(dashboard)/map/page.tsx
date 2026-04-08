import MapPageClient from './MapPageClient'
import { getSpots } from '@/lib/api'

export const revalidate = 300

export default async function MapPage() {
  try {
    const { spots, offline } = await getSpots()
    return <MapPageClient spots={spots} offline={offline} />
  } catch {
    return <MapPageClient spots={[]} offline={true} />
  }
}
