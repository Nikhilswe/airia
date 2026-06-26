// AIrIA — Component shells
// Codex-generated. CTO-reviewed. No business logic — structure only.

import type { Message, FeedbackSignalType, Tier } from '../types/core'

// ─── OrbAvatar ───────────────────────────────────────────────────────────────
// The AIrIA orb — expressiveness scales with trustLevel (0-3)

interface OrbAvatarProps {
  trustLevel: 0 | 1 | 2 | 3
  animating?: boolean
  size?: number
}

export function OrbAvatar({ trustLevel, animating = false, size = 32 }: OrbAvatarProps) {
  const glowSize = trustLevel * 4
  const borderWidth = 0.5 + trustLevel * 0.5
  const pulse = animating && trustLevel >= 2

  return (
    <div
      className="orb-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--orb-bg)',
        border: `${borderWidth}px solid var(--accent-border)`,
        boxShadow: glowSize > 0 ? `0 0 0 ${glowSize}px var(--accent-light)` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        animation: pulse ? 'orb-pulse 2s ease-in-out infinite' : 'none',
        transition: 'box-shadow 0.4s ease, border-width 0.4s ease',
      }}
      aria-label="AIrIA"
    >
      ✦
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  onFeedback: (messageId: string, signal: FeedbackSignalType) => void
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--ai'}`}>
      {!isUser && <OrbAvatar trustLevel={0} size={28} />}
      <div className={`bubble bubble--${message.role}`}>
        <p>{message.content}</p>
      </div>
      {isUser && (
        <div className="avatar avatar--user" aria-label="You">
          N
        </div>
      )}
      {!isUser && (
        <div className="feedback-row" role="group" aria-label="Rate this response">
          {(['thumb_up', 'thumb_down', 'retry', 'copy'] as FeedbackSignalType[]).map(signal => (
            <button
              key={signal}
              className={`feedback-btn ${message.feedbackSignal === signal ? 'feedback-btn--active' : ''}`}
              onClick={() => onFeedback(message.id, signal)}
              aria-label={signal.replace('_', ' ')}
            >
              {signal === 'thumb_up' && '↑'}
              {signal === 'thumb_down' && '↓'}
              {signal === 'retry' && '↺'}
              {signal === 'copy' && '⧉'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── InputBar ────────────────────────────────────────────────────────────────

interface InputBarProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export function InputBar({
  onSend,
  disabled = false,
  placeholder = 'Reply to AIrIA…',
}: InputBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const value = e.currentTarget.value.trim()
      if (value) {
        onSend(value)
        e.currentTarget.value = ''
      }
    }
  }

  return (
    <div className="input-bar">
      <textarea
        className="input-bar__textarea"
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        rows={1}
        aria-label="Message input"
      />
      <button
        className="input-bar__send"
        disabled={disabled}
        onClick={e => {
          const textarea = e.currentTarget
            .closest('.input-bar')
            ?.querySelector('textarea') as HTMLTextAreaElement | null
          if (textarea?.value.trim()) {
            onSend(textarea.value.trim())
            textarea.value = ''
          }
        }}
        aria-label="Send message"
      >
        ↑
      </button>
    </div>
  )
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────

interface ChatWindowProps {
  conversationId: string
  tier: Tier
}

export function ChatWindow({ conversationId, tier: _tier }: ChatWindowProps) {
  // Shell only — logic wired in Phase 1
  return (
    <div className="chat-window" data-conversation={conversationId}>
      <div className="chat-window__messages" role="log" aria-live="polite" aria-label="Messages">
        {/* MessageBubble list rendered here in Phase 1 */}
      </div>
      <div className="chat-window__input">
        <InputBar onSend={() => {}} disabled placeholder="Reply to AIrIA…" />
      </div>
    </div>
  )
}
