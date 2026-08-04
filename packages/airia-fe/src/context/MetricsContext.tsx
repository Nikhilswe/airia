import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface MetricsContextValue {
  metricsVersion: number
  bumpMetrics: () => void
}

const MetricsContext = createContext<MetricsContextValue>({
  metricsVersion: 0,
  bumpMetrics: () => {},
})

export function MetricsProvider({ children }: { children: ReactNode }) {
  const [metricsVersion, setMetricsVersion] = useState(0)
  const bumpMetrics = useCallback(() => setMetricsVersion(v => v + 1), [])
  return (
    <MetricsContext.Provider value={{ metricsVersion, bumpMetrics }}>
      {children}
    </MetricsContext.Provider>
  )
}

export function useMetrics() {
  return useContext(MetricsContext)
}
