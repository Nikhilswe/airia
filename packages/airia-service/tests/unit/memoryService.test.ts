// AIrIA — MemoryStore unit tests
// CTO-owned. Covers confidence merge on upsert (relevance logic correctness path).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryStore } from '../../src/MemoryService'

const records = new Map<string, unknown>()

vi.mock('@airia/db', () => ({
  openDB: async () => ({
    getAll: async (_store: string) => [...records.values()],
    put: async (_store: string, value: { id: string }) => {
      records.set(value.id, value)
    },
    get: async (_store: string, id: string) => records.get(id),
    delete: async (_store: string, id: string) => {
      records.delete(id)
    },
  }),
}))

describe('MemoryStore', () => {
  beforeEach(() => {
    records.clear()
  })

  it('creates a new entry when key does not exist', async () => {
    const store = new MemoryStore()
    const entry = await store.upsert({
      key: 'prefers_concise_answers',
      value: 'true',
      confidence: 0.8,
      lastSeen: Date.now(),
      sourceConversationId: 'conv_a',
      category: 'preference',
    })

    expect(entry.confidence).toBe(0.8)
    expect((await store.getAll())).toHaveLength(1)
  })

  it('merges confidence as a weighted average plus reinforcement bonus on repeated upsert', async () => {
    const store = new MemoryStore()
    const first = await store.upsert({
      key: 'prefers_concise_answers',
      value: 'true',
      confidence: 0.8,
      lastSeen: Date.now(),
      sourceConversationId: 'conv_a',
      category: 'preference',
    })

    const second = await store.upsert({
      key: 'prefers_concise_answers',
      value: 'true',
      confidence: 0.6,
      lastSeen: Date.now(),
      sourceConversationId: 'conv_b',
      category: 'preference',
    })

    // (0.8 + 0.6) / 2 + 0.05 = 0.75
    expect(second.confidence).toBeCloseTo(0.75)
    expect(second.id).toBe(first.id)
    expect(await store.getAll()).toHaveLength(1)
  })

  it('caps merged confidence at 1', async () => {
    const store = new MemoryStore()
    await store.upsert({
      key: 'k',
      value: 'v',
      confidence: 1,
      lastSeen: Date.now(),
      sourceConversationId: 'conv_a',
      category: 'fact',
    })
    const merged = await store.upsert({
      key: 'k',
      value: 'v',
      confidence: 1,
      lastSeen: Date.now(),
      sourceConversationId: 'conv_b',
      category: 'fact',
    })

    expect(merged.confidence).toBe(1)
  })
})
