import { describe, it, expect, beforeEach } from 'vitest'
import { clearDb } from '../clearDb'
import { upsertMessage, getMessages, upsertConversation, getConversations } from '../../src/client'
import type { Message, Conversation } from '@airia/types'

describe('concurrent writes', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('concurrent message inserts for the same conversation all persist without corruption', async () => {
    const writes = Array.from({ length: 20 }, (_, i): Message => ({
      id: `m${i}`,
      conversationId: 'conv_concurrent',
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
      timestamp: i,
    }))

    await Promise.all(writes.map(m => upsertMessage(m)))

    const msgs = await getMessages('conv_concurrent')
    expect(msgs).toHaveLength(20)
    expect(msgs.map(m => m.timestamp)).toEqual([...msgs.map(m => m.timestamp)].sort((a, b) => a - b))
  })

  it('concurrent conversation upserts to distinct ids all persist', async () => {
    const convs = Array.from({ length: 10 }, (_, i): Conversation => ({
      id: `c${i}`,
      title: `Conversation ${i}`,
      createdAt: i,
      updatedAt: i,
      messageCount: 0,
      modelVersion: 'gemma3:12b',
      tier: 'local',
    }))

    await Promise.all(convs.map(c => upsertConversation(c)))

    const all = await getConversations()
    expect(all).toHaveLength(10)
  })
})
