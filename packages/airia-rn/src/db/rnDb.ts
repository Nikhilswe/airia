// AIrIA — React Native implementation of the @airia/db API.
// IndexedDB doesn't exist in React Native, so Metro resolves '@airia/db' to
// this module (see metro.config.js). Each store is an in-memory Map persisted
// as a JSON file under the app's document directory via expo-file-system.

import * as FileSystem from 'expo-file-system/legacy'
import type {
  Conversation, Message, FeedbackSignal, TrainingJob,
  MessageMetric, MetricsSummary, FeedbackSignalType,
} from '@airia/types'

type StoreName = 'conversations' | 'messages' | 'feedback' | 'trainingJobs' | 'metrics' | 'memory' | 'settings'

// metrics are keyed by messageId (mirrors the web schema); everything else by id
const KEY_FIELD: Record<StoreName, string> = {
  conversations: 'id',
  messages: 'id',
  feedback: 'id',
  trainingJobs: 'id',
  metrics: 'messageId',
  memory: 'id',
  settings: 'id',
}

const DB_DIR = `${FileSystem.documentDirectory}airia-db/`

const stores = new Map<StoreName, Map<string, any>>()
const loaded = new Set<StoreName>()
const writeTimers = new Map<StoreName, ReturnType<typeof setTimeout>>()

async function load(name: StoreName): Promise<Map<string, any>> {
  if (loaded.has(name)) return stores.get(name)!
  const map = new Map<string, any>()
  try {
    const info = await FileSystem.getInfoAsync(`${DB_DIR}${name}.json`)
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(`${DB_DIR}${name}.json`)
      for (const item of JSON.parse(raw) as any[]) {
        map.set(String(item[KEY_FIELD[name]]), item)
      }
    }
  } catch (err) {
    console.warn(`[rnDb] failed to load store "${name}", starting empty:`, err)
  }
  stores.set(name, map)
  loaded.add(name)
  return map
}

function schedulePersist(name: StoreName): void {
  const existing = writeTimers.get(name)
  if (existing) clearTimeout(existing)
  writeTimers.set(
    name,
    setTimeout(async () => {
      writeTimers.delete(name)
      try {
        await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true }).catch(() => {})
        const map = stores.get(name)
        if (!map) return
        await FileSystem.writeAsStringAsync(
          `${DB_DIR}${name}.json`,
          JSON.stringify(Array.from(map.values()))
        )
      } catch (err) {
        console.warn(`[rnDb] failed to persist store "${name}":`, err)
      }
    }, 200)
  )
}

async function putRecord(name: StoreName, value: any): Promise<void> {
  const map = await load(name)
  map.set(String(value[KEY_FIELD[name]]), value)
  schedulePersist(name)
}

async function allRecords<T>(name: StoreName): Promise<T[]> {
  return Array.from((await load(name)).values())
}

function feedbackId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── Conversations / messages ────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const all = await allRecords<Conversation>('conversations')
  return all.sort((a, b) => b.updatedAt - a.updatedAt) // newest first
}

