import { openDB } from '../src/schema'

export async function clearDb(): Promise<void> {
  const db = await openDB()
  const stores = ['conversations', 'messages', 'feedback', 'memory', 'skills', 'adapters'] as const
  await Promise.all(stores.map(store => db.clear(store)))
}
