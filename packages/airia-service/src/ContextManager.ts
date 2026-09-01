// AIrIA — ContextManager
// CTO-owned. Do not modify without CTO review.
// Manages token budget for Ollama context window.
// Strategy: keep system prompt + recent messages within budget,
// summarise older messages when limit approached.

import type { OllamaMessage, Message } from '@airia/types'

export interface ContextManagerConfig {
  maxTokens: number        // hard ceiling for the model (default 8192 for Gemma 3)
  reserveForResponse: number // tokens reserved for model response (default 1024)
  summaryThreshold: number   // trigger summary when context > this % of max (default 0.8)
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTokens: 8192,
  reserveForResponse: 2048,  // generous reserve — Gemma cuts off if output budget is too tight
  summaryThreshold: 0.8,
}

// Rough token estimator — 1 token ≈ 4 chars for English text
// Good enough for budget decisions, not billing
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateMessageTokens(msg: OllamaMessage): number {
  // role overhead (~4 tokens) + content
  return 4 + estimateTokens(msg.content)
}

export class ContextManager {
  private config: ContextManagerConfig

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  get budget(): number {
    return this.config.maxTokens - this.config.reserveForResponse
  }

  /**
   * Build the final message array to send to Ollama.
   * Enforces token budget. If over threshold, truncates oldest non-system messages.
   * Never drops the system prompt or the most recent user message.
   */
  buildMessages(
    systemPrompt: string,
    history: Message[],
    newUserMessage: string
  ): OllamaMessage[] {
    const systemMsg: OllamaMessage = { role: 'system', content: systemPrompt }
    const systemTokens = estimateMessageTokens(systemMsg)

    const newMsg: OllamaMessage = { role: 'user', content: newUserMessage }
    const newMsgTokens = estimateMessageTokens(newMsg)

    // Convert history to OllamaMessage format
    const historyMsgs: OllamaMessage[] = history.map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Calculate total tokens
    const historyTokens = historyMsgs.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
    const totalTokens = systemTokens + historyTokens + newMsgTokens

    // If within budget, return as-is
    if (totalTokens <= this.budget) {
      return [systemMsg, ...historyMsgs, newMsg]
    }

    // Over budget — trim oldest messages until we fit
    // Keep: system prompt + at least last 2 exchanges (4 messages) + new message
    const trimmed = [...historyMsgs]
    const minKeep = 4

    while (trimmed.length > minKeep) {
      const currentTotal =
        systemTokens +
        trimmed.reduce((sum, m) => sum + estimateMessageTokens(m), 0) +
        newMsgTokens

      if (currentTotal <= this.budget) break
      trimmed.shift() // drop oldest
    }

    // If still over budget after keeping min messages, truncate the oldest content
    const finalTotal =
      systemTokens +
      trimmed.reduce((sum, m) => sum + estimateMessageTokens(m), 0) +
      newMsgTokens

    if (finalTotal > this.budget && trimmed.length > 0) {
      // Hard truncate oldest message content
      const overflow = finalTotal - this.budget
      const oldest = trimmed[0]
      const charsToRemove = overflow * 4
      trimmed[0] = {
        ...oldest,
        content: '[...truncated]\n' + oldest.content.slice(charsToRemove),
      }
    }

    return [systemMsg, ...trimmed, newMsg]
  }

  /**
   * Returns true if context is approaching the summary threshold.
   * Used to trigger proactive summarisation before hard truncation.
   */
  isNearLimit(systemPrompt: string, history: Message[]): boolean {
    const systemTokens = estimateTokens(systemPrompt)
    const historyTokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0)
    const total = systemTokens + historyTokens
    return total > this.budget * this.config.summaryThreshold
  }

  /**
   * Build a summarisation request to send to Ollama.
   * Returns messages that ask the model to summarise the given history.
   */
  buildSummaryRequest(history: Message[]): OllamaMessage[] {
    const historyText = history
      .map(m => `${m.role === 'user' ? 'User' : 'AIrIA'}: ${m.content}`)
      .join('\n\n')

    return [
      {
        role: 'system',
        content:
          'You are a conversation summariser. Summarise the following conversation ' +
          'concisely, preserving key facts, decisions, and context. ' +
          'Output only the summary, no preamble.',
      },
      {
        role: 'user',
        content: `Summarise this conversation:\n\n${historyText}`,
      },
    ]
  }
}
