// AIrIA — TierRouter unit tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TierRouterImpl,
  InMemoryStorage,
  CUSTOM_OLLAMA_ENDPOINT_KEY,
} from '../../src/TierRouter'

describe('TierRouter', () => {
  let router: TierRouterImpl

  beforeEach(() => {
    router = new TierRouterImpl(new InMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to free tier when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const config = await router.detect()
    expect(config.tier).toBe('free')
    expect(config.trainingEnabled).toBe(false)
    expect(config.updateChannelEnabled).toBe(true)
  })

  it('defaults to local tier when Ollama is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'gemma3:12b' }] }),
      })
    )
    const config = await router.detect()
    expect(config.tier).toBe('local')
    expect(config.trainingEnabled).toBe(true)
    expect(config.updateChannelEnabled).toBe(false)
  })

  it('selects best available model from Ollama response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'gemma3:4b' }] }),
      })
    )
    const config = await router.detect()
    expect(config.modelName).toBe('gemma3:4b')
  })

  it('reads persisted tier from storage', async () => {
    const storage = new InMemoryStorage()
    const persisted = {
      tier: 'cloud',
      ollamaEndpoint: 'https://cloud.airia.ai',
      trainingEnabled: true,
      updateChannelEnabled: false,
      modelName: 'gemma3:12b',
      authToken: 'tok_test',
    }
    storage.setItem('airia:tier_config', JSON.stringify(persisted))
    const localRouter = new TierRouterImpl(storage)
    const config = await localRouter.detect()
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

  it('persists config so a new router instance with same storage reads it', async () => {
    const storage = new InMemoryStorage()
    const router1 = new TierRouterImpl(storage)
    await router1.switchTier('cloud', { ollamaEndpoint: 'https://cloud.airia.ai' })

    const router2 = new TierRouterImpl(storage)
    const config = await router2.detect()
    expect(config.tier).toBe('cloud')
    expect(config.ollamaEndpoint).toBe('https://cloud.airia.ai')
  })

  it('uses a custom Ollama endpoint before automatic backend detection', async () => {
    const storage = new InMemoryStorage()
    storage.setItem(CUSTOM_OLLAMA_ENDPOINT_KEY, 'http://192.168.1.20:11434/')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'gemma3:4b' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const customRouter = new TierRouterImpl(storage)
    const config = await customRouter.detect()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.20:11434/api/tags',
      expect.any(Object)
    )
    expect(config.tier).toBe('local')
    expect(config.ollamaEndpoint).toBe('http://192.168.1.20:11434')
    expect(config.modelName).toBe('gemma3:4b')
  })

  it('clears the custom endpoint and removes its persisted route', async () => {
    const storage = new InMemoryStorage()
    const customRouter = new TierRouterImpl(storage)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await customRouter.setCustomOllamaEndpoint('http://192.168.1.20:11434')
    const config = await customRouter.setCustomOllamaEndpoint('')

    expect(storage.getItem(CUSTOM_OLLAMA_ENDPOINT_KEY)).toBeNull()
    expect(config.tier).toBe('free')
    expect(config.ollamaEndpoint).toBe('')
  })

  it('does not select on-device inference on mobile without usable WebGPU', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mobileRouter = new TierRouterImpl(new InMemoryStorage(), async () => false)

    const config = await mobileRouter.detect()

    expect(config.tier).toBe('free')
  })

  it('selects on-device inference on mobile when WebGPU is usable', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mobileRouter = new TierRouterImpl(new InMemoryStorage(), async () => true)

    const config = await mobileRouter.detect()

    expect(config.tier).toBe('on-device')
  })

  it('prefers on-device over a stored custom endpoint on mobile', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mobileRouter = new TierRouterImpl(new InMemoryStorage(), async () => true)
    await mobileRouter.setCustomOllamaEndpoint('http://192.168.1.5:11434')

    const config = await mobileRouter.detect()

    expect(config.tier).toBe('on-device')
  })

  it('classifies React Native (no userAgent) as a mobile device', async () => {
    vi.stubGlobal('navigator', { product: 'ReactNative' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const rnRouter = new TierRouterImpl(new InMemoryStorage(), async () => true)

    const config = await rnRouter.detect()

    expect(config.tier).toBe('on-device')
  })

  it('does not select WebLLM on iOS even when Safari returns a WebGPU adapter', async () => {
    const requestAdapter = vi.fn().mockResolvedValue({})
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      gpu: { requestAdapter },
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mobileRouter = new TierRouterImpl(new InMemoryStorage())

    const config = await mobileRouter.detect()

    expect(config.tier).toBe('free')
    expect(requestAdapter).not.toHaveBeenCalled()
  })

  it('replaces a persisted on-device route on iOS', async () => {
    const storage = new InMemoryStorage()
    storage.setItem('airia:tier_config', JSON.stringify({
      tier: 'on-device',
      ollamaEndpoint: '',
      trainingEnabled: false,
      updateChannelEnabled: true,
      modelName: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      deviceClass: 'mobile',
    }))
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const config = await new TierRouterImpl(storage).detect()

    expect(config.tier).toBe('free')
    expect(JSON.parse(storage.getItem('airia:tier_config')!).tier).toBe('free')
  })
})
