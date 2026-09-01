// AIrIA — model download store
//
// Downloads outlive the views that start them. The settings panel lives inside a
// Modal, and React Native unmounts modal children when it closes, so state held
// there disappeared the moment the panel was dismissed — the transfer kept
// running with nowhere to report, and reopening showed "Download" again.
//
// Ownership therefore sits here, in module scope, and views subscribe. Starting
// a download is idempotent, so the settings panel and the in-chat fallback
// prompt cannot race each other into downloading the same model twice.

import { getNativeAppBridge } from '@airia/service'

export type DownloadPhase = 'idle' | 'downloading' | 'ready' | 'error'

export interface DownloadState {
  phase: DownloadPhase
  /** 0–1, as reported by the transfer. */
  progress: number
  /** Human-readable progress, e.g. "412 / 1930 MB". */
  detail: string
  error?: string
}

const IDLE: DownloadState = { phase: 'idle', progress: 0, detail: '' }

let states: Record<string, DownloadState> = {}
const inFlight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function emit(): void {
  // Replace the map so useSyncExternalStore sees a new reference.
  states = { ...states }
  for (const l of listeners) l()
}

function set(modelId: string, patch: Partial<DownloadState>): void {
  states[modelId] = { ...(states[modelId] ?? IDLE), ...patch }
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSnapshot(): Record<string, DownloadState> {
  return states
}

export function getDownloadState(modelId: string): DownloadState {
  return states[modelId] ?? IDLE
}

export function isDownloading(modelId: string): boolean {
  return inFlight.has(modelId)
}

/** Marks a model as already present, so a freshly mounted view shows the truth. */
export function markReady(modelId: string): void {
  if (states[modelId]?.phase === 'downloading') return
  set(modelId, { phase: 'ready', progress: 1, detail: '' })
}

/**
 * Starts a download, or joins the one already running for this model.
 * Never rejects — failure is reported through the store so every subscriber
 * sees the same reason.
 */
export function startDownload(modelId: string): Promise<void> {
  const existing = inFlight.get(modelId)
  if (existing) return existing

  set(modelId, { phase: 'downloading', progress: 0, detail: 'Starting…', error: undefined })

  const task = getNativeAppBridge()
    .downloadModel(modelId, (progress, detail) => {
      set(modelId, { phase: 'downloading', progress, detail })
    })
    .then(() => {
      set(modelId, { phase: 'ready', progress: 1, detail: '' })
    })
    .catch((err: unknown) => {
      console.error(`Download failed for ${modelId}:`, err)
      set(modelId, {
        phase: 'error',
        progress: 0,
        detail: '',
        error: err instanceof Error ? err.message : String(err),
      })
    })
    .finally(() => {
      inFlight.delete(modelId)
    })

  inFlight.set(modelId, task)
  return task
}
