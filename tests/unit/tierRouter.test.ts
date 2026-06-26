// AIrIA — TierRouter unit tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TierRouterImpl } from '../../src/services/TierRouter'

describe('TierRouter', () => {
  let router: TierRouterImpl

  beforeEach(() => {
    router = new TierRouterImpl()
    localStorage.clear()
  })

  it('defaults to free tier when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const config = await router.detect()
    expect(config.tier).toBe('free')
    expect(config.trainingEnabled).toBe(false)
    expect(config.updateChannelEnabled).toBe(true)
  })

  it('defaults to local tier when Ollama is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const config = await router.detect()
    expect(config.tier).toBe('local')
    expect(config.trainingEnabled).toBe(true)
    expect(config.updateChannelEnabled).toBe(false)
  })

  it('reads persisted tier from localStorage', async () => {
    const persisted = {
      tier: 'cloud',
      ollamaEndpoint: 'https://cloud.airia.ai',
      trainingEnabled: true,
      updateChannelEnabled: false,
      modelName: 'gemma3:12b',
      authToken: 'tok_test',
    }
    localStorage.setItem('airia:tier_config', JSON.stringify(persisted))
    const config = await router.detect()
    expect(config.tier).toBe('cloud')
    expect(config.authToken).toBe('tok_test')
  })

  it('switchTier updates current config and persists it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error()))
    await router.detect()
    await router.switchTier('cloud', {
      ollamaEndpoint: 'https://cloud.airia.ai',
      authToken: 'tok_abc',
    })
    const config = router.getCurrent()
    expect(config.tier).toBe('cloud')
    expect(config.ollamaEndpoint).toBe('https://cloud.airia.ai')
  })

  it('throws if getCurrent() called before detect()', () => {
    expect(() => router.getCurrent()).toThrow('detect() must be called before getCurrent()')
  })

  it('cloud tier has trainingEnabled true', async () => {
    await router.switchTier('cloud', { ollamaEndpoint: 'https://cloud.airia.ai' })
    expect(router.getCurrent().trainingEnabled).toBe(true)
  })

  it('free tier has trainingEnabled false', async () => {
    await router.switchTier('free')
    expect(router.getCurrent().trainingEnabled).toBe(false)
    expect(router.getCurrent().updateChannelEnabled).toBe(true)
  })
})
