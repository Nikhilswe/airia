// AIrIA — Integration test: ContextManager → CapabilityRouter → TierRouter
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CapabilityRouterImpl } from '../../src/CapabilityRouter'
import { ContextManager } from '../../src/ContextManager'
import { TierRouterImpl, InMemoryStorage } from '../../src/TierRouter'
import type { Message } from '@airia/types'

describe('ContextManager → CapabilityRouter → TierRouter integration', () => {
  let capRouter: CapabilityRouterImpl
  let ctxManager: ContextManager
  let tierRouter: TierRouterImpl

  beforeEach(() => {
    capRouter = new CapabilityRouterImpl()
    ctxManager = new ContextManager({ maxTokens: 8192 })
    tierRouter = new TierRouterImpl(new InMemoryStorage(), async () => false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'gemma3:12b' }, { name: 'qwen2.5-coder' }, { name: 'qwen2.5-vl' }] }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function fullPipeline(query: string, history: Message[] = []) {
    const messages = ctxManager.buildMessages('You are AIrIA.', history, query)
    const routing = capRouter.route(query)
    const tierConfig = await tierRouter.detect()
    return { messages, routing, tierConfig }
  }

  it('routes a vision query end-to-end', async () => {
    const result = capRouter.route('describe this image', [{ type: 'image', mimeType: 'image/png' }])
    const tierConfig = await tierRouter.detect()
    expect(result.capability).toBe('vision')
    expect(result.modelName).toBe('qwen2.5-vl')
    expect(tierConfig.tier).toBe('local')
  })

  it('routes a code query end-to-end', async () => {
    const { routing, tierConfig, messages } = await fullPipeline(
      'fix this:\n```ts\nconst x: string = 42\n```'
    )
    expect(routing.capability).toBe('code')
    expect(routing.modelName).toBe('qwen2.5-coder')
    expect(tierConfig.tier).toBe('local')
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  it('routes a reason query end-to-end', async () => {
    const { routing, messages } = await fullPipeline('what are the tradeoffs of event sourcing')
    expect(routing.capability).toBe('reason')
    expect(routing.modelName).toBe('gemma3:12b')
    expect(messages[0].role).toBe('system')
  })

  it('context manager trims history while routing still works', async () => {
    const history: Message[] = Array.from({ length: 50 }, (_, i) => ({
      id: `msg_${i}`,
      conversationId: 'test',
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: 'A'.repeat(500),
      timestamp: Date.now() - (50 - i) * 1000,
    }))
    const { routing, messages } = await fullPipeline('refactor this component', history)
    expect(routing.capability).toBe('code')
    expect(messages.length).toBeLessThan(52)
  })
})
