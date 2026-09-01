import { describe, it, expect, beforeEach } from 'vitest'
import { clearDb } from '../clearDb'
import { openDB } from '../../src/schema'
import { upsertConversation, upsertMessage, deleteConversation, getMessages } from '../../src/client'
import type { Conversation, Message, FeedbackSignal } from '@airia/types'

const conv: Conversation = {
  id: 'conv_x',
  title: 'To delete',
  createdAt: 1000,
  updatedAt: 1000,
  messageCount: 1,
  modelVersion: 'gemma3:12b',
  tier: 'local',
}

const msg: Message = {
  id: 'msg_x',
  conversationId: 'conv_x',
  role: 'user',
  content: 'hello',
  timestamp: 1000,
}

const feedback: FeedbackSignal = {
  id: 'fb_x',
  conversationId: 'conv_x',
  messageId: 'msg_x',
  signal: 'thumb_up',
  timestamp: 1000,
  chosenContent: 'hello',
}

describe('deleteConversation cascade', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('removes the conversation, its messages, and its feedback', async () => {
    await upsertConversation(conv)
    await upsertMessage(msg)
    const db = await openDB()
    await db.put('feedback', feedback)

    await deleteConversation('conv_x')

    const db2 = await openDB()
    expect(await db2.get('conversations', 'conv_x')).toBeUndefined()
    expect(await getMessages('conv_x')).toEqual([])
    expect(await db2.get('feedback', 'fb_x')).toBeUndefined()
  })

  it('does not affect other conversations data', async () => {
    const otherConv: Conversation = { ...conv, id: 'conv_y' }
    const otherMsg: Message = { ...msg, id: 'msg_y', conversationId: 'conv_y' }
    await upsertConversation(conv)
    await upsertConversation(otherConv)
    await upsertMessage(msg)
    await upsertMessage(otherMsg)

    await deleteConversation('conv_x')

    expect(await getMessages('conv_y')).toHaveLength(1)
  })
})
