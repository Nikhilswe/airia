// AIrIA — useModelSync (React Native)
// Polls IndexedDB for completed training jobs.
// Mirrors the web hook; localStorage replaced with a module-level Map.

import { useState, useEffect, useRef, useCallback } from 'react'
import { getLatestTrainingJob } from '@airia/db'
import { tierRouter } from '@airia/service'

const POLL_MS = 30_000
const seenJobStore = new Map<string, string>()

export interface ModelSyncState {
  syncing: boolean
  newModel: string | null
  dismissSync: () => void
}

export function useModelSync(): ModelSyncState {
  const [syncing, setSyncing] = useState(false)
  const [newModel, setNewModel] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    try {
      const job = await getLatestTrainingJob()
      if (!job || job.status !== 'success' || !job.outputModelVersion) return
      const lastSeen = seenJobStore.get('lastSeenJob') ?? null
      if (lastSeen === job.id) return
      seenJobStore.set('lastSeenJob', job.id)
      await tierRouter.switchTier('local', { modelName: job.outputModelVersion })
      setNewModel(job.outputModelVersion)
      setSyncing(true)
    } catch {
      // Non-fatal
    }
  }, [])

  useEffect(() => {
    void check()
    timerRef.current = setInterval(() => { void check() }, POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [check])

  const dismissSync = useCallback(() => {
    setSyncing(false)
    setNewModel(null)
  }, [])

  return { syncing, newModel, dismissSync }
}
