// AIrIA — MemoryExtractor
// CTO-owned. Extracts facts, preferences, and patterns from conversations.
// Bad extractions pollute the memory store — quality guardrails are critical here.

import type { MemoryEntry, OllamaClient, OllamaMessage } from '../types/core'

export type RawMemoryEntry = Omit<MemoryEntry, 'id' | 'sourceConversationId'>

// Extraction prompt — instructs model to output strict JSON only
const EXTRACTION_SYSTEM_PROMPT = `You extract personal facts and preferences from conversations.
Output ONLY a JSON array. No preamble, no explanation, no markdown.

Each item must have:
- key: snake_case identifier (e.g. "prefers_concise_answers", "works_at_amazon")  
- value: the extracted value as a string
- confidence: 0.0-1.0 (how certain you are)
- category: one of "preference" | "fact" | "pattern" | "goal"

Rules:
- Only extract things explicitly stated or strongly implied
- Do NOT infer or guess
- Do NOT extract sensitive data (health, finances, relationships unless clearly offered)
- If nothing meaningful to extract, return []
- Maximum 5 entries per call
- Keys must be unique per call

Example output:
[
  {"key":"prefers_bullet_points","value":"true","confidence":0.9,"category":"preference"},
  {"key":"primary_language","value":"Python","confidence":0.8,"category":"fact"}
]`

// Quality guardrails — applied before any entry enters the memory store
function isValidEntry(raw: unknown): raw is RawMemoryEntry {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>

  // Required fields
  if (typeof r.key !== 'string' || r.key.trim().length === 0) return false
  if (typeof r.value !== 'string' || r.value.trim().length === 0) return false
  if (typeof r.confidence !== 'number') return false
  if (!['preference', 'fact', 'pattern', 'goal'].includes(r.category as string)) return false

  // Key format: snake_case only
  if (!/^[a-z][a-z0-9_]{1,49}$/.test(r.key)) return false

  // Confidence range
  if (r.confidence < 0 || r.confidence > 1) return false

  // Minimum confidence threshold — don't store weak guesses
  if (r.confidence < 0.6) return false

  // Value sanity — not too long, not empty after trim
  const value = (r.value as string).trim()
  if (value.length > 200) return false

  // Basic PII detection — reject obvious sensitive patterns
  const piiPatterns = [
    /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
    /\b\+?[\d\s\-().]{10,15}\b/, // phone
  ]
  for (const pattern of piiPatterns) {
    if (pattern.test(value)) return false
  }

  return true
}

export class MemoryExtractor {
  private client: OllamaClient

  constructor(client: OllamaClient) {
    this.client = client
  }

  /**
   * Extract memory entries from a conversation exchange.
   * Called after each AI response completes.
   * Returns validated entries only — invalid ones are silently dropped.
   */
  async extract(
    userMessage: string,
    assistantResponse: string,
    conversationId: string
  ): Promise<Omit<MemoryEntry, 'id'>[]> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `User said: "${userMessage}"\n\nAIrIA responded: "${assistantResponse}"\n\nExtract memory entries:`,
      },
    ]

    let raw: string
    try {
      raw = await this.client.chat(messages, { temperature: 0.1 })
    } catch {
      // Extraction failure is non-fatal — return empty
      return []
    }

    // Parse JSON — strip any accidental markdown fences
    let parsed: unknown[]
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed)) return []
    } catch {
      return []
    }

    // Apply quality guardrails — drop anything that fails validation
    const valid = parsed.filter(isValidEntry) as RawMemoryEntry[]

    // Deduplicate by key within this batch
    const seen = new Set<string>()
    const deduped = valid.filter(e => {
      if (seen.has(e.key)) return false
      seen.add(e.key)
      return true
    })

    return deduped.map(e => ({
      key: e.key,
      value: e.value.trim(),
      confidence: e.confidence,
      category: e.category,
      lastSeen: Date.now(),
      sourceConversationId: conversationId,
    }))
  }
}
