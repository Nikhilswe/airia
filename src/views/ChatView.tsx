// AIrIA — ChatView
import { useState, useEffect, useRef } from 'react'
import { useChat } from '../hooks/useChat'
import { tierRouter } from '../services/TierRouter'
import type { Tier, FeedbackSignalType } from '../types/core'
import { OrbAvatar } from '../components/index'

interface ChatViewProps {
  theme: string
  onThemeChange: (theme: string) => void
}

const THEMES = ['dawn', 'midnight', 'forest', 'ocean', 'rose', 'slate']

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function ChatView({ theme, onThemeChange }: ChatViewProps) {
  const [conversationId, setConversationId] = useState(() => generateConversationId())
  const [tier, setTier] = useState<Tier>('free')
  const [showSettings, setShowSettings] = useState(false)
  const [trustLevel, setTrustLevel] = useState<0 | 1 | 2 | 3>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, isStreaming, streamingContent, sendMessage, cancelStream, conversations, loadConversation } =
    useChat({ conversationId, tier })

  useEffect(() => {
    setTier(tierRouter.getCurrent().tier)
  }, [])

  // Update trust level based on conversation count
  useEffect(() => {
    const count = conversations.length
    if (count >= 10) setTrustLevel(3)
    else if (count >= 5) setTrustLevel(2)
    else if (count >= 1) setTrustLevel(1)
    else setTrustLevel(0)
  }, [conversations.length])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const content = inputRef.current?.value.trim()
    if (!content || isStreaming) return
    if (inputRef.current) inputRef.current.value = ''
    await sendMessage(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFeedback = (_messageId: string, _signal: FeedbackSignalType) => {
    // Wired in Phase 2
  }

  const startNewConversation = () => {
    setConversationId(generateConversationId())
  }

  const currentConv = conversations.find(c => c.id === conversationId)

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="wordmark">air<span className="wordmark-accent">IA</span></div>
          <button className="new-chat-btn" onClick={startNewConversation} aria-label="New conversation">
            + New conversation
          </button>
        </div>

        <div className="conv-list">
          <div className="conv-section-label">Recent</div>
          {conversations.map(conv => (
            <button
              key={conv.id}
              className={`conv-item ${conv.id === conversationId ? 'conv-item--active' : ''}`}
              onClick={() => {
                setConversationId(conv.id)
                loadConversation(conv.id)
              }}
            >
              {conv.title}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="tier-pill">
            {tier === 'local' ? '⬡' : tier === 'cloud' ? '☁' : '✦'} {tier}
          </div>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(s => !s)}
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <div>
            <div className="chat-title">{currentConv?.title ?? 'New conversation'}</div>
            <div className="chat-meta">{currentConv?.modelVersion ?? tierRouter.getCurrent().modelName}</div>
          </div>
          <OrbAvatar trustLevel={trustLevel} animating={isStreaming} size={32} />
        </header>

        {/* Messages */}
        <div className="messages-area" role="log" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && !isStreaming && (
            <div className="empty-state">
              <div className="empty-orb">✦</div>
              <p className="empty-greeting">What's on your mind?</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`message-row message-row--${msg.role}`}>
              {msg.role === 'assistant' && (
                <OrbAvatar trustLevel={trustLevel} size={28} />
              )}
              <div className={`bubble bubble--${msg.role}`}>
                <p>{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="user-avatar" aria-label="You">N</div>
              )}
              {msg.role === 'assistant' && (
                <div className="feedback-row" role="group" aria-label="Rate response">
                  {(['thumb_up', 'thumb_down', 'retry', 'copy'] as FeedbackSignalType[]).map(signal => (
                    <button
                      key={signal}
                      className="feedback-btn"
                      onClick={() => handleFeedback(msg.id, signal)}
                      aria-label={signal.replace('_', ' ')}
                    >
                      {signal === 'thumb_up' ? '↑' : signal === 'thumb_down' ? '↓' : signal === 'retry' ? '↺' : '⧉'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {isStreaming && (
            <div className="message-row message-row--assistant">
              <OrbAvatar trustLevel={trustLevel} animating size={28} />
              <div className="bubble bubble--assistant bubble--streaming">
                <p>{streamingContent || <span className="typing-dots"><span /><span /><span /></span>}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrap">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Reply to AIrIA…"
              rows={1}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              aria-label="Message input"
            />
            {isStreaming ? (
              <button className="send-btn send-btn--cancel" onClick={cancelStream} aria-label="Cancel">
                ■
              </button>
            ) : (
              <button className="send-btn" onClick={handleSend} aria-label="Send">
                ↑
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Settings panel */}
      {showSettings && (
        <aside className="settings-panel" aria-label="Settings">
          <div className="settings-header">
            <span>Settings</span>
            <button onClick={() => setShowSettings(false)} aria-label="Close settings">✕</button>
          </div>
          <div className="settings-section">
            <div className="settings-label">THEME</div>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t}
                  className={`theme-swatch theme-swatch--${t} ${theme === t ? 'theme-swatch--active' : ''}`}
                  onClick={() => onThemeChange(t)}
                  aria-label={t}
                  aria-pressed={theme === t}
                />
              ))}
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-label">TIER</div>
            <div className="tier-info">
              <span className="tier-name">{tier}</span>
              <span className="tier-status">active</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
