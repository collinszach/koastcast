'use client'

import SwellSpectrum from './SwellSpectrum'

interface SwellSpectrumWidgetProps {
  snapshots: Array<{ label: string; spectrum: Record<string, number> }>
}

export default function SwellSpectrumWidget({ snapshots }: SwellSpectrumWidgetProps) {
  return <SwellSpectrum snapshots={snapshots} />
}
