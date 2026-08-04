// AIrIA — MemoryStore
// IndexedDB CRUD for personal memory entries.

import { openDB } from '@airia/db'
import type { MemoryEntry, MemoryStore as IMemoryStore, MemoryRetriever } from '@airia/types'

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class MemoryStore implements IMemoryStore {
  async upsert(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry> {
    const db = await openDB()
    // Check for existing entry with same key
    const all = await db.getAll('memory')
    const existing = all.find(e => e.key === entry.key)

    if (existing) {
      // Update existing — merge confidence (weighted average)
      const updated: MemoryEntry = {
        ...existing,
        value: entry.value,
        confidence: Math.min(1, (existing.confidence + entry.confidence) / 2 + 0.05),
        lastSeen: Date.now(),
      }
      await db.put('memory', updated)
      return updated
    }

    const newEntry: MemoryEntry = { ...entry, id: generateId() }
    await db.put('memory', newEntry)
    return newEntry
  }

  async getAll(): Promise<MemoryEntry[]> {
    const db = await openDB()
    return db.getAll('memory')
  }

  async decay(entryId: string, amount: number): Promise<void> {
    const db = await openDB()
    const entry = await db.get('memory', entryId)
    if (!entry) return
    const updated: MemoryEntry = {
      ...entry,
      confidence: Math.max(0, entry.confidence - amount),
    }
    await db.put('memory', updated)
  }

  async prune(olderThanDays: number): Promise<number> {
    const db = await openDB()
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    const all = await db.getAll('memory')
    const stale = all.filter(e => e.lastSeen < cutoff || e.confidence < 0.1)
    for (const e of stale) await db.delete('memory', e.id)
    return stale.length
  }
}

// ─── MemoryRetriever — CTO logic lives in ContextManager, this handles retrieval
export class MemoryRetrieverImpl implements MemoryRetriever {
  private store: MemoryStore

  constructor(store: MemoryStore) {
    this.store = store
  }

  /**
   * Returns top-K relevant memory entries for a given query.
   * Scoring: recency + confidence + keyword overlap with query.
   * Token budget enforced by caller (ContextManager).
   */
  async getRelevant(query: string, budget: number): Promise<MemoryEntry[]> {
    const all = await this.store.getAll()
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3))
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    const scored = all.map(entry => {
      const ageDays = (now - entry.lastSeen) / dayMs
      const recencyScore = Math.exp(-ageDays / 30) // exponential decay over 30 days
      const entryWords = new Set(
        `${entry.key} ${entry.value}`.toLowerCase().split(/[\s_]+/)
      )
      const overlap = [...queryWords].filter(w => entryWords.has(w)).length
      const relevanceScore = overlap / Math.max(queryWords.size, 1)
      const score = entry.confidence * 0.4 + recencyScore * 0.4 + relevanceScore * 0.2
      return { entry, score }
    })

    // Sort by score desc, take entries until budget exhausted
    scored.sort((a, b) => b.score - a.score)
    const result: MemoryEntry[] = []
    let usedBudget = 0
    for (const { entry } of scored) {
      const entryTokens = Math.ceil((entry.key + entry.value).length / 4) + 4
      if (usedBudget + entryTokens > budget) break
      result.push(entry)
      usedBudget += entryTokens
    }
    return result
  }

  buildSystemContext(entries: MemoryEntry[]): string {
    if (entries.length === 0) return ''
    const lines = entries.map(e => `- ${e.key.replace(/_/g, ' ')}: ${e.value}`)
    return `\n\nWhat I know about you:\n${lines.join('\n')}`
  }
}
