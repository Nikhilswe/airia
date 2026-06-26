// AIrIA — ContextManager unit tests
// CTO-owned. Tests token budget, truncation, and summary trigger.
import { describe, it, expect } from 'vitest'
import { ContextManager, estimateTokens, estimateMessageTokens } from '../../src/services/ContextManager'
import type { Message } from '../../src/types/core'

function makeMessage(role: 'user' | 'assistant', content: string, i: number): Message {
  return {
    id: `msg_${i}`,
    conversationId: 'conv_test',
    role,
    content,
    timestamp: Date.now() + i * 1000,
  }
}

describe('estimateTokens', () => {
  it('estimates tokens as ceil(chars / 4)', () => {
    expect(estimateTokens('hello')).toBe(2)     // 5/4 = 1.25 → 2
    expect(estimateTokens('hello world')).toBe(3) // 11/4 = 2.75 → 3
    expect(estimateTokens('')).toBe(0)
  })
})

describe('ContextManager', () => {
  describe('buildMessages()', () => {
    it('returns system + history + new message when within budget', () => {
      const cm = new ContextManager({ maxTokens: 8192, reserveForResponse: 1024 })
      const history: Message[] = [
        makeMessage('user', 'Hi there', 0),
        makeMessage('assistant', 'Hello!', 1),
      ]
      const result = cm.buildMessages('You are AIrIA.', history, 'How are you?')

      expect(result[0].role).toBe('system')
      expect(result[0].content).toBe('You are AIrIA.')
      expect(result[result.length - 1].role).toBe('user')
      expect(result[result.length - 1].content).toBe('How are you?')
      expect(result.length).toBe(4) // system + 2 history + new
    })

    it('truncates oldest messages when over budget', () => {
      const cm = new ContextManager({ maxTokens: 500, reserveForResponse: 100 })
      // Budget = 400 tokens
      // Each message of 300 chars ≈ 75 tokens + 4 overhead = 79 tokens
      const longContent = 'a'.repeat(300)
      const history: Message[] = Array.from({ length: 10 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', longContent, i)
      )

      const result = cm.buildMessages('System.', history, 'New message')

      // Should have fewer messages than original history
      expect(result.length).toBeLessThan(history.length + 2)
      // Always starts with system
      expect(result[0].role).toBe('system')
      // Always ends with new user message
      expect(result[result.length - 1].content).toBe('New message')
    })

    it('never drops system prompt or the new user message', () => {
      const cm = new ContextManager({ maxTokens: 200, reserveForResponse: 50 })
      const history: Message[] = Array.from({ length: 20 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(100), i)
      )

      const result = cm.buildMessages('SYSTEM', history, 'FINAL')
      expect(result[0].content).toBe('SYSTEM')
      expect(result[result.length - 1].content).toBe('FINAL')
    })

    it('returns correct message format for Ollama', () => {
      const cm = new ContextManager()
      const result = cm.buildMessages('Sys', [], 'Hello')
      expect(result).toEqual([
        { role: 'system', content: 'Sys' },
        { role: 'user', content: 'Hello' },
      ])
    })
  })

  describe('isNearLimit()', () => {
    it('returns false when well within budget', () => {
      const cm = new ContextManager({ maxTokens: 8192, reserveForResponse: 1024 })
      const history: Message[] = [makeMessage('user', 'hi', 0)]
      expect(cm.isNearLimit('short prompt', history)).toBe(false)
    })

    it('returns true when approaching threshold', () => {
      const cm = new ContextManager({ maxTokens: 500, reserveForResponse: 100, summaryThreshold: 0.5 })
      // Budget = 400, threshold = 200 tokens
      const bigContent = 'a'.repeat(900) // ~225 tokens
      const history: Message[] = [makeMessage('user', bigContent, 0)]
      expect(cm.isNearLimit('', history)).toBe(true)
    })
  })

  describe('buildSummaryRequest()', () => {
    it('returns valid Ollama messages for summarisation', () => {
      const cm = new ContextManager()
      const history: Message[] = [
        makeMessage('user', 'What is React?', 0),
        makeMessage('assistant', 'React is a UI library.', 1),
      ]
      const result = cm.buildSummaryRequest(history)
      expect(result[0].role).toBe('system')
      expect(result[1].role).toBe('user')
      expect(result[1].content).toContain('What is React?')
      expect(result[1].content).toContain('React is a UI library.')
    })
  })
})
