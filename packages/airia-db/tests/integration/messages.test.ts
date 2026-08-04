import { describe, it, expect, beforeEach } from 'vitest'
import { clearDb } from '../clearDb'
import { upsertMessage, getMessages } from '../../src/client'
import type { Message } from '@airia/types'

function makeMsg(id: string, conversationId: string, timestamp: number): Message {
  return {
    id,
    conversationId,
    role: 'user',
    content: `msg ${id}`,
    timestamp,
  }
}

describe('messages CRUD', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('upsertMessage + getMessages returns oldest first for the given conversation', async () => {
    await upsertMessage(makeMsg('m1', 'conv_a', 3000))
    await upsertMessage(makeMsg('m2', 'conv_a', 1000))
    await upsertMessage(makeMsg('m3', 'conv_a', 2000))
    await upsertMessage(makeMsg('other', 'conv_b', 500))

    const msgs = await getMessages('conv_a')
    expect(msgs.map(m => m.id)).toEqual(['m2', 'm3', 'm1'])
  })

  it('only returns messages for the requested conversation', async () => {
    await upsertMessage(makeMsg('m1', 'conv_a', 1000))
    await upsertMessage(makeMsg('m2', 'conv_b', 2000))

    const msgs = await getMessages('conv_b')
    expect(msgs.map(m => m.id)).toEqual(['m2'])
  })
})
