import { describe, it, expect } from 'vitest'
import { QualityValidator } from '../../src/QualityValidator'
import type { FeedbackSignal } from '@airia/types'

function makeSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    id: 'fb_1',
    conversationId: 'conv_1',
    messageId: 'msg_1',
    signal: 'thumb_up',
    timestamp: Date.now(),
    chosenContent: 'This is a good response with enough content.',
    ...overrides,
  }
}

const v = new QualityValidator()

describe('QualityValidator.validate', () => {
  it('accepts a valid thumb_up signal', () => {
    const result = v.validate(makeSignal())
    expect(result.valid).toBe(true)
    expect(result.confidence).toBe(0.7)
  })

  it('accepts a retry signal with both chosen and rejected', () => {
    const result = v.validate(
      makeSignal({
        signal: 'retry',
        chosenContent: 'Better response after retry.',
        rejectedContent: 'Original response that was not good enough.',
      })
    )
    expect(result.valid).toBe(true)
    expect(result.confidence).toBe(0.9)
  })

  it('rejects when chosen content is too short', () => {
    const result = v.validate(makeSignal({ chosenContent: 'short' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/chosen content too short/)
  })

  it('rejects when chosen content is empty', () => {
    const result = v.validate(makeSignal({ chosenContent: '' }))
    expect(result.valid).toBe(false)
  })

  it('rejects when rejected content is too short', () => {
    const result = v.validate(
      makeSignal({
        signal: 'retry',
        rejectedContent: 'tiny',
      })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/rejected content too short/)
  })

  it('rejects when chosen and rejected are identical', () => {
    const content = 'Identical content for both sides of the pair.'
    const result = v.validate(
      makeSignal({ signal: 'retry', chosenContent: content, rejectedContent: content })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/identical/)
  })

  it('rejects thumb_down without a rejected counterpart', () => {
    const result = v.validate(makeSignal({ signal: 'thumb_down' }))
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/rejected counterpart/)
  })

  it('copy signal has lower confidence than thumb_up', () => {
    const copy = v.validate(makeSignal({ signal: 'copy' }))
    const up = v.validate(makeSignal({ signal: 'thumb_up' }))
    expect(copy.confidence).toBeLessThan(up.confidence!)
  })
})

describe('QualityValidator.validateBatch', () => {
  it('partitions valid and invalid signals', () => {
    const signals = [
      makeSignal({ id: 'fb_1' }),                                                    // valid
      makeSignal({ id: 'fb_2', chosenContent: 'hi' }),                               // invalid: too short
      makeSignal({ id: 'fb_3', signal: 'retry', rejectedContent: 'Old response here that is long enough.' }), // valid
      makeSignal({ id: 'fb_4', signal: 'thumb_down' }),                              // invalid: no rejected
    ]
    const { valid, invalid } = v.validateBatch(signals)
    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(2)
    expect(valid.every(s => typeof s.confidence === 'number')).toBe(true)
    expect(invalid.every(s => typeof s.reason === 'string')).toBe(true)
  })

  it('returns empty arrays for empty input', () => {
    const { valid, invalid } = v.validateBatch([])
    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })
})
