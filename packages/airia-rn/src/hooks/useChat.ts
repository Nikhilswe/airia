// AIrIA — useChat (React Native)
// Thin re-export: same hook, same imports, works cross-platform because
// @airia/service and @airia/db have no DOM/browser dependencies.
//
// NOTE: localStorage calls inside the web useChat won't work on RN. We provide
// a thin wrapper that stubs the key/value operations via a module-level Map.

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, Conversation, Tier, FeedbackSignalType, AttachmentHint, RouteInfo } from '@airia/types'
import {
  OllamaClient,
  ContextManager,
  MemoryStore,
  MemoryRetrieverImpl,
  MemoryExtractor,
  tierRouter,
  getNativeAppBridge,
  capabilityRouter,
  RegulatedDomainError,
} from '@airia/service'
import { getModelForCapability, isModelOnDisk, getModel, DEFAULT_MODEL_ID, RESPONSE_RESERVE_TOKENS } from '../bridge/models'
import { buildAttachmentContext } from '../services/attachmentText'
import type { OllamaClient as IOllamaClient } from '@airia/types'
import {
  getMessages,
  upsertMessage,
  upsertConversation,
  getConversations,
  storeFeedback,
} from '@airia/db'

// Lightweight AsyncStorage shim — replace with @react-native-async-storage/async-storage
// if persistence across app restarts is needed.
const memStore = new Map<string, string>()
const kv = {
  getItem: (key: string) => memStore.get(key) ?? null,
  setItem: (key: string, value: string) => { memStore.set(key, value) },
}

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
}

interface UseChatReturn {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  sendMessage: (content: string, attachments?: AttachmentHint[]) => Promise<void>
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

async function buildClient(
  content: string,
  tier: Tier,
  attachments?: AttachmentHint[]
): Promise<{ client: IOllamaClient; modelUsed: string; routeInfo?: RouteInfo }> {
  const config = tierRouter.getCurrent()
  const isOnDevice = tier === 'on-device' || config.tier === 'on-device'

  // Route the query — works for both on-device and Ollama paths
  let decision: ReturnType<typeof capabilityRouter.route> | null = null
  try {
    decision = capabilityRouter.route(content, attachments)
  } catch (e) {
    if (e instanceof RegulatedDomainError) throw e
  }

  if (isOnDevice) {
    const bridge = getNativeAppBridge()
    // config.modelName is a WebLLM/MLC id used by the browser build; on RN the
    // real model is whatever GGUF llama.rn has loaded, so name that instead.
    const activeId = bridge.getActiveModelId() ?? DEFAULT_MODEL_ID
    let modelUsed = getModel(activeId)?.displayName ?? activeId
    let routeInfo: RouteInfo | undefined

    // Try to switch to the capability-specific on-device model. If it isn't
    // downloaded we stay on the current model rather than blocking the chat —
    // but we record why, so the UI can offer the download instead of quietly
    // answering an image question with a text-only model.
    let visionReady = false
    let loadFailed = false
    if (decision) {
      const capModel = getModelForCapability(decision.capability)
      const onDisk = capModel ? await isModelOnDisk(capModel.id) : false

      if (capModel && onDisk) {
        try {
          await bridge.initModel(capModel.id)
          modelUsed = capModel.displayName
          visionReady = decision.capability === 'vision'
        } catch (err) {
          // A capability model that won't load must not take the turn down with
          // it — degrade to whatever is already loaded, exactly as we do when
          // the model isn't downloaded at all.
          console.warn(`Falling back, ${capModel.id} failed to load:`, err)
          loadFailed = true
        }
      }

      routeInfo = {
        capability: decision.capability,
        requestedModel: capModel?.displayName ?? decision.modelName,
        requestedModelId: capModel?.id,
        actualModel: modelUsed,
        fallback: !capModel ? 'no-model' : loadFailed || !onDisk ? 'not-downloaded' : 'none',
        method: decision.method,
        score: decision.score,
      }
    }

    // Only hand image paths to a loaded vision model — a text-only model would
    // reject them and fail the turn instead of degrading to a text answer.
    const mediaPaths = visionReady
      ? attachments?.filter(a => a.type === 'image' && a.uri).map(a => a.uri!)
      : undefined

    return {
      client: {
        ping: async () => true,
        listModels: async () => [],
        loadModel: async () => {},
        chat: (msgs, opts) => bridge.chat(msgs, { ...(opts ?? {}), mediaPaths }),
      },
      modelUsed,
      routeInfo,
    }
  }

  const modelName = decision?.modelName ?? config.modelName
  return {
    client: new OllamaClient(config.ollamaEndpoint, modelName, config.authToken),
    modelUsed: modelName,
    routeInfo: decision
      ? {
          capability: decision.capability,
          requestedModel: decision.modelName,
          actualModel: modelName,
          fallback: 'none',
          method: decision.method,
          score: decision.score,
        }
      : undefined,
  }
}

const LAST_CONV_KEY = 'airia:last_conversation_id'

export function useChat({ conversationId, tier }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  // The budget has to track the window the model is actually loaded with, and
  // leave room for the reply. Left at defaults these drift apart, and a prompt
  // larger than the window makes llama.cpp silently drop the oldest turns —
  // the conversation quietly losing its own history.
  const contextManager = useRef(
    new ContextManager({
      maxTokens: getModel(DEFAULT_MODEL_ID)?.nCtx ?? 4096,
      reserveForResponse: RESPONSE_RESERVE_TOKENS,
    })
  ).current
  const memoryStore = useRef(new MemoryStore()).current
  const memoryRetriever = useRef(new MemoryRetrieverImpl(memoryStore)).current

  useEffect(() => {
    getMessages(conversationId).then(setMessages).catch(console.error)
  }, [conversationId])

  useEffect(() => {
    getConversations().then(setConversations).catch(console.error)
  }, [])

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (content: string, attachments?: AttachmentHint[]) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setError(null)

      // Everything below runs inside try/finally: any throw used to leave the
      // guard latched on, after which every later send silently cleared the
      // composer and did nothing until the app restarted.
      try {
      let client: IOllamaClient
      let modelUsed: string
      let routeInfo: RouteInfo | undefined
      try {
        const built = await buildClient(content, tier, attachments)
        client = built.client
        modelUsed = built.modelUsed
        routeInfo = built.routeInfo
      } catch (e) {
        if (e instanceof RegulatedDomainError) {
          setError(e.message)
          return
        }
        throw e
      }
      const memoryExtractor = new MemoryExtractor(client as OllamaClient)

      const userMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        timestamp: Date.now(),
        attachments,
      }
      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)
      await upsertMessage(userMsg)

