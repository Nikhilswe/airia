import { useEffect, useState } from 'react'
import { getMetricsSummary } from '@airia/db'
import type { MetricsSummary } from '@airia/types'
import { useMetrics } from '../context/MetricsContext'

const PERIODS = [7, 30, 90]

function pct(rate: number) { return `${Math.round(rate * 100)}%` }
function ms(n: number) { return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s` }

interface StatRowProps { label: string; value: string; accent?: boolean; warn?: boolean }
function StatRow({ label, value, accent, warn }: StatRowProps) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className={`metric-value${accent ? ' metric-value--good' : warn ? ' metric-value--warn' : ''}`}>
        {value}
      </span>
    </div>
  )
}

interface BarProps { value: number; warn?: boolean }
function Bar({ value, warn }: BarProps) {
  return (
    <div className="metric-bar-track">
      <div
        className={`metric-bar-fill${warn && value > 0.2 ? ' metric-bar-fill--warn' : ''}`}
        style={{ width: `${Math.min(value * 100, 100)}%` }}
      />
    </div>
  )
}

export function MetricsDashboard() {
  const [period, setPeriod] = useState(7)
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const { metricsVersion } = useMetrics()

  useEffect(() => {
    getMetricsSummary(period).then(setSummary).catch(console.error)
  }, [period, metricsVersion])

  return (
    <div className="metrics-dashboard">
      <div className="metrics-period-row">
        {PERIODS.map(p => (
          <button
            key={p}
            className={`metrics-period-btn${period === p ? ' metrics-period-btn--active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p}d
          </button>
        ))}
      </div>

      {!summary || summary.totalMessages === 0 ? (
        <p className="metrics-empty">No data yet — start chatting to see metrics.</p>
      ) : (
        <>
          <div className="metrics-section-label">PERFORMANCE</div>
          <StatRow label="Messages" value={String(summary.totalMessages)} />
          <StatRow label="Avg latency" value={ms(summary.avgLatencyMs)} accent={summary.avgLatencyMs < 2000} warn={summary.avgLatencyMs > 5000} />
          <StatRow label="Tokens / sec" value={`${summary.avgTokensPerSecond} t/s`} accent={summary.avgTokensPerSecond > 10} />

          <div className="metrics-section-label" style={{ marginTop: 14 }}>QUALITY</div>
          <StatRow label="👍 Approval" value={pct(summary.thumbUpRate)} accent={summary.thumbUpRate > 0.6} />
          <Bar value={summary.thumbUpRate} />
          <StatRow label="👎 Rejection" value={pct(summary.thumbDownRate)} warn={summary.thumbDownRate > 0.3} />
          <Bar value={summary.thumbDownRate} warn />
          <StatRow label="↺ Retry rate" value={pct(summary.retryRate)} warn={summary.retryRate > 0.2} />
          <Bar value={summary.retryRate} warn />

          <div className="metrics-section-label" style={{ marginTop: 14 }}>HALLUCINATION SIGNALS</div>
          <StatRow label="⚠ Uncertainty" value={pct(summary.uncertaintyRate)} warn={summary.uncertaintyRate > 0.3} />
          <Bar value={summary.uncertaintyRate} warn />
          <StatRow label="✗ Contradiction" value={pct(summary.contradictionRate)} warn={summary.contradictionRate > 0.1} />
          <Bar value={summary.contradictionRate} warn />
          <p className="metrics-footnote">
            Uncertainty = hedging phrases detected · Contradiction = conflicts with your memory
          </p>
        </>
      )}
    </div>
  )
}
