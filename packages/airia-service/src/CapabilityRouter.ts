// AIrIA — CapabilityRouter
// Two-stage routing: rules pass first, semantic fallback second.
// Runs before TierRouter: ContextManager → route() → TierRouter → OllamaClient.

import type {
  Capability,
  CapabilityModelEntry,
  CapabilityRouter as ICapabilityRouter,
  RoutingDecision,
  AttachmentHint,
  SkillContract,
} from '@airia/types'
import { RISK_TIER_DEFAULTS } from '@airia/types'

// ─── Rules-pass patterns ─────────────────────────────────────────────────────

const IMAGE_MIMES = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|tiff)$/i

// Documents whose content is laid out visually (scans, slides, spreadsheets):
// understanding them means reading the page, so they route to vision.
const VISUAL_DOC_MIMES = /^application\/(pdf|vnd\.openxmlformats-officedocument\.(presentationml|spreadsheetml)\.\w+|vnd\.ms-(powerpoint|excel))$/i
const VISUAL_DOC_EXTS = /\.(pdf|pptx?|xlsx?|numbers|key|heic|heif)$/i

// Source files and structured config — the code model handles these better
// than the reasoner even when the prompt itself says nothing about code.
const CODE_DOC_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|cpp|cc|c|h|hpp|rb|swift|kt|kts|cs|php|sh|bash|zsh|sql|ya?ml|toml|ini|gradle|dockerfile|patch|diff)$/i
const CODE_DOC_MIMES = /^(text\/(x-\w+|javascript|typescript)|application\/(javascript|typescript|x-sh|x-python|json|xml|sql))$/i

const CODE_PATTERNS = [
  /```[\s\S]{4,}?```/,                    // fenced code blocks
  /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|h|rb|swift|kt|cs|php|sh|sql|yaml|json|xml|html|css|scss)\b/i, // file extensions
  /(?:at\s+\S+\s+\(|Traceback \(most recent|Error:\s+.+\n\s+at\s)/,  // stacktraces
  /(?:function|const|let|var|def|class|import|from|require|export|return|if|for|while)\s/,  // language keywords (≥2 matches)
  /(?:TypeError|ReferenceError|SyntaxError|RuntimeError|NullPointerException|IndexError)/,
]
const CODE_KEYWORD_THRESHOLD = 2

const REGULATED_PATTERNS = [
  /\b(?:HIPAA|GDPR|SOC\s?2|PCI[\s-]DSS|FERPA|FDA|SEC\s+filing)\b/i,
  /\b(?:medical\s+(?:diagnosis|advice|treatment)|legal\s+(?:advice|opinion|counsel))\b/i,
  /\b(?:prescri(?:be|ption)|dosage|medication|symptom\s+check)\b/i,
]

// ─── Semantic exemplars ──────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
}

