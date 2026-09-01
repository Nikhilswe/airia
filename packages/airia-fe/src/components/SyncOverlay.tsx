import { useEffect } from 'react'

interface SyncOverlayProps {
  newModel: string
  onDismiss: () => void
}

export default function SyncOverlay({ newModel, onDismiss }: SyncOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="sync-overlay" onClick={onDismiss}>
      <div className="sync-card" onClick={e => e.stopPropagation()}>
        <div className="sync-rings">
          <div className="sync-ring" style={{ animationDelay: '0s' }} />
          <div className="sync-ring" style={{ animationDelay: '0.3s' }} />
          <div className="sync-ring" style={{ animationDelay: '0.6s' }} />
          <div className="sync-orb">✦</div>
        </div>
        <h2 className="sync-title">AIrIA just got smarter</h2>
        <p className="sync-subtitle">Syncing model weights…</p>
        <code className="sync-model">{newModel}</code>
        <div className="sync-progress-wrap">
          <div className="sync-progress-bar" />
        </div>
        <p className="sync-hint">tap to dismiss</p>
      </div>
    </div>
  )
}
