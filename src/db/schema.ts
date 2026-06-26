import { openDB as idbOpenDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Conversation,
  Message,
  FeedbackSignal,
  MemoryEntry,
  SkillState,
  AdapterManifest,
} from '../types/core'

export const DB_NAME = 'airia-prod'
export const DB_VERSION = 1

interface AIrIASchema extends DBSchema {
  conversations: {
    key: string
    value: Conversation
    indexes: { updatedAt: number }
  }
  messages: {
    key: string
    value: Message
    indexes: { conversationId: string; timestamp: number }
  }
  feedback: {
    key: string
    value: FeedbackSignal
    indexes: { conversationId: string; timestamp: number }
  }
  memory: {
    key: string
    value: MemoryEntry
    indexes: { category: string; lastSeen: number; confidence: number }
  }
  skills: {
    key: string
    value: SkillState
  }
  adapters: {
    key: string
    value: AdapterManifest
  }
}

let _db: IDBPDatabase<AIrIASchema> | null = null

export async function openDB(): Promise<IDBPDatabase<AIrIASchema>> {
  if (_db) return _db

  _db = await idbOpenDB<AIrIASchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // conversations
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
      convStore.createIndex('updatedAt', 'updatedAt')

      // messages
      const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
      msgStore.createIndex('conversationId', 'conversationId')
      msgStore.createIndex('timestamp', 'timestamp')

      // feedback
      const fbStore = db.createObjectStore('feedback', { keyPath: 'id' })
      fbStore.createIndex('conversationId', 'conversationId')
      fbStore.createIndex('timestamp', 'timestamp')

      // memory
      const memStore = db.createObjectStore('memory', { keyPath: 'id' })
      memStore.createIndex('category', 'category')
      memStore.createIndex('lastSeen', 'lastSeen')
      memStore.createIndex('confidence', 'confidence')

      // skills
      db.createObjectStore('skills', { keyPath: 'skillId' })

      // adapters
      db.createObjectStore('adapters', { keyPath: 'id' })
    },
  })

  return _db
}
