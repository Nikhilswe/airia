// AIrIA — useChat hook
// Wires OllamaClient + ContextManager + MemoryRetriever + IndexedDB.
// Codex-generated, CTO-reviewed.

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, Conversation, Tier, FeedbackSignalType } from '@airia/types'
import {
  OllamaClient,
  ContextManager,
  MemoryStore,
  MemoryRetrieverImpl,
  MemoryExtractor,
  tierRouter,
  onDeviceClient,
} from '@airia/service'
import type { OllamaClient as IOllamaClient } from '@airia/types'
import {
  getMessages,
  upsertMessage,
  upsertConversation,
  getConversations,
  storeFeedback,
  storeMetric,
  updateMetricFeedback,
} from '@airia/db'
import { detectUncertainty, detectContradiction } from '@airia/service'
import type { MessageMetric } from '@airia/types'

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const BASE_SYSTEM_PROMPT = `You are AIrIA — a personal AI that gets to know you over time.
You are warm, direct, and concise. You remember what matters.
You are not an assistant. You are more like a trusted friend who happens to know a lot.
Never say "As an AI" or "I'm just a language model". You are AIrIA.`

interface UseChatOptions {
  conversationId: string
  tier: Tier
  onMetricStored?: () => void
}

interface UseChatReturn {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => void
  conversations: Conversation[]
  loadConversation: (id: string) => Promise<void>
  error: string | null
  dismissError: () => void
  recordFeedback: (
    messageId: string,
    signal: FeedbackSignalType,
    chosenContent: string,
    rejectedContent?: string
  ) => Promise<void>
  retryMessage: (messageId: string) => Promise<void>
}

const LAST_CONV_KEY = 'airia:last_conversation_id'

