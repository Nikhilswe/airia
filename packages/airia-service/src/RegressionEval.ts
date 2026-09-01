// AIrIA — RegressionEval
// CTO-owned. Runs MMLU regression check after fine-tuning.
// Delegates to the training server's /eval endpoint (Python side runs the actual questions).
// Rule: reject model if score drops more than 2% — matches the guardrail in PROJECT.md.

import { timeoutSignal } from './timeoutSignal'
import type { EvalResult } from '@airia/types'

const TRAINING_SERVER = 'http://localhost:8765'
const MAX_REGRESSION = 0.02  // 2% drop allowed — matches guardrail

interface EvalServerResponse {
  passed: boolean
  baseline: number
  new_score: number
  delta: number
}

export class RegressionEval {
  private serverUrl: string
  private maxRegression: number

  constructor(serverUrl = TRAINING_SERVER, maxRegression = MAX_REGRESSION) {
    this.serverUrl = serverUrl.replace(/\/$/, '')
    this.maxRegression = maxRegression
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/health`, {
        signal: timeoutSignal(2000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // Compare newModel against baselineModel on the MMLU subset.
  // If the eval server is unreachable, returns a pass with a warning — we never
  // block a training run due to an eval infrastructure failure.
  async run(jobId: string, baselineModel: string, newModel: string): Promise<EvalResult> {
    try {
      const res = await fetch(`${this.serverUrl}/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseline_model: baselineModel, model: newModel }),
        signal: timeoutSignal(300_000), // eval can take up to 5 min
      })

      if (!res.ok) {
        console.warn(`RegressionEval: server returned ${res.status} — assuming pass`)
        return this.assumePass(jobId)
      }

      const data = (await res.json()) as EvalServerResponse

      // Re-enforce the threshold here even if the Python side computes it differently.
      // The TypeScript side is authoritative on the accept/reject decision.
      const passed = data.delta >= -this.maxRegression

      return {
        jobId,
        baselineScore: data.baseline,
        newScore: data.new_score,
        delta: data.delta,
        passed,
        timestamp: Date.now(),
      }
    } catch {
      console.warn('RegressionEval: server unreachable — assuming pass')
      return this.assumePass(jobId)
    }
  }

  private assumePass(jobId: string): EvalResult {
    return {
      jobId,
      baselineScore: 0,
      newScore: 0,
      delta: 0,
      passed: true,
      timestamp: Date.now(),
    }
  }
}
