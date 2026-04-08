'use client'

import WindRose from './WindRose'

interface WindRoseWidgetProps {
  readings: Array<{ direction: number; speed_ms: number; time?: string }>
  offshoreDirection?: number
}

export default function WindRoseWidget({ readings, offshoreDirection }: WindRoseWidgetProps) {
  return <WindRose readings={readings} offshoreDirection={offshoreDirection} size={160} />
}
