import { openDB } from './schema'
import type { Conversation, Message, FeedbackSignal, TrainingJob, MessageMetric, MetricsSummary, FeedbackSignalType } from '@airia/types'

function feedbackId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

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

export async function storeFeedback(signal: Omit<FeedbackSignal, 'id'>): Promise<FeedbackSignal> {
  const db = await openDB()
  const entry: FeedbackSignal = { ...signal, id: feedbackId() }
  await db.put('feedback', entry)
  return entry
}

export async function getFeedbackPairs(since?: number): Promise<FeedbackSignal[]> {
  const db = await openDB()
  const all = await db.getAllFromIndex('feedback', 'timestamp')
  return since !== undefined ? all.filter(f => f.timestamp >= since) : all
}

export async function getFeedbackCount(): Promise<number> {
  const db = await openDB()
  return db.count('feedback')
}

export async function clearFeedback(): Promise<void> {
  const db = await openDB()
  await db.clear('feedback')
}

export async function storeTrainingJob(job: TrainingJob): Promise<void> {
  const db = await openDB()
  await db.put('trainingJobs', job)
}

export async function getTrainingJobs(): Promise<TrainingJob[]> {
  const db = await openDB()
  const all = await db.getAllFromIndex('trainingJobs', 'startedAt')
  return all.reverse() // newest first
}

export async function getLatestTrainingJob(): Promise<TrainingJob | undefined> {
  const jobs = await getTrainingJobs()
  return jobs[0]
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

// ─── Metrics ─────────────────────────────────────────────────────────────────

export async function storeMetric(metric: MessageMetric): Promise<void> {
  const db = await openDB()
  await db.put('metrics', metric)
}

export async function getMetricsSummary(periodDays = 7): Promise<MetricsSummary> {
  const db = await openDB()
  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000
  const all = await db.getAllFromIndex('metrics', 'timestamp')
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
  const avgTps = recent.filter(m => m.tokensPerSecond > 0)
    .reduce((s, m) => s + m.tokensPerSecond, 0) / (recent.filter(m => m.tokensPerSecond > 0).length || 1)

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
  const db = await openDB()
  const all = await db.getAllFromIndex('metrics', 'timestamp')
  const metric = all.find(m => m.messageId === messageId)
  if (metric) {
    await db.put('metrics', { ...metric, feedbackSignal: signal })
  }
}
