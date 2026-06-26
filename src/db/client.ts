import { openDB } from './schema'
import type { Conversation, Message } from '../types/core'

export async function getConversations(): Promise<Conversation[]> {
  const db = await openDB()
  const all = await db.getAllFromIndex('conversations', 'updatedAt')
  return all.reverse() // newest first
}

export async function upsertConversation(c: Conversation): Promise<void> {
  const db = await openDB()
  await db.put('conversations', c)
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = await openDB()
  const all = await db.getAllFromIndex('messages', 'conversationId', conversationId)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

export async function upsertMessage(m: Message): Promise<void> {
  const db = await openDB()
  await db.put('messages', m)
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['conversations', 'messages', 'feedback'], 'readwrite')

  // cascade delete messages
  const msgIndex = tx.objectStore('messages').index('conversationId')
  const msgKeys = await msgIndex.getAllKeys(id)
  for (const key of msgKeys) await tx.objectStore('messages').delete(key)

  // cascade delete feedback
  const fbIndex = tx.objectStore('feedback').index('conversationId')
  const fbKeys = await fbIndex.getAllKeys(id)
  for (const key of fbKeys) await tx.objectStore('feedback').delete(key)

  // delete conversation itself
  await tx.objectStore('conversations').delete(id)
  await tx.done
}
