// AIrIA — TierRouter
// CTO-owned. Detects tier from config/env and exposes a stable TierConfig.

import { timeoutSignal } from './timeoutSignal'
import type { Tier, TierConfig, TierRouter as ITierRouter, DeviceClass } from '@airia/types'
import { canUseWebLLM } from './WebGPU'

// Ordered by preference — first match wins when probing available models
const MODEL_PRIORITY = ['gemma3:12b', 'gemma3:4b', 'gemma3:1b', 'llama3.2:3b', 'llama3:8b']

const DEFAULTS: Record<Tier, Omit<TierConfig, 'authToken' | 'deviceClass'>> = {
  local: {
    tier: 'local',
    ollamaEndpoint: 'http://localhost:11434',
    trainingEnabled: true,
    updateChannelEnabled: false,
    modelName: 'gemma3:12b',
  },
  cloud: {
    tier: 'cloud',
    ollamaEndpoint: '',
    trainingEnabled: true,
    updateChannelEnabled: false,
    modelName: 'gemma3:12b',
  },
  free: {
    tier: 'free',
    ollamaEndpoint: '',
    trainingEnabled: false,
    updateChannelEnabled: true,
    modelName: 'gemma3:12b',
  },
  'on-device': {
    tier: 'on-device',
    ollamaEndpoint: '',   // no server — inference runs in-browser via WebLLM
    trainingEnabled: false,
    updateChannelEnabled: true,
    modelName: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  },
}

function detectDeviceClass(): DeviceClass {
  if (typeof navigator === 'undefined') return 'desktop'
  // React Native / Hermes: navigator.product is 'ReactNative' and userAgent
  // is undefined — always a mobile device.
  if ((navigator as Navigator & { product?: string }).product === 'ReactNative') return 'mobile'
  const ua = navigator.userAgent ?? ''
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  // navigator.deviceMemory is non-standard but widely supported on Chrome/Android
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem !== undefined && mem <= 2) return 'low-memory'
  if (isMobile) return 'mobile'
  return 'desktop'
}

const CONFIG_KEY = 'airia:tier_config'
export const CUSTOM_OLLAMA_ENDPOINT_KEY = 'airia:custom_endpoint'

type OnDeviceCapabilityCheck = () => Promise<boolean>

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim()
  if (!trimmed) return ''

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid Ollama URL, for example http://192.168.1.10:11434')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Ollama endpoint must use http:// or https://')
  }

  return url.toString().replace(/\/$/, '')
}

export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class InMemoryStorage implements KVStorage {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }
}

export class LocalStorage implements KVStorage {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value)
  }

  removeItem(key: string): void {
    localStorage.removeItem(key)
  }
}

function defaultStorage(): KVStorage {
  return typeof localStorage !== 'undefined' ? new LocalStorage() : new InMemoryStorage()
}

export class TierRouterImpl implements ITierRouter {
  private current: TierConfig | null = null
  private storage: KVStorage
  private onDeviceAvailable: OnDeviceCapabilityCheck

  constructor(storage?: KVStorage, onDeviceAvailable: OnDeviceCapabilityCheck = canUseWebLLM) {
    this.storage = storage ?? defaultStorage()
    this.onDeviceAvailable = onDeviceAvailable
  }

  // Platforms without a synchronous storage API (React Native) hydrate a
  // KVStorage from disk at startup and swap it in before the first detect()
  // call. Invalidates any in-memory config so it's re-read from the new store.
  setStorage(storage: KVStorage): void {
    this.storage = storage
    this.current = null
  }

  // RN swaps in a llama.rn-backed capability check; the default (canUseWebLLM)
  // only makes sense on web.
  setOnDeviceCheck(check: OnDeviceCapabilityCheck): void {
    this.onDeviceAvailable = check
    this.current = null
  }