function bagOfWords(tokens: string[]): Map<string, number> {
  const bag = new Map<string, number>()
  for (const t of tokens) bag.set(t, (bag.get(t) ?? 0) + 1)
  return bag
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0
  for (const [k, v] of a) { magA += v * v; if (b.has(k)) dot += v * b.get(k)! }
  for (const [, v] of b) magB += v * v
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

const DEFAULT_EXEMPLARS: Record<Capability, string[]> = {
  vision: [
    'describe this image', 'what do you see in the picture',
    'analyze the screenshot', 'read the text in this photo',
    'what is shown in the diagram', 'identify objects in this image',
    'compare these two images', 'extract data from this chart',
    'describe the layout', 'what colors are in this picture',
    'transcribe the handwriting', 'is there text in this image',
    'label the parts of this diagram', 'what emotion does this face show',
    'count the items in the photo', 'describe the scene',
    'read the table from this screenshot', 'what brand is this logo',
    'identify this plant', 'what is wrong with this UI screenshot',
  ],
  code: [
    'fix this bug in my code', 'write a function that',
    'refactor this component', 'why does this test fail',
    'explain this error message', 'review this pull request',
    'convert this to typescript', 'optimize this query',
    'debug this crash', 'add error handling to this function',
    'write unit tests for', 'what does this regex do',
    'implement a binary search', 'parse this JSON response',
    'create a REST API endpoint', 'fix the type error in',
    'why is this promise not resolving', 'explain this stack trace',
    'set up a CI pipeline', 'migrate this to async/await',
  ],
  reason: [
    'explain the concept of', 'what are the pros and cons',
    'help me plan', 'summarize this article',
    'compare and contrast', 'what should I consider when',
    'draft an email to', 'brainstorm ideas for',
    'how does this work', 'what is the best approach',
    'analyze the tradeoffs', 'create an outline for',
    'help me understand', 'what are the implications of',
    'recommend a strategy', 'evaluate this proposal',
    'what questions should I ask', 'think through this problem',
    'prioritize these tasks', 'break down this complex topic',
  ],
}

// ─── Routing log ─────────────────────────────────────────────────────────────

export interface RoutingLogEntry extends RoutingDecision {
  query: string
  outcome?: 'success' | 'failure' | 'pending'
}

// ─── Contract validation ─────────────────────────────────────────────────────

export class ContractValidationError extends Error {
  constructor(
    public readonly skillId: string,
    public readonly violations: string[],
  ) {
    super(`Skill "${skillId}" contract invalid: ${violations.join('; ')}`)
    this.name = 'ContractValidationError'
  }
}

export function validateSkillContract(contract: SkillContract): void {
  const defaults = RISK_TIER_DEFAULTS[contract.riskTier]
  const violations: string[] = []

  // Grounding: skill may tighten (raise floor, require citations, disallow recall) but never loosen
  if (contract.grounding.retrievalScoreFloor < defaults.grounding.retrievalScoreFloor) {
    violations.push(`retrievalScoreFloor ${contract.grounding.retrievalScoreFloor} below tier minimum ${defaults.grounding.retrievalScoreFloor}`)
  }
  if (defaults.grounding.citationsRequired && !contract.grounding.citationsRequired) {
    violations.push('citationsRequired cannot be loosened from tier default')
  }
  if (!defaults.grounding.allowModelRecall && contract.grounding.allowModelRecall) {
    violations.push('allowModelRecall cannot be loosened from tier default')
  }

  // Output: same tighten-only rule
  if (defaults.output.disclaimerInjection && !contract.output.disclaimerInjection) {
    violations.push('disclaimerInjection cannot be loosened from tier default')
  }
  if (defaults.output.refusalOnLowConfidence && !contract.output.refusalOnLowConfidence) {
    violations.push('refusalOnLowConfidence cannot be loosened from tier default')
  }

  // Gate: same tighten-only rule
  if (defaults.gate.requiresUserAck && !contract.gate.requiresUserAck) {
    violations.push('requiresUserAck cannot be loosened from tier default')
  }
  if (defaults.gate.auditLog && !contract.gate.auditLog) {
    violations.push('auditLog cannot be loosened from tier default')
  }
  if (defaults.gate.humanReviewBeforePublish && !contract.gate.humanReviewBeforePublish) {
    violations.push('humanReviewBeforePublish cannot be loosened from tier default')
  }

  // Regulated skills must have a corpus
  if (contract.riskTier === 'regulated' && !contract.corpusId) {
    violations.push('regulated skills must specify a corpusId — cannot answer from model weights alone')
  }

  if (violations.length > 0) {
    throw new ContractValidationError(contract.skillId, violations)
  }
}

// ─── Unsafe-fallback guard ───────────────────────────────────────────────────

export class RegulatedDomainError extends Error {
  constructor(public readonly domain: string) {
    super(
      `This query touches a regulated domain (${domain}). ` +
      `I don't have a grounded, reviewed skill for this area yet, ` +
      `so I can't give you a reliable answer. ` +
      `I'd rather be honest about that than improvise something that sounds confident but might be wrong.`
    )
    this.name = 'RegulatedDomainError'
  }
}

// ─── CapabilityRouter ────────────────────────────────────────────────────────

const DEFAULT_MODELS: Record<Capability, string> = {
  vision: 'qwen2.5-vl',
  code: 'qwen2.5-coder',
  reason: 'gemma3:12b',
}

const SEMANTIC_THRESHOLD = 0.62

export class CapabilityRouterImpl implements ICapabilityRouter {
  private registry = new Map<Capability, CapabilityModelEntry>()
  private exemplarBags = new Map<Capability, Map<string, number>[]>()
  private log: RoutingLogEntry[] = []
  private groundedSkills = new Set<string>()

  constructor() {
    for (const [cap, model] of Object.entries(DEFAULT_MODELS)) {
      const c = cap as Capability
      this.registry.set(c, { capability: c, modelName: model, priority: 0 })
    }
    for (const [cap, texts] of Object.entries(DEFAULT_EXEMPLARS)) {
      this.exemplarBags.set(
        cap as Capability,
        texts.map(t => bagOfWords(tokenize(t))),
      )
    }
  }

  registerCapability(entry: CapabilityModelEntry, exemplars?: string[]): void {
    this.registry.set(entry.capability, entry)
    if (exemplars) {
      this.exemplarBags.set(
        entry.capability,
        exemplars.map(t => bagOfWords(tokenize(t))),
      )
    }
  }

  registerGroundedSkill(domain: string): void {
    this.groundedSkills.add(domain.toLowerCase())
  }

  getRegistry(): ReadonlyMap<Capability, CapabilityModelEntry> {
    return this.registry
  }

  getLog(): readonly RoutingLogEntry[] {
    return this.log
  }

  route(query: string, attachments?: AttachmentHint[]): RoutingDecision {
    // Unsafe-fallback guard: check for regulated domain first
    const regulatedDomain = this.detectRegulatedDomain(query)
    if (regulatedDomain && !this.groundedSkills.has(regulatedDomain)) {
      throw new RegulatedDomainError(regulatedDomain)
    }

    // Stage 1: rules pass
    const rulesResult = this.rulesPass(query, attachments)
    if (rulesResult) {
      this.logDecision(query, rulesResult)
      return rulesResult
    }

    // Stage 2: semantic fallback
    const semanticResult = this.semanticPass(query)
    this.logDecision(query, semanticResult)
    return semanticResult
  }

  private detectRegulatedDomain(query: string): string | null {
    for (const pattern of REGULATED_PATTERNS) {
      const match = query.match(pattern)
      if (match) {
        if (/medical|diagnosis|treatment|prescri|dosage|medication|symptom/i.test(match[0])) return 'medical'
        if (/legal\s+(?:advice|opinion|counsel)/i.test(match[0])) return 'legal'
        if (/HIPAA|GDPR|SOC|PCI|FERPA|FDA|SEC/i.test(match[0])) return 'compliance'
        return 'regulated'
      }
    }
    return null
  }

  private rulesPass(query: string, attachments?: AttachmentHint[]): RoutingDecision | null {
    // Image attachment → vision
    if (attachments?.some(a => a.type === 'image' || (a.mimeType && IMAGE_MIMES.test(a.mimeType)))) {
      return this.makeDecision('vision', 1.0, 'rules')
    }

    // Attached documents. Visual layouts (PDF, slides, sheets) outrank source
    // files so a deck full of code snippets still goes to the vision model.
    if (attachments?.length) {
      if (attachments.some(a => this.isVisualDoc(a))) {
        return this.makeDecision('vision', 1.0, 'rules')
      }
      if (attachments.some(a => this.isCodeDoc(a))) {
        return this.makeDecision('code', 1.0, 'rules')
      }
    }

    // Code signals: fences, extensions, stacktraces, keywords
    let codeHits = 0
    for (const pattern of CODE_PATTERNS) {
      if (pattern.test(query)) codeHits++
    }
    if (codeHits >= CODE_KEYWORD_THRESHOLD) {
      return this.makeDecision('code', 1.0, 'rules')
    }
    // Single strong signal (fenced block, stacktrace, or file extension) is enough
    if (codeHits >= 1 && (CODE_PATTERNS[0].test(query) || CODE_PATTERNS[1].test(query) || CODE_PATTERNS[2].test(query))) {
      return this.makeDecision('code', 0.9, 'rules')
    }

    return null
  }

  private isVisualDoc(a: AttachmentHint): boolean {
    return (!!a.mimeType && VISUAL_DOC_MIMES.test(a.mimeType))
      || (!!a.filename && VISUAL_DOC_EXTS.test(a.filename))
  }

  private isCodeDoc(a: AttachmentHint): boolean {
    return (!!a.mimeType && CODE_DOC_MIMES.test(a.mimeType))
      || (!!a.filename && CODE_DOC_EXTS.test(a.filename))
  }

  private semanticPass(query: string): RoutingDecision {
    const queryBag = bagOfWords(tokenize(query))
    let bestCap: Capability = 'reason'
    let bestScore = 0

    for (const [cap, bags] of this.exemplarBags) {
      for (const bag of bags) {
        const score = cosineSimilarity(queryBag, bag)
        if (score > bestScore) {
          bestScore = score
          bestCap = cap
        }
      }
    }

    if (bestScore >= SEMANTIC_THRESHOLD) {
      return this.makeDecision(bestCap, bestScore, 'semantic')
    }

    return this.makeDecision('reason', bestScore, 'default')
  }

  private makeDecision(capability: Capability, score: number, method: RoutingDecision['method']): RoutingDecision {
    const entry = this.registry.get(capability)!
    return {
      capability,
      modelName: entry.modelName,
      score,
      method,
      timestamp: Date.now(),
    }
  }

  private logDecision(query: string, decision: RoutingDecision): void {
    this.log.push({ ...decision, query, outcome: 'pending' })
    if (this.log.length > 10_000) this.log.splice(0, this.log.length - 5_000)
  }

  recordOutcome(timestamp: number, outcome: 'success' | 'failure'): void {
    const entry = this.log.find(e => e.timestamp === timestamp)
    if (entry) entry.outcome = outcome
  }
}

export const capabilityRouter = new CapabilityRouterImpl()
