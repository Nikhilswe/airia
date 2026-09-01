import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PreferencePairBuilder } from '../../src/PreferencePairBuilder'

// Mock @airia/db so this unit test doesn't need IndexedDB
vi.mock('@airia/db', () => ({
  getFeedbackPairs: vi.fn(),
}))

import { getFeedbackPairs } from '@airia/db'
import type { FeedbackSignal } from '@airia/types'

const mockGet = getFeedbackPairs as ReturnType<typeof vi.fn>

function makeSignal(id: string, overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    id,
    conversationId: 'conv_1',
    messageId: `msg_${id}`,
    signal: 'retry',
    timestamp: Date.now(),
    chosenContent: 'This is a good response with enough content for the test.',
    rejectedContent: 'This was the original response that was not good enough.',
    ...overrides,
  }
}

describe('PreferencePairBuilder', () => {
  let builder: PreferencePairBuilder

  beforeEach(() => {
    builder = new PreferencePairBuilder()
    vi.clearAllMocks()
  })

  it('builds valid DPO pairs from retry signals', async () => {
    mockGet.mockResolvedValue([makeSignal('s1'), makeSignal('s2')])
    const { pairs, jsonl, invalidCount, skippedCount } = await builder.build()

    expect(pairs).toHaveLength(2)
    expect(invalidCount).toBe(0)
    expect(skippedCount).toBe(0)
    expect(jsonl.split('\n')).toHaveLength(2)

    const parsed = JSON.parse(jsonl.split('\n')[0]) as { chosen: string; rejected: string }
    expect(parsed).toHaveProperty('chosen')
    expect(parsed).toHaveProperty('rejected')
  })

  it('skips thumb_up signals that have no rejected counterpart', async () => {
    mockGet.mockResolvedValue([
      makeSignal('s1', { signal: 'thumb_up', rejectedContent: undefined }),
    ])
    const { pairs, skippedCount } = await builder.build()
    expect(pairs).toHaveLength(0)
    expect(skippedCount).toBe(1)
  })

  it('filters out invalid signals (too short) and counts them', async () => {
    mockGet.mockResolvedValue([
      makeSignal('s1'),
      makeSignal('s2', { chosenContent: 'tiny' }),  // invalid — too short
    ])
    const { pairs, invalidCount } = await builder.build()
    expect(pairs).toHaveLength(1)
    expect(invalidCount).toBe(1)
  })

  it('sorts pairs by confidence descending', async () => {
    mockGet.mockResolvedValue([
      makeSignal('s1', { signal: 'copy', chosenContent: 'Good enough response here.', rejectedContent: 'Old response was not as good.' }),  // confidence 0.3
      makeSignal('s2', { signal: 'retry' }),   // confidence 0.9
    ])
    const { pairs } = await builder.build()
    expect(pairs[0].confidence).toBeGreaterThan(pairs[1].confidence)
  })

  it('produces valid JSONL — each line parseable', async () => {
    mockGet.mockResolvedValue([makeSignal('s1'), makeSignal('s2'), makeSignal('s3')])
    const { jsonl } = await builder.build()
    const lines = jsonl.split('\n')
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('getReadyCount returns only DPO-complete pairs', async () => {
    mockGet.mockResolvedValue([
      makeSignal('s1'),
      makeSignal('s2', { signal: 'thumb_up', rejectedContent: undefined }),
      makeSignal('s3', { chosenContent: 'tiny' }),
    ])
    const count = await builder.getReadyCount()
    expect(count).toBe(1)
  })

  it('returns empty result when no signals exist', async () => {
    mockGet.mockResolvedValue([])
    const { pairs, jsonl, invalidCount, skippedCount } = await builder.build()
    expect(pairs).toHaveLength(0)
    expect(jsonl).toBe('')
    expect(invalidCount).toBe(0)
    expect(skippedCount).toBe(0)
  })
})