      kv.setItem(LAST_CONV_KEY, conversationId)

      const title =
        messages.length === 0
          ? content.slice(0, 50) + (content.length > 50 ? '…' : '')
          : conversations.find(c => c.id === conversationId)?.title ?? 'Conversation'

      await upsertConversation({
        id: conversationId,
        title,
        createdAt: userMsg.timestamp,
        updatedAt: userMsg.timestamp,
        messageCount: updatedMessages.length,
        modelVersion: modelUsed,
        tier,
      })
      const sidebarConvos = await getConversations()
      setConversations(sidebarConvos)

      const relevantMemories = await memoryRetriever.getRelevant(content, 400)
      const memoryContext = memoryRetriever.buildSystemContext(relevantMemories)
      const systemPrompt = BASE_SYSTEM_PROMPT + memoryContext

      // Images ride along as media paths; documents get their text pulled in so
      // the model reasons about contents, not filenames.
      const promptContent = content + await buildAttachmentContext(attachments)

      const ollamaMessages = contextManager.buildMessages(systemPrompt, messages, promptContent)

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
        if ((err as Error).name === 'AbortError') {
          if (!fullResponse) {
            setIsStreaming(false)
            setStreamingContent('')
            return
          }
        } else {
          console.error('Stream error:', err)
          setError(`Couldn't reach AIrIA — ${(err as Error).message}`)
          setIsStreaming(false)
          setStreamingContent('')
          return
        }
      }

      const assistantMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        modelUsed,
        routeInfo,
      }
      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)
      await upsertMessage(assistantMsg)

      await upsertConversation({
        id: conversationId,
        title,
        createdAt: messages[0]?.timestamp ?? Date.now(),
        updatedAt: Date.now(),
        messageCount: finalMessages.length,
        modelVersion: modelUsed,
        tier,
      })
      setConversations(await getConversations())

      setIsStreaming(false)
      setStreamingContent('')

      if (tier !== 'free') {
        memoryExtractor
          .extract(content, fullResponse, conversationId)
          .then(entries => Promise.all(entries.map(e => memoryStore.upsert(e))))
          .catch(console.error)
      }
      } catch (err) {
        // Surface it rather than failing silently — a cleared composer with no
        // reply reads as the app ignoring you.
        console.error('sendMessage failed:', err)
        setError(`Something went wrong — ${(err as Error).message}`)
        setIsStreaming(false)
        setStreamingContent('')
      } finally {
        inFlightRef.current = false
      }
    },
    [conversationId, messages, conversations, contextManager, memoryRetriever, memoryStore, tier]
  )

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isStreaming) return
      const msgIndex = messages.findIndex(m => m.id === messageId)
      if (msgIndex === -1) return
      const assistantMsg = messages[msgIndex]
      if (assistantMsg.role !== 'assistant') return
      const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      if (!userMsg) return

      const rejectedContent = assistantMsg.content
      const history = messages.slice(0, msgIndex)
      setMessages(history)
      setError(null)

      let client: IOllamaClient
      let modelUsed: string
      let routeInfo: RouteInfo | undefined
      try {
        const built = await buildClient(userMsg.content, tier)
        client = built.client
        modelUsed = built.modelUsed
        routeInfo = built.routeInfo
      } catch (e) {
        if (e instanceof RegulatedDomainError) {
          setError(e.message)
          return
        }
        throw e
      }

      const relevantMemories = await memoryRetriever.getRelevant(userMsg.content, 400)
      const memoryContext = memoryRetriever.buildSystemContext(relevantMemories)
      const systemPrompt = BASE_SYSTEM_PROMPT + memoryContext
      const ollamaMessages = contextManager.buildMessages(systemPrompt, history.slice(0, -1), userMsg.content)

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
        modelUsed,
        routeInfo,
      }
      setMessages([...history, newAssistantMsg])
      await upsertMessage(newAssistantMsg)
      setIsStreaming(false)
      setStreamingContent('')

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
      await storeFeedback({ conversationId, messageId, signal, timestamp: Date.now(), chosenContent, rejectedContent })
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedbackSignal: signal } : m))
    },
    [conversationId]
  )

  const loadConversation = useCallback(async (id: string) => {
    setMessages(await getMessages(id))
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  return {
    messages, isStreaming, streamingContent,
    sendMessage, cancelStream,
    conversations, loadConversation,
    error, dismissError,
    recordFeedback, retryMessage,
  }
}
