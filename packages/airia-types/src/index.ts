// AIrIA — Core TypeScript Interfaces
// CTO-owned. Do not modify without CTO review.
// These are the contracts every service must implement.

// ─── Tier ────────────────────────────────────────────────────────────────────

export type Tier = 'local' | 'cloud' | 'free' | 'on-device'
export type DeviceClass = 'desktop' | 'mobile' | 'low-memory'

export interface TierConfig {
  tier: Tier
  ollamaEndpoint: string
  authToken?: string
  trainingEnabled: boolean
  updateChannelEnabled: boolean
  modelName: string
  deviceClass: DeviceClass
}

export interface TierRouter {
  detect(): Promise<TierConfig>
  getCurrent(): TierConfig
  switchTier(tier: Tier, config?: Partial<TierConfig>): Promise<void>
  getCustomOllamaEndpoint(): string
  setCustomOllamaEndpoint(endpoint: string): Promise<TierConfig>
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
  modelUsed?: string
  routeInfo?: RouteInfo
  /** What the user attached to this turn, kept so the transcript stays readable. */
  attachments?: AttachmentHint[]
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

// ─── Training Pairs ──────────────────────────────────────────────────────────

export interface PreferencePair {
  chosen: string
  rejected: string
  confidence: number        // from QualityValidator
  signalType: FeedbackSignalType
  conversationId: string
  timestamp: number
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface MessageMetric {
  id: string
  messageId: string
  conversationId: string
  timestamp: number
  // Performance
  latencyMs: number          // time from send to first token
  durationMs: number         // total response time
  tokensPerSecond: number
  promptTokens: number
  completionTokens: number
  // Quality signals
  feedbackSignal?: FeedbackSignalType
  retried: boolean
  uncertaintyFlagged: boolean   // detected hedging phrases in response
  contradictionFlagged: boolean // contradicted a stored memory
  // Context
  tier: Tier
  modelName: string
}

export interface MetricsSummary {
  totalMessages: number
  thumbUpRate: number          // 0-1
  thumbDownRate: number        // 0-1
  retryRate: number            // 0-1
  avgLatencyMs: number
  avgTokensPerSecond: number
  uncertaintyRate: number      // 0-1
  contradictionRate: number    // 0-1
  periodDays: number
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

// ─── Capability Routing ──────────────────────────────────────────────────────

export type Capability = 'vision' | 'code' | 'reason'

export interface CapabilityModelEntry {
  capability: Capability
  modelName: string
  priority: number
}

export interface RoutingDecision {
  capability: Capability
  modelName: string
  score: number
  method: 'rules' | 'semantic' | 'default'
  queryEmbedding?: number[]
  timestamp: number
}

export interface CapabilityRouter {
  route(query: string, attachments?: AttachmentHint[]): RoutingDecision
  registerCapability(entry: CapabilityModelEntry, exemplars?: string[]): void
  getRegistry(): ReadonlyMap<Capability, CapabilityModelEntry>
}

export interface AttachmentHint {
  type: 'image' | 'file'
  mimeType?: string
  filename?: string
  uri?: string
  sizeBytes?: number
}

/**
 * What the router asked for vs. what actually ran. When a capability model
 * isn't on disk we fall back rather than block — `fallback` records why so the
 * UI can explain it instead of silently serving the wrong model.
 */
export interface RouteInfo {
  capability: Capability
  /** Display name of the model the router selected. */
  requestedModel: string
  /** Registry id of the requested model, when one exists on-device. */
  requestedModelId?: string
  /** Display name of the model that actually served the request. */
  actualModel: string
  fallback: 'none' | 'not-downloaded' | 'no-model'
  method: RoutingDecision['method']
  score: number
}

// ─── Risk-Tiered Skill Contracts ─────────────────────────────────────────────

export type RiskTier = 'informational' | 'consequential' | 'regulated'

export interface GroundingPolicy {
  retrievalScoreFloor: number
  citationsRequired: boolean
  allowModelRecall: boolean
}

export interface OutputPolicy {
  disclaimerInjection: boolean
  refusalOnLowConfidence: boolean
}

export interface GatePolicy {
  requiresUserAck: boolean
  auditLog: boolean
  humanReviewBeforePublish: boolean
}

export interface SkillContract {
  skillId: SkillId
  riskTier: RiskTier
  grounding: GroundingPolicy
  output: OutputPolicy
  gate: GatePolicy
  corpusId?: string
}

export const RISK_TIER_DEFAULTS: Record<RiskTier, { grounding: GroundingPolicy; output: OutputPolicy; gate: GatePolicy }> = {
  informational: {
    grounding: { retrievalScoreFloor: 0, citationsRequired: false, allowModelRecall: true },
    output: { disclaimerInjection: false, refusalOnLowConfidence: false },
    gate: { requiresUserAck: false, auditLog: false, humanReviewBeforePublish: false },
  },
  consequential: {
    grounding: { retrievalScoreFloor: 0.4, citationsRequired: false, allowModelRecall: true },
    output: { disclaimerInjection: true, refusalOnLowConfidence: false },
    gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: false },
  },
  regulated: {
    grounding: { retrievalScoreFloor: 0.7, citationsRequired: true, allowModelRecall: false },
    output: { disclaimerInjection: true, refusalOnLowConfidence: true },
    gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: true },
  },
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
