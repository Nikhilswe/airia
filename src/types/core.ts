// AIrIA — Core TypeScript Interfaces
// CTO-owned. Do not modify without CTO review.
// These are the contracts every service must implement.

// ─── Tier ────────────────────────────────────────────────────────────────────

export type Tier = 'local' | 'cloud' | 'free'

export interface TierConfig {
  tier: Tier
  ollamaEndpoint: string       // local: localhost:11434 | cloud: https://... | free: localhost:11434
  authToken?: string           // cloud tier only
  trainingEnabled: boolean     // false on free tier
  updateChannelEnabled: boolean // true on free tier only
  modelName: string            // e.g. gemma3:12b or gemma3:12b-airia-v4
}

export interface TierRouter {
  detect(): Promise<TierConfig>
  getCurrent(): TierConfig
  switchTier(tier: Tier, config?: Partial<TierConfig>): Promise<void>
}

// ─── Ollama ──────────────────────────────────────────────────────────────────

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OllamaStreamChunk {
  model: string
  created_at: string
  message: { role: string; content: string }
  done: boolean
}

export interface OllamaClient {
  ping(): Promise<boolean>
  chat(
    messages: OllamaMessage[],
    options?: {
      temperature?: number
      onChunk?: (chunk: string) => void
      signal?: AbortSignal
    }
  ): Promise<string>
  listModels(): Promise<string[]>
  loadModel(modelName: string): Promise<void>
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  feedbackSignal?: FeedbackSignalType
  tokenCount?: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  modelVersion: string
  tier: Tier
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export type FeedbackSignalType = 'thumb_up' | 'thumb_down' | 'retry' | 'copy' | 'edit'

export interface FeedbackSignal {
  id: string
  conversationId: string
  messageId: string
  signal: FeedbackSignalType
  timestamp: number
  chosenContent: string    // the response that was preferred
  rejectedContent?: string // the response that was rejected (retry case)
}

export interface FeedbackStore {
  record(signal: Omit<FeedbackSignal, 'id'>): Promise<FeedbackSignal>
  getPairs(since?: number): Promise<FeedbackSignal[]>
  getPairCount(): Promise<number>
  clear(): Promise<void>
}

// ─── Memory Layer ─────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string
  key: string               // e.g. "prefers_concise_answers", "works_at_amazon"
  value: string             // e.g. "true", "Senior SDE II"
  confidence: number        // 0-1, decays when contradicted
  lastSeen: number          // timestamp
  sourceConversationId: string
  category: 'preference' | 'fact' | 'pattern' | 'goal'
}

export interface MemoryRetriever {
  // CTO-owned: relevance logic determines what gets injected per turn
  getRelevant(query: string, budget: number): Promise<MemoryEntry[]>
  buildSystemContext(entries: MemoryEntry[]): string
}

export interface MemoryStore {
  upsert(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry>
  getAll(): Promise<MemoryEntry[]>
  decay(entryId: string, amount: number): Promise<void>
  prune(olderThanDays: number): Promise<number>  // returns pruned count
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export type SkillId =
  | 'conversation_search'
  | 'custom_system_prompt'
  | 'fine_tune'
  | 'adapter_registry'
  | 'advanced_context'
  | 'webrtc_sync'

export interface SkillMilestone {
  skillId: SkillId
  requiredConversations?: number
  requiredFeedbackSignals?: number
  requiredFineTuneCycles?: number
  availableOnFree: boolean
}

export interface SkillState {
  skillId: SkillId
  unlocked: boolean
  unlockedAt?: number
  progress: number  // 0-1 toward next milestone
}

export interface SkillRegistry {
  check(skillId: SkillId): Promise<SkillState>
  getAll(): Promise<SkillState[]>
  // Called after each conversation/event to update progress
  tick(event: 'conversation' | 'feedback' | 'fine_tune'): Promise<SkillState[]>
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

export interface AdapterManifest {
  id: string
  name: string
  version: string
  description: string
  downloadUrl: string
  sha256: string
  signature: string          // Ed25519 signature over (id + version + sha256)
  sizeBytes: number
  compatibleModels: string[] // e.g. ['gemma3:12b', 'gemma3:4b']
}

export interface AdapterRegistry {
  list(): Promise<AdapterManifest[]>
  verify(adapter: AdapterManifest): Promise<boolean>  // Ed25519 check — CTO-owned
  install(adapter: AdapterManifest): Promise<void>
  uninstall(adapterId: string): Promise<void>
  getInstalled(): Promise<AdapterManifest[]>
}

// ─── Training (Local + Cloud) ─────────────────────────────────────────────────

export type TrainingJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'

export interface TrainingJob {
  id: string
  tier: 'local' | 'cloud'
  status: TrainingJobStatus
  pairCount: number
  baseModelVersion: string
  outputModelVersion?: string
  startedAt: number
  completedAt?: number
  evalScore?: number         // MMLU delta post-tune
  error?: string
}

export interface EvalResult {
  jobId: string
  baselineScore: number
  newScore: number
  delta: number
  passed: boolean            // delta >= -0.02 (max 2% regression)
  timestamp: number
}

// ─── Update Channel (Free tier) ───────────────────────────────────────────────

export interface ModelUpdate {
  version: string
  releaseNotes: string
  downloadUrl: string
  sha256: string
  signature: string          // Ed25519, update signing key (separate from adapter key)
  publishedAt: number
  sizeBytes: number
}

export interface UpdateChannel {
  checkForUpdate(): Promise<ModelUpdate | null>
  verify(update: ModelUpdate): Promise<boolean>
  apply(update: ModelUpdate, onProgress?: (pct: number) => void): Promise<void>
  rollback(): Promise<void>
}
