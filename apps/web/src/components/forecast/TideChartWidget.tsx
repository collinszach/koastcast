'use client'

import TideChart from './TideChart'

interface TideChartWidgetProps {
  points: Array<{ time: string; height_m: number; is_high?: boolean; is_low?: boolean }>
  currentTime?: string
}

export default function TideChartWidget({ points, currentTime }: TideChartWidgetProps) {
  return <TideChart points={points} currentTime={currentTime} height={100} />
}
