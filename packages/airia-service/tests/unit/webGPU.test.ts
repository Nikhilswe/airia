import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUseWebLLM, isIOSDevice, isWebGPUAvailable } from '../../src/WebGPU'

describe('isWebGPUAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when the browser does not expose WebGPU', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mobile Safari' })

    await expect(isWebGPUAvailable()).resolves.toBe(false)
  })

  it('returns false when WebGPU cannot acquire an adapter', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue(null) },
    })

    await expect(isWebGPUAvailable()).resolves.toBe(false)
  })

  it('returns false when adapter initialization rejects', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockRejectedValue(new Error('GPU unavailable')) },
    })

    await expect(isWebGPUAvailable()).resolves.toBe(false)
  })

  it('returns true when WebGPU acquires an adapter', async () => {
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    })

    await expect(isWebGPUAvailable()).resolves.toBe(true)
  })

  it('detects iPadOS when it uses a desktop Safari user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      maxTouchPoints: 5,
    })

    expect(isIOSDevice()).toBe(true)
  })

  it('rejects WebLLM on iOS without requesting a WebGPU adapter', async () => {
    const requestAdapter = vi.fn().mockResolvedValue({})
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      gpu: { requestAdapter },
    })

    await expect(canUseWebLLM()).resolves.toBe(false)
    expect(requestAdapter).not.toHaveBeenCalled()
  })

  it('allows WebLLM on a non-iOS browser with a usable adapter', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile',
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    })

    await expect(canUseWebLLM()).resolves.toBe(true)
  })
})