export async function upsertConversation(c: Conversation): Promise<void> {
  await putRecord('conversations', c)
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const all = await allRecords<Message>('messages')
  return all
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export async function upsertMessage(m: Message): Promise<void> {
  await putRecord('messages', m)
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await load('conversations')
  const messages = await load('messages')
  const feedback = await load('feedback')

  for (const [key, m] of messages) {
    if (m.conversationId === id) messages.delete(key)
  }
  for (const [key, f] of feedback) {
    if (f.conversationId === id) feedback.delete(key)
  }
  conversations.delete(id)

  schedulePersist('messages')
  schedulePersist('feedback')
  schedulePersist('conversations')
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function storeFeedback(signal: Omit<FeedbackSignal, 'id'>): Promise<FeedbackSignal> {
  const entry: FeedbackSignal = { ...signal, id: feedbackId() }
  await putRecord('feedback', entry)
  return entry
}

export async function getFeedbackPairs(since?: number): Promise<FeedbackSignal[]> {
  const all = await allRecords<FeedbackSignal>('feedback')
  const sorted = all.sort((a, b) => a.timestamp - b.timestamp)
  return since !== undefined ? sorted.filter(f => f.timestamp >= since) : sorted
}

export async function getFeedbackCount(): Promise<number> {
  return (await load('feedback')).size
}

export async function clearFeedback(): Promise<void> {
  ;(await load('feedback')).clear()
  schedulePersist('feedback')
}

// ─── Training jobs ───────────────────────────────────────────────────────────

export async function storeTrainingJob(job: TrainingJob): Promise<void> {
  await putRecord('trainingJobs', job)
}

export async function getTrainingJobs(): Promise<TrainingJob[]> {
  const all = await allRecords<TrainingJob>('trainingJobs')
  return all.sort((a, b) => b.startedAt - a.startedAt) // newest first
}

export async function getLatestTrainingJob(): Promise<TrainingJob | undefined> {
  return (await getTrainingJobs())[0]
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export async function storeMetric(metric: MessageMetric): Promise<void> {
  await putRecord('metrics', metric)
}

export async function getMetricsSummary(periodDays = 7): Promise<MetricsSummary> {
  const all = await allRecords<MessageMetric>('metrics')
  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000
  const recent = all.filter(m => m.timestamp >= since)

  if (recent.length === 0) {
    return {
      totalMessages: 0, thumbUpRate: 0, thumbDownRate: 0, retryRate: 0,
      avgLatencyMs: 0, avgTokensPerSecond: 0, uncertaintyRate: 0,
      contradictionRate: 0, periodDays,
    }
  }

  const thumbUps = recent.filter(m => m.feedbackSignal === 'thumb_up').length
  const thumbDowns = recent.filter(m => m.feedbackSignal === 'thumb_down').length
  const retries = recent.filter(m => m.retried).length
  const uncertain = recent.filter(m => m.uncertaintyFlagged).length
  const contradictions = recent.filter(m => m.contradictionFlagged).length
  const avgLatency = recent.reduce((s, m) => s + m.latencyMs, 0) / recent.length
  const withTps = recent.filter(m => m.tokensPerSecond > 0)
  const avgTps = withTps.reduce((s, m) => s + m.tokensPerSecond, 0) / (withTps.length || 1)

  return {
    totalMessages: recent.length,
    thumbUpRate: thumbUps / recent.length,
    thumbDownRate: thumbDowns / recent.length,
    retryRate: retries / recent.length,
    avgLatencyMs: Math.round(avgLatency),
    avgTokensPerSecond: Math.round(avgTps * 10) / 10,
    uncertaintyRate: uncertain / recent.length,
    contradictionRate: contradictions / recent.length,
    periodDays,
  }
}

export async function updateMetricFeedback(
  messageId: string,
  signal: FeedbackSignalType
): Promise<void> {
  const map = await load('metrics')
  const metric = map.get(messageId)
  if (metric) {
    map.set(messageId, { ...metric, feedbackSignal: signal })
    schedulePersist('metrics')
  }
}

// ─── App settings (RN-only, not part of the @airia/db API) ───────────────────

export async function getSetting(key: string): Promise<string | null> {
  const entry = (await load('settings')).get(key)
  return entry ? entry.value : null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await putRecord('settings', { id: key, value })
}

// ─── openDB shim ─────────────────────────────────────────────────────────────
// MemoryService accesses the db directly with an idb-style handle. Provide the
// subset it uses (getAll / get / put / delete on the 'memory' store).

export async function openDB(): Promise<{
  getAll(store: string): Promise<any[]>
  get(store: string, key: string): Promise<any | undefined>
  put(store: string, value: any): Promise<void>
  delete(store: string, key: string): Promise<void>
}> {
  return {
    async getAll(store: string) {
      return allRecords(store as StoreName)
    },
    async get(store: string, key: string) {
      return (await load(store as StoreName)).get(String(key))
    },
    async put(store: string, value: any) {
      await putRecord(store as StoreName, value)
    },
    async delete(store: string, key: string) {
      ;(await load(store as StoreName)).delete(String(key))
      schedulePersist(store as StoreName)
    },
  }
}
