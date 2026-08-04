// AIrIA — QualityValidator
// CTO-owned. Validates DPO preference pairs before they enter the training pipeline.
// A bad pair (identical content, too short, missing counterpart) poisons fine-tuning.

import type { FeedbackSignal, FeedbackSignalType } from '@airia/types'

export interface ValidationResult {
  valid: boolean
  confidence: number  // 0–1; how reliable this pair is for DPO training
  reason?: string
}

const MIN_LENGTH = 10

// Confidence reflects how clearly the signal differentiates chosen vs rejected.
// retry is highest because it's an explicit A/B comparison with both sides captured.
const SIGNAL_CONFIDENCE: Record<FeedbackSignalType, number> = {
  retry: 0.9,
  thumb_up: 0.7,
  edit: 0.6,
  thumb_down: 0.4,
  copy: 0.3,
}

export class QualityValidator {
  validate(signal: FeedbackSignal): ValidationResult {
    const { chosenContent, rejectedContent, signal: type } = signal

    if (!chosenContent || chosenContent.length < MIN_LENGTH) {
      return { valid: false, confidence: 0, reason: 'chosen content too short' }
    }

    if (rejectedContent !== undefined) {
      if (rejectedContent.length < MIN_LENGTH) {
        return { valid: false, confidence: 0, reason: 'rejected content too short' }
      }
      if (chosenContent === rejectedContent) {
        return { valid: false, confidence: 0, reason: 'chosen and rejected content are identical' }
      }
    }

    // thumb_down without a rejected counterpart is not a complete DPO pair —
    // we know the response was bad but have no preferred alternative to train toward.
    if (type === 'thumb_down' && !rejectedContent) {
      return {
        valid: false,
        confidence: 0,
        reason: 'thumb_down requires a rejected counterpart for DPO pairing',
      }
    }

    return { valid: true, confidence: SIGNAL_CONFIDENCE[type] ?? 0.5 }
  }

  validateBatch(signals: FeedbackSignal[]): {
    valid: Array<FeedbackSignal & { confidence: number }>
    invalid: Array<FeedbackSignal & { reason: string }>
  } {
    const valid: Array<FeedbackSignal & { confidence: number }> = []
    const invalid: Array<FeedbackSignal & { reason: string }> = []

    for (const signal of signals) {
      const result = this.validate(signal)
      if (result.valid) {
        valid.push({ ...signal, confidence: result.confidence })
      } else {
        invalid.push({ ...signal, reason: result.reason! })
      }
    }

    return { valid, invalid }
  }
}
