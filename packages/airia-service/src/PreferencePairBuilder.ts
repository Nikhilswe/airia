// AIrIA — PreferencePairBuilder
// CTO-owned. Queries the feedback store, runs QualityValidator, and produces
// the DPO preference pairs that feed the fine-tuning pipeline.
// Only signals that carry both a chosen AND rejected example form valid DPO pairs.
// thumb_up and copy alone are positive reinforcement but incomplete for DPO training.

import type { PreferencePair, FeedbackSignalType } from '@airia/types'
import { getFeedbackPairs } from '@airia/db'
import { QualityValidator } from './QualityValidator'

export interface BuildResult {
  pairs: PreferencePair[]
  jsonl: string          // newline-delimited JSON, one {"chosen","rejected"} per line
  invalidCount: number   // signals that failed validation
  skippedCount: number   // valid signals that lacked a rejected counterpart
}

export class PreferencePairBuilder {
  private validator = new QualityValidator()

  // Fetch all feedback signals since `since` (epoch ms), validate, and build pairs.
  // Returns only pairs that have both chosen and rejected content — the DPO format requires both.
  async build(since?: number): Promise<BuildResult> {
    const signals = await getFeedbackPairs(since)
    const { valid, invalid } = this.validator.validateBatch(signals)

    const pairs: PreferencePair[] = []
    let skippedCount = 0

    for (const s of valid) {
      if (s.rejectedContent === undefined) {
        // Positive signal without a counterpart — counts toward UX but not DPO
        skippedCount++
        continue
      }
      pairs.push({
        chosen: s.chosenContent,
        rejected: s.rejectedContent,
        confidence: s.confidence,
        signalType: s.signal as FeedbackSignalType,
        conversationId: s.conversationId,
        timestamp: s.timestamp,
      })
    }

    // Higher-confidence pairs first so the training server can optionally truncate
    pairs.sort((a, b) => b.confidence - a.confidence)

    const jsonl = pairs
      .map(p => JSON.stringify({ chosen: p.chosen, rejected: p.rejected }))
      .join('\n')

    return { pairs, jsonl, invalidCount: invalid.length, skippedCount }
  }

  // Count of DPO-ready pairs (both chosen + rejected present, validation passing).
  // Used by LocalTrainer.isReady() and the settings panel threshold indicator.
  async getReadyCount(): Promise<number> {
    const signals = await getFeedbackPairs()
    const { valid } = this.validator.validateBatch(signals)
    return valid.filter(s => s.rejectedContent !== undefined).length
  }
}
