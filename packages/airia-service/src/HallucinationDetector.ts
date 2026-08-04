// AIrIA — HallucinationDetector
// Fully local, zero inference cost.
// Two signals: uncertainty phrase detection + memory contradiction check.

import type { MemoryEntry } from '@airia/types'

const UNCERTAINTY_PATTERNS = [
  /\bI('m| am) not sure\b/i,
  /\bI think\b/i,
  /\bI believe\b/i,
  /\bI may be (wrong|mistaken|incorrect)\b/i,
  /\bI('m| am) not (certain|confident)\b/i,
  /\bnot (entirely|completely|fully) (sure|certain|accurate)\b/i,
  /\bto (the best of )?my knowledge\b/i,
  /\bI could be wrong\b/i,
  /\bapproximately\b/i,
  /\bI don't have (access to|information about) (real-time|current|up-to-date)\b/i,
]

export function detectUncertainty(response: string): boolean {
  return UNCERTAINTY_PATTERNS.some(p => p.test(response))
}

export function detectContradiction(response: string, memories: MemoryEntry[]): boolean {
  for (const mem of memories) {
    if (mem.confidence < 0.5) continue // low-confidence memories skip
    const value = mem.value.toLowerCase()
    const resp = response.toLowerCase()

    // Simple negation check: if memory says X is true, look for "not X" or "isn't X"
    if (resp.includes(`not ${value}`) || resp.includes(`isn't ${value}`) ||
        resp.includes(`no longer ${value}`) || resp.includes(`never ${value}`)) {
      return true
    }

    // Fact contradiction: if memory key is e.g. "works_at_amazon" and response
    // claims a different employer
    if (mem.category === 'fact' && mem.key.startsWith('works_at_')) {
      const employer = mem.key.replace('works_at_', '').replace(/_/g, ' ')
      // If response mentions "works at X" where X != employer
      const worksAtMatch = resp.match(/works? (?:at|for) ([\w\s]+)/i)
      if (worksAtMatch && !worksAtMatch[1].toLowerCase().includes(employer)) {
        return true
      }
    }
  }
  return false
}
