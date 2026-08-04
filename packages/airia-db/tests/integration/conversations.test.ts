import { describe, it, expect, beforeEach } from 'vitest'
import { clearDb } from '../clearDb'
import { upsertConversation, getConversations } from '../../src/client'
import type { Conversation } from '@airia/types'

function makeConv(id: string, updatedAt: number): Conversation {
  return {
    id,
    title: `Conversation ${id}`,
    createdAt: updatedAt,
    updatedAt,
    messageCount: 1,
    modelVersion: 'gemma3:12b',
    tier: 'local',
  }
}

describe('conversations CRUD', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('upsertConversation + getConversations returns newest first', async () => {
    await upsertConversation(makeConv('c1', 1000))
    await upsertConversation(makeConv('c2', 3000))
    await upsertConversation(makeConv('c3', 2000))

    const all = await getConversations()
    expect(all.map(c => c.id)).toEqual(['c2', 'c3', 'c1'])
  })

  it('upsert overwrites an existing conversation by id', async () => {
    await upsertConversation(makeConv('c1', 1000))
    await upsertConversation({ ...makeConv('c1', 1000), title: 'Updated title' })

    const all = await getConversations()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Updated title')
  })
})
