import { describe, it, expect, beforeEach } from 'vitest'
import { clearDb } from '../clearDb'
import { openDB } from '../../src/schema'
import type { MemoryEntry } from '@airia/types'

function makeEntry(id: string, overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id,
    key: 'prefers_concise_answers',
    value: 'true',
    confidence: 0.8,
    lastSeen: Date.now(),
    sourceConversationId: 'conv_a',
    category: 'preference',
    ...overrides,
  }
}

describe('memory store schema', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('persists and retrieves entries by id', async () => {
    const db = await openDB()
    await db.put('memory', makeEntry('mem_1'))

    const fetched = await db.get('memory', 'mem_1')
    expect(fetched?.key).toBe('prefers_concise_answers')
  })

  it('queries entries by category index', async () => {
    const db = await openDB()
    await db.put('memory', makeEntry('mem_1', { category: 'preference' }))
    await db.put('memory', makeEntry('mem_2', { category: 'fact', key: 'works_at_amazon' }))

    const facts = await db.getAllFromIndex('memory', 'category', 'fact')
    expect(facts.map(e => e.id)).toEqual(['mem_2'])
  })

  it('deleting an entry removes it from the store', async () => {
    const db = await openDB()
    await db.put('memory', makeEntry('mem_1'))
    await db.delete('memory', 'mem_1')

    expect(await db.get('memory', 'mem_1')).toBeUndefined()
  })
})