export function useChat({ conversationId, tier, onMetricStored }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Synchronous guard — isStreaming state lags one render behind; this ref closes the race window
  const inFlightRef = useRef(false)

  const contextManager = useRef(new ContextManager()).current
  const memoryStore = useRef(new MemoryStore()).current
  const memoryRetriever = useRef(new MemoryRetrieverImpl(memoryStore)).current

  // Load messages for current conversation
  useEffect(() => {
    getMessages(conversationId).then(setMessages).catch(console.error)
  }, [conversationId])

  // Load conversation list
  useEffect(() => {
    getConversations().then(setConversations).catch(console.error)
  }, [])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setError(null)

      const config = tierRouter.getCurrent()
      if (config.tier === 'free' && !config.ollamaEndpoint) {
        setError(
          window.location.protocol === 'https:'
            ? 'On-device AI is unavailable here. Set an HTTPS Ollama address in Settings → Ollama Endpoint.'
            : 'On-device AI is unavailable here. Start Ollama or set your Mac\'s Ollama address in Settings → Ollama Endpoint.'
        )
        inFlightRef.current = false
        return
      }
      const client: IOllamaClient = config.tier === 'on-device'
        ? onDeviceClient
        : new OllamaClient(config.ollamaEndpoint, config.modelName, config.authToken)
      const memoryExtractor = new MemoryExtractor(client as OllamaClient)

      // Build user message
      const userMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)
      await upsertMessage(userMsg)

      // Persist conversationId so it survives page reload
      localStorage.setItem(LAST_CONV_KEY, conversationId)

      // Save conversation stub immediately — ensures it appears in sidebar
      // even if the assistant response fails. Updated again on success.
      const title = messages.length === 0
        ? content.slice(0, 50) + (content.length > 50 ? '...' : '')
        : conversations.find(c => c.id === conversationId)?.title ?? 'Conversation'
      await upsertConversation({
        id: conversationId,
        title,
        createdAt: userMsg.timestamp,
        updatedAt: userMsg.timestamp,
        messageCount: updatedMessages.length,
        modelVersion: tierRouter.getCurrent().modelName,
        tier,
      })
      const sidebarConvos = await getConversations()
      setConversations(sidebarConvos)

      // Fetch relevant memories and build system prompt
      const relevantMemories = await memoryRetriever.getRelevant(content, 400)
      const memoryContext = memoryRetriever.buildSystemContext(relevantMemories)
      const systemPrompt = BASE_SYSTEM_PROMPT + memoryContext

      // Build context-managed message array
      const ollamaMessages = contextManager.buildMessages(
        systemPrompt,
        messages, // history before new message
        content
      )

      // Stream response
      setIsStreaming(true)
      setStreamingContent('')
      abortRef.current = new AbortController()

      let fullResponse = ''
      let firstTokenAt = 0
      const streamStart = Date.now()
      try {
        fullResponse = await client.chat(ollamaMessages, {
          temperature: 0.7,
          signal: abortRef.current.signal,
          onChunk: chunk => {
            if (!firstTokenAt) firstTokenAt = Date.now()
            fullResponse += chunk
            setStreamingContent(prev => prev + chunk)
          },
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // User cancelled — save partial response if any
          if (!fullResponse) {
            setIsStreaming(false)
            setStreamingContent('')
            inFlightRef.current = false
            return
          }
        } else {
          console.error('Stream error:', err)
          setError(
            `Couldn't reach ${tier === 'cloud' ? 'the cloud' : 'AIrIA'} — ${(err as Error).message}`
          )
          setIsStreaming(false)
          setStreamingContent('')
          inFlightRef.current = false
          return
        }
      }

      // Save assistant message
      const assistantMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      }
      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)
      await upsertMessage(assistantMsg)

      // Record metrics
      const durationMs = Date.now() - streamStart
      const latencyMs = firstTokenAt ? firstTokenAt - streamStart : durationMs
      const completionTokens = fullResponse.split(/\s+/).length // word estimate
      const tokensPerSecond = durationMs > 0 ? (completionTokens / durationMs) * 1000 : 0
      const memories = await memoryRetriever.getRelevant('', 999) // all memories for contradiction check
      const metric: MessageMetric = {
        id: `metric_${assistantMsg.id}`,
        messageId: assistantMsg.id,
        conversationId,
        timestamp: assistantMsg.timestamp,
        latencyMs,
        durationMs,
        tokensPerSecond,
        promptTokens: ollamaMessages.reduce((s, m) => s + m.content.split(/\s+/).length, 0),
        completionTokens,
        feedbackSignal: undefined,
        retried: false,
        uncertaintyFlagged: detectUncertainty(fullResponse),
        contradictionFlagged: detectContradiction(fullResponse, memories),
        tier: config.tier,
        modelName: config.modelName,
      }
      storeMetric(metric).then(() => onMetricStored?.()).catch(console.error)

      const conv: Conversation = {
        id: conversationId,
        title,
        createdAt: messages[0]?.timestamp ?? Date.now(),
        updatedAt: Date.now(),
        messageCount: finalMessages.length,
        modelVersion: config.modelName,
        tier,
      }
      await upsertConversation(conv)
      const updatedConvos = await getConversations()
      setConversations(updatedConvos)

      setIsStreaming(false)
      setStreamingContent('')
      inFlightRef.current = false

      // Extract memories async — non-blocking, non-fatal
      if (tier !== 'free') {
        memoryExtractor
          .extract(content, fullResponse, conversationId)
          .then(entries => Promise.all(entries.map(e => memoryStore.upsert(e))))
          .catch(console.error)
      }
    },
    [conversationId, messages, conversations, contextManager, memoryRetriever, memoryStore, tier]
  )

  // Regenerate the assistant response for a given assistant message.
  // Captures the old response as rejectedContent for DPO training.
  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isStreaming) return

      const msgIndex = messages.findIndex(m => m.id === messageId)
      if (msgIndex === -1) return
      const assistantMsg = messages[msgIndex]
      if (assistantMsg.role !== 'assistant') return

      // Find the user message immediately before this assistant message
      const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      if (!userMsg) return

      const rejectedContent = assistantMsg.content
      const history = messages.slice(0, msgIndex) // everything up to (not including) old assistant msg

      setMessages(history)
      setError(null)

      const config = tierRouter.getCurrent()
      const client: IOllamaClient = config.tier === 'on-device'
        ? onDeviceClient
        : new OllamaClient(config.ollamaEndpoint, config.modelName, config.authToken)

      const relevantMemories = await memoryRetriever.getRelevant(userMsg.content, 400)
      const memoryContext = memoryRetriever.buildSystemContext(relevantMemories)
      const systemPrompt = BASE_SYSTEM_PROMPT + memoryContext

      // history already ends with userMsg, so pass history-minus-userMsg as context history
      const ollamaMessages = contextManager.buildMessages(
        systemPrompt,
        history.slice(0, -1),
        userMsg.content
      )

      setIsStreaming(true)
      setStreamingContent('')
      abortRef.current = new AbortController()

      let fullResponse = ''
      try {
        fullResponse = await client.chat(ollamaMessages, {
          temperature: 0.7,
          signal: abortRef.current.signal,
          onChunk: chunk => {
            fullResponse += chunk
            setStreamingContent(prev => prev + chunk)
          },
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(`Retry failed — ${(err as Error).message}`)
        }
        setIsStreaming(false)
        setStreamingContent('')
        return
      }

      const newAssistantMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      }
      setMessages([...history, newAssistantMsg])
      await upsertMessage(newAssistantMsg)

      setIsStreaming(false)
      setStreamingContent('')

      // Record DPO pair — retry gives us the clearest signal
      await storeFeedback({
        conversationId,
        messageId: newAssistantMsg.id,
        signal: 'retry',
        timestamp: Date.now(),
        chosenContent: fullResponse,
        rejectedContent,
      })
    },
    [conversationId, isStreaming, messages, contextManager, memoryRetriever]
  )

  const recordFeedback = useCallback(
    async (
      messageId: string,
      signal: FeedbackSignalType,
      chosenContent: string,
      rejectedContent?: string
    ) => {
      await storeFeedback({
        conversationId,
        messageId,
        signal,
        timestamp: Date.now(),
        chosenContent,
        rejectedContent,
      })
      // Mark the signal on the message so the UI can lock the feedback buttons
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, feedbackSignal: signal } : m)
      )
      // Sync to metric record
      updateMetricFeedback(messageId, signal).catch(console.error)
    },
    [conversationId]
  )

  const loadConversation = useCallback(async (id: string) => {
    const msgs = await getMessages(id)
    setMessages(msgs)
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStream,
    conversations,
    loadConversation,
    error,
    dismissError,
    recordFeedback,
    retryMessage,
  }
}
