// AIrIA — ChatView
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '../hooks/useChat'
import { useMetrics } from '../context/MetricsContext'
import {
  tierRouter,
  LocalTrainer,
  MIN_PAIRS_THRESHOLD,
  onDeviceClient,
  WebGPUUnavailableError,
} from '@airia/service'
import type { Tier, FeedbackSignalType } from '@airia/types'
import type { TrainingProgress } from '@airia/service'
import { OrbAvatar } from '../components/index'
import { ModelDownloadOverlay } from '../components/ModelDownloadOverlay'
import { MetricsDashboard } from '../components/MetricsDashboard'
import { getFeedbackCount } from '@airia/db'

interface ChatViewProps {
  theme: string
  onThemeChange: (theme: string) => void
}

const THEMES = ['dawn', 'midnight', 'forest', 'ocean', 'rose', 'slate']

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function ChatView({ theme, onThemeChange }: ChatViewProps) {
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem('airia:last_conversation_id') ?? generateConversationId()
  )
  const [tier, setTier] = useState<Tier>('free')
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modelDownloading, setModelDownloading] = useState(false)
  const [modelRestarting, setModelRestarting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadText, setDownloadText] = useState('')
  const [initError, setInitError] = useState<string | null>(null)
  // Track whether model was ever successfully downloaded this session
  const modelReadyRef = useRef(false)
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [trainingMessage, setTrainingMessage] = useState('')
  const [trustLevel, setTrustLevel] = useState<0 | 1 | 2 | 3>(0)
  const [customEndpoint, setCustomEndpoint] = useState(
    () => tierRouter.getCustomOllamaEndpoint()
  )
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { bumpMetrics } = useMetrics()
  const {
    messages, isStreaming, streamingContent, sendMessage, cancelStream,
    conversations, loadConversation, error, dismissError, recordFeedback, retryMessage,
  } = useChat({ conversationId, tier, onMetricStored: bumpMetrics })

  const initOnDevice = useCallback(async (silent = false) => {
    if (onDeviceClient.isInitialized()) return

    if (silent) {
      setModelRestarting(true)
    } else {
      setModelDownloading(true)
    }
    onDeviceClient.setProgressCallback(p => {
      setDownloadProgress(p.progress)
      setDownloadText(p.text)
    })
    try {
      await onDeviceClient.initialize()
      modelReadyRef.current = true
      setInitError(null)
    } catch (err) {
      console.error('On-device init failed:', err)
      onDeviceClient.reset()
      const fallbackEndpoint = tierRouter.getCustomOllamaEndpoint()
      if (fallbackEndpoint) {
        const fallbackConfig = await tierRouter.setCustomOllamaEndpoint(fallbackEndpoint)
        setTier(fallbackConfig.tier)
      } else {
        await tierRouter.switchTier('free')
        setTier('free')
      }
      setInitError(
        err instanceof WebGPUUnavailableError
          ? 'On-device AI is disabled on this browser because WebLLM is not reliable here. Enter an HTTPS Ollama endpoint in Settings when using AIrIA through ngrok.'
          : 'On-device AI failed to start. Enter your Mac\'s Ollama address in Settings → Ollama Endpoint to use AIrIA over your local network.'
      )
    } finally {
      setModelDownloading(false)
      setModelRestarting(false)
    }
  }, [])

  useEffect(() => {
    const config = tierRouter.getCurrent()
    setTier(config.tier)
    if (config.tier === 'on-device') void initOnDevice(false)
  }, [initOnDevice])

  // A mobile browser may discard the WebLLM engine when backgrounded.
  useEffect(() => {
    if (tier !== 'on-device') return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !onDeviceClient.isInitialized()) {
        // Reset stuck promise so initialize() can run again
        onDeviceClient.reset()
        setInitError(null)
        // Only show full overlay if model was never downloaded; otherwise silent restart
        void initOnDevice(!modelReadyRef.current ? false : true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [initOnDevice, tier])

  // Update trust level based on conversation count
  useEffect(() => {
    const count = conversations.length
    if (count >= 10) setTrustLevel(3)
    else if (count >= 5) setTrustLevel(2)
    else if (count >= 1) setTrustLevel(1)
    else setTrustLevel(0)
  }, [conversations.length])

  useEffect(() => {
    getFeedbackCount().then(setFeedbackCount).catch(console.error)
  }, [messages])  // refresh after each message

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleTrain = async () => {
    if (trainingStatus === 'running') return
    const trainer = new LocalTrainer()
    const reachable = await trainer.isServerReachable()
    if (!reachable) {
      setTrainingStatus('error')
      setTrainingMessage('Training server not running. Start it with: python scripts/training_server.py')
      return
    }
    setTrainingStatus('running')
    try {
      await trainer.run((p: TrainingProgress) => {
        setTrainingProgress(p.progress)
        setTrainingMessage(p.message)
        if (p.status === 'done') setTrainingStatus('done')
        else if (p.status === 'error' || p.status === 'rolled_back') setTrainingStatus('error')
      })
    } catch {
      setTrainingStatus('error')
    }
  }

  const handleSend = async () => {
    const content = inputRef.current?.value.trim()
    if (!content || isStreaming || modelRestarting) return
    if (inputRef.current) inputRef.current.value = ''
    await sendMessage(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFeedback = async (messageId: string, signal: FeedbackSignalType) => {
    const msg = messages.find(m => m.id === messageId)
    if (!msg) return

    if (signal === 'retry') {
      await retryMessage(messageId)
      return
    }

    if (signal === 'copy') {
      await navigator.clipboard.writeText(msg.content).catch(() => {})
    }

    await recordFeedback(messageId, signal, msg.content)
  }

  const handleEndpointSave = async (endpoint: string) => {
    try {
      const config = await tierRouter.setCustomOllamaEndpoint(endpoint)
      setCustomEndpoint(tierRouter.getCustomOllamaEndpoint())
      setTier(config.tier)
      setEndpointError(null)
      setInitError(null)
      if (config.tier === 'on-device') void initOnDevice(false)
    } catch (err) {
      setEndpointError((err as Error).message)
    }
  }

  const startNewConversation = () => {
    const newId = generateConversationId()
    localStorage.setItem('airia:last_conversation_id', newId)
    setConversationId(newId)
  }

  const currentConv = conversations.find(c => c.id === conversationId)

  return (
    <div className="app-layout">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-top">
          <div className="wordmark">air<span className="wordmark-accent">IA</span></div>
          <button className="new-chat-btn" onClick={() => { startNewConversation(); setSidebarOpen(false) }} aria-label="New conversation">
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
                setSidebarOpen(false)
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
      <main className="chat-main" aria-busy={modelDownloading}>
        {/* Header */}
        <header className="chat-header">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(s => !s)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >☰</button>
          <div className="chat-header-center">
            <div className="chat-title">{currentConv?.title ?? 'New conversation'}</div>
            <div className="chat-meta">{currentConv?.modelVersion ?? tierRouter.getCurrent().modelName}</div>
          </div>
          <OrbAvatar trustLevel={trustLevel} animating={isStreaming} size={32} />
        </header>

        {/* On-device model download */}
        {modelDownloading && (
          <ModelDownloadOverlay
            progress={downloadProgress}
            text={downloadText}
            modelId={tierRouter.getCurrent().modelName}
          />
        )}

        {/* Messages */}
        {!modelDownloading && <div className="messages-area" role="log" aria-live="polite" aria-label="Conversation">
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
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : <p>{msg.content}</p>}
              </div>
              {msg.role === 'user' && (
                <div className="user-avatar" aria-label="You">N</div>
              )}
              {msg.role === 'assistant' && (
                <div className="feedback-row" role="group" aria-label="Rate response">
                  {(['thumb_up', 'thumb_down', 'retry', 'copy'] as FeedbackSignalType[]).map(signal => {
                    const voted = msg.feedbackSignal === 'thumb_up' || msg.feedbackSignal === 'thumb_down'
                    const isVoteBtn = signal === 'thumb_up' || signal === 'thumb_down'
                    const isActive = msg.feedbackSignal === signal
                    // Lock thumb buttons after one vote; retry and copy always available
                    if (isVoteBtn && voted && !isActive) return null
                    return (
                      <button
                        key={signal}
                        className={`feedback-btn${isActive ? ' feedback-btn--active' : ''}`}
                        onClick={() => { if (!isActive) void handleFeedback(msg.id, signal) }}
                        disabled={isActive}
                        aria-label={signal.replace('_', ' ')}
                        aria-pressed={isActive}
                      >
                        {signal === 'thumb_up' ? '↑' : signal === 'thumb_down' ? '↓' : signal === 'retry' ? '↺' : '⧉'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {isStreaming && (
            <div className="message-row message-row--assistant">
              <OrbAvatar trustLevel={trustLevel} animating size={28} />
              <div className="bubble bubble--assistant bubble--streaming">
                {streamingContent
                  ? <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  : <p><span className="typing-dots"><span /><span /><span /></span></p>}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>}

        {/* Input */}
        {!modelDownloading && <div className="input-area">
          {modelRestarting && (
            <div className="chat-error" role="status" style={{ opacity: 0.7 }}>
              <span>⟳ Restarting AI engine…</span>
            </div>
          )}
          {(error || initError) && (
            <div className="chat-error" role="alert">
              <span>{initError ?? error}</span>
              <button onClick={initError ? () => setInitError(null) : dismissError} aria-label="Dismiss error">✕</button>
            </div>
          )}
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
        </div>}
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
                  className={`theme-swatch theme-swatch--${t}${theme === t ? ' theme-swatch--active' : ''}`}
                  onClick={() => onThemeChange(t)}
                  aria-label={t}
                  aria-pressed={theme === t}
                >
                  <div className="theme-swatch__color" />
                  <span className="theme-swatch__label">{t}</span>
                </button>
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
          <div className="settings-section">
            <div className="settings-label">OLLAMA ENDPOINT</div>
            <p className="settings-hint">
              {window.location.protocol === 'https:'
                ? 'This page is HTTPS. Use an HTTPS Ollama endpoint (for example, a separate ngrok tunnel to port 11434).'
                : 'Point to your Mac running Ollama on the same WiFi.'}
            </p>
            <div className="endpoint-row">
              <input
                className="endpoint-input"
                type="url"
                placeholder={window.location.protocol === 'https:'
                  ? 'https://your-ollama-tunnel.ngrok.app'
                  : 'http://192.168.x.x:11434'}
                value={customEndpoint}
                onChange={e => setCustomEndpoint(e.target.value)}
                onBlur={() => {
                  if (customEndpoint !== tierRouter.getCustomOllamaEndpoint()) {
                    void handleEndpointSave(customEndpoint)
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                aria-invalid={endpointError !== null}
              />
              {customEndpoint && (
                <button
                  className="endpoint-clear"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setCustomEndpoint('')
                    void handleEndpointSave('')
                  }}
                  aria-label="Clear Ollama endpoint"
                >✕</button>
              )}
            </div>
            {endpointError && <p className="settings-error" role="alert">{endpointError}</p>}
          </div>
          <div className="settings-section">
            <div className="settings-label">TRAINING</div>
            <div className="training-stat">
              <span className="training-stat-label">Feedback signals</span>
              <span className={`training-stat-value ${feedbackCount >= MIN_PAIRS_THRESHOLD ? 'training-ready' : ''}`}>
                {feedbackCount} / {MIN_PAIRS_THRESHOLD}
              </span>
            </div>
            {trainingStatus === 'idle' && (
              <button
                className="train-btn"
                disabled={feedbackCount < MIN_PAIRS_THRESHOLD || tier === 'free'}
                onClick={() => { void handleTrain() }}
              >
                {feedbackCount < MIN_PAIRS_THRESHOLD ? `Need ${MIN_PAIRS_THRESHOLD - feedbackCount} more signals` : 'Fine-tune AIrIA'}
              </button>
            )}
            {trainingStatus === 'running' && (
              <div className="training-progress">
                <div className="training-progress-bar-wrap">
                  <div className="training-progress-bar" style={{ width: `${trainingProgress * 100}%` }} />
                </div>
                <p className="training-progress-msg">{trainingMessage}</p>
              </div>
            )}
            {trainingStatus === 'done' && (
              <p className="training-done">✓ Model updated</p>
            )}
            {trainingStatus === 'error' && (
              <p className="training-error">{trainingMessage}</p>
            )}
            {tier === 'free' && (
              <p className="training-hint">Fine-tuning requires Local or Cloud tier</p>
            )}
          </div>
          <div className="settings-section">
            <div className="settings-label">METRICS</div>
            <MetricsDashboard />
          </div>
        </aside>
      )}
    </div>
  )
}
