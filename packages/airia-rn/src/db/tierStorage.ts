// AIrIA — RN KVStorage adapter for TierRouter
// TierRouter's KVStorage interface is synchronous (mirrors localStorage), but
// rnDb's settings store is file-backed and async. This adapter keeps an
// in-memory mirror for sync reads/writes and persists through to rnDb, so
// tier/endpoint config survives app restarts (previously lost every relaunch
// via TierRouter's InMemoryStorage fallback on RN).

import type { KVStorage } from '@airia/service'
import { getSetting, setSetting } from './rnDb'

const PREFIX = 'tier:'

export async function createTierStorage(): Promise<KVStorage> {
  const cache = new Map<string, string>()

  for (const key of ['airia:tier_config', 'airia:custom_endpoint']) {
    const value = await getSetting(PREFIX + key)
    if (value !== null) cache.set(key, value)
  }

  // Clear any stored endpoint pointing at the wrong Ollama port (11431 vs 11434).
  // Safe to run on every startup — only fires when the bad value is present.
  const storedEndpoint = cache.get('airia:custom_endpoint') ?? ''
  if (storedEndpoint && !storedEndpoint.endsWith(':11434')) {
    const fixedUrl = storedEndpoint.replace(/:(\d+)$/, ':11434')
    try {
      new URL(fixedUrl) // validate before storing
      cache.set('airia:custom_endpoint', fixedUrl)
      await setSetting(PREFIX + 'airia:custom_endpoint', fixedUrl)
    } catch {
      // Corrupt value — remove it so detect() re-probes cleanly
      cache.delete('airia:custom_endpoint')
      await setSetting(PREFIX + 'airia:custom_endpoint', '')
    }
  }

  return {
    getItem(key: string): string | null {
      return cache.has(key) ? cache.get(key)! : null
    },
    setItem(key: string, value: string): void {
      cache.set(key, value)
      setSetting(PREFIX + key, value).catch(console.error)
    },
    removeItem(key: string): void {
      cache.delete(key)
      setSetting(PREFIX + key, '').catch(console.error)
    },
  }
}
