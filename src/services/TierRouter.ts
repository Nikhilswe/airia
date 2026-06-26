// AIrIA — TierRouter
// CTO-owned. Detects tier from config/env and exposes a stable TierConfig.

import type { Tier, TierConfig, TierRouter as ITierRouter } from '../types/core'

const DEFAULTS: Record<Tier, Omit<TierConfig, 'authToken'>> = {
  local: {
    tier: 'local',
    ollamaEndpoint: 'http://localhost:11434',
    trainingEnabled: true,
    updateChannelEnabled: false,
    modelName: 'gemma3:12b',
  },
  cloud: {
    tier: 'cloud',
    ollamaEndpoint: '',  // must be supplied via config
    trainingEnabled: true,
    updateChannelEnabled: false,
    modelName: 'gemma3:12b',
  },
  free: {
    tier: 'free',
    ollamaEndpoint: 'http://localhost:11434',
    trainingEnabled: false,
    updateChannelEnabled: true,
    modelName: 'gemma3:12b',
  },
}

const CONFIG_KEY = 'airia:tier_config'

export class TierRouterImpl implements ITierRouter {
  private current: TierConfig | null = null

  async detect(): Promise<TierConfig> {
    // 1. Check localStorage (persisted user choice)
    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      try {
        this.current = JSON.parse(stored) as TierConfig
        return this.current
      } catch {
        localStorage.removeItem(CONFIG_KEY)
      }
    }

    // 2. Check environment variable (set by PWA manifest / build)
    const envTier = (import.meta.env.VITE_AIRIA_TIER ?? '') as Tier
    if (['local', 'cloud', 'free'].includes(envTier)) {
      this.current = this.buildConfig(envTier)
      return this.current
    }

    // 3. Default: probe Ollama. If reachable → local. Else → free.
    const ollamaReachable = await this.probeOllama('http://localhost:11434')
    const tier: Tier = ollamaReachable ? 'local' : 'free'
    this.current = this.buildConfig(tier)
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

  private buildConfig(tier: Tier, overrides?: Partial<TierConfig>): TierConfig {
    return { ...DEFAULTS[tier], ...overrides }
  }

  private persist(config: TierConfig): void {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  private async probeOllama(endpoint: string): Promise<boolean> {
    try {
      const res = await fetch(`${endpoint}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}

export const tierRouter = new TierRouterImpl()