  async detect(): Promise<TierConfig> {
    const deviceClass = detectDeviceClass()

    // 1. Mobile/low-memory devices always run on-device when the native
    //    runtime is available — this overrides custom endpoints and stored
    //    configs (those are desktop/dev concerns).
    if (
      (deviceClass === 'mobile' || deviceClass === 'low-memory') &&
      await this.onDeviceAvailable()
    ) {
      this.current = { ...this.buildConfig('on-device'), deviceClass }
      this.persist(this.current)
      return this.current
    }

    // 2. A user-supplied endpoint is an explicit backend choice and takes
    //    priority over automatic localhost/WebGPU detection.
    const customEndpoint = this.getCustomOllamaEndpoint()
    if (customEndpoint) {
      const { reachable, models } = await this.probeOllama(customEndpoint)
      const modelName = reachable ? this.pickModel(models) : DEFAULTS.local.modelName
      this.current = this.buildConfig('local', { ollamaEndpoint: customEndpoint, modelName })
      this.persist(this.current)
      return this.current
    }

    // 3. Check storage (persisted user choice) — but only honour it if the
    //    device class hasn't changed (e.g. desktop config must not run on mobile).
    const stored = this.storage.getItem(CONFIG_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TierConfig
        const storedClass = parsed.deviceClass ?? 'desktop'
        const classChanged =
          (deviceClass === 'mobile' || deviceClass === 'low-memory') &&
          storedClass === 'desktop'
        const onDeviceUsable = parsed.tier !== 'on-device' || await this.onDeviceAvailable()
        if (!classChanged && onDeviceUsable) {
          this.current = { ...parsed, deviceClass }
          return this.current
        }
        // Device context changed — re-detect from scratch
        this.storage.removeItem(CONFIG_KEY)
      } catch {
        this.storage.removeItem(CONFIG_KEY)
      }
    }

    // 4. Check environment variable — Vite sets import.meta.env on web; in React
    //    Native / Hermes import.meta is undefined so we skip this safely.
    const viteEnv = typeof (globalThis as Record<string, unknown>).__VITE_AIRIA_TIER__ === 'string'
      ? (globalThis as Record<string, unknown>).__VITE_AIRIA_TIER__ as string
      : ''
    if (['local', 'cloud', 'free'].includes(viteEnv)) {
      this.current = { ...this.buildConfig(viteEnv as Tier), deviceClass }
      return this.current
    }

    // 5. Desktop / web — probe Ollama, fall back to free.
    const { reachable, models } = await this.probeOllama('http://localhost:11434')
    let tier: Tier
    if (reachable) {
      tier = 'local'
    } else {
      tier = 'free'
    }
    const modelName = reachable ? this.pickModel(models) : DEFAULTS[tier].modelName
    this.current = { ...this.buildConfig(tier), modelName, deviceClass }
    this.persist(this.current)
    return this.current
  }

  getCurrent(): TierConfig {
    if (!this.current) throw new Error('TierRouter: detect() must be called before getCurrent()')
    return this.current
  }

  async switchTier(tier: Tier, overrides?: Partial<TierConfig>): Promise<void> {
    const base = this.buildConfig(tier)
    this.current = { ...base, ...overrides }
    this.persist(this.current)
  }

  getCustomOllamaEndpoint(): string {
    const stored = this.storage.getItem(CUSTOM_OLLAMA_ENDPOINT_KEY)
    if (!stored) return ''

    try {
      return normalizeEndpoint(stored)
    } catch {
      this.storage.removeItem(CUSTOM_OLLAMA_ENDPOINT_KEY)
      return ''
    }
  }

  async setCustomOllamaEndpoint(endpoint: string): Promise<TierConfig> {
    const normalized = normalizeEndpoint(endpoint)

    if (!normalized) {
      this.storage.removeItem(CUSTOM_OLLAMA_ENDPOINT_KEY)
      this.storage.removeItem(CONFIG_KEY)
      this.current = null
      return this.detect()
    }

    this.storage.setItem(CUSTOM_OLLAMA_ENDPOINT_KEY, normalized)
    const { reachable, models } = await this.probeOllama(normalized)
    const modelName = reachable
      ? this.pickModel(models)
      : this.current && this.current.tier !== 'on-device'
        ? this.current.modelName
        : DEFAULTS.local.modelName
    this.current = this.buildConfig('local', { ollamaEndpoint: normalized, modelName })
    this.persist(this.current)
    return this.current
  }

  private buildConfig(tier: Tier, overrides?: Partial<TierConfig>): TierConfig {
    return { ...DEFAULTS[tier], deviceClass: detectDeviceClass(), ...overrides }
  }

  private persist(config: TierConfig): void {
    this.storage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  private pickModel(available: string[]): string {
    const match = MODEL_PRIORITY.find(p => available.some(m => m === p || m.startsWith(p + '-')))
    return match ?? MODEL_PRIORITY[0]
  }

  private async probeOllama(endpoint: string): Promise<{ reachable: boolean; models: string[] }> {
    try {
      // 2s is too tight for a cold phone→LAN request (ARP/DNS on first hit);
      // a failed probe silently falls back to a default model that may not be
      // pulled, causing a 404 at chat time.
      const res = await fetch(`${endpoint}/api/tags`, {
        signal: timeoutSignal(8000),
      })
      if (!res.ok) return { reachable: false, models: [] }
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return { reachable: true, models: data.models?.map(m => m.name) ?? [] }
    } catch {
      return { reachable: false, models: [] }
    }
  }
}

export const tierRouter = new TierRouterImpl()
