// AIrIA — useModelSync
// CTO-owned. Polls IndexedDB for completed training jobs.
// When a new success job appears that we haven't seen, fires a sync event
// so the UI can show the SyncOverlay and update TierRouter.

import { useState, useEffect, useRef, useCallback } from 'react'
import { getLatestTrainingJob } from '@airia/db'
import { tierRouter } from '@airia/service'

const POLL_MS = 30_000
const SEEN_KEY = 'airia:last_seen_job'

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

      const lastSeen = localStorage.getItem(SEEN_KEY)
      if (lastSeen === job.id) return  // already shown this one

      // New successful training job — update TierRouter and show overlay
      localStorage.setItem(SEEN_KEY, job.id)
      await tierRouter.switchTier('local', { modelName: job.outputModelVersion })
      setNewModel(job.outputModelVersion)
      setSyncing(true)
    } catch {
      // Non-fatal — sync check failing shouldn't surface to user
    }
  }, [])

  useEffect(() => {
    // Run once on mount (catches jobs that happened while app was closed)
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
