// AIrIA — useChat hook
// Wires OllamaClient + ContextManager + MemoryRetriever + IndexedDB.
// Codex-generated, CTO-reviewed.

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, Conversation, Tier } from '../types/core'
import { OllamaClient } from '../services/OllamaClient'
import { ContextManager } from '../services/ContextManager'
import { MemoryStore, MemoryRetrieverImpl } from '../services/MemoryService'
import { MemoryExtractor } from '../services/MemoryExtractor'
import { getMessages, upsertMessage, upsertConversation, getConversations } from '../db/client'
import { tierRouter } from '../services/TierRouter'

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
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => void
  conversations: Conversation[]
  loadConversation: (id: string) => Promise<void>
}

export function useChat({ conversationId, tier }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const abortRef = useRef<AbortController | null>(null)

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
      if (isStreaming) return

      const config = tierRouter.getCurrent()
      const client = new OllamaClient(config.ollamaEndpoint, config.modelName, config.authToken)
      const memoryExtractor = new MemoryExtractor(client)

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
          // User cancelled — save partial response if any
          if (!fullResponse) {
            setIsStreaming(false)
            setStreamingContent('')
            return
          }
        } else {
          console.error('Stream error:', err)
          setIsStreaming(false)
          setStreamingContent('')
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

      // Update conversation metadata
      const title =
        messages.length === 0
          ? content.slice(0, 50) + (content.length > 50 ? '...' : '')
          : conversations.find(c => c.id === conversationId)?.title ?? 'Conversation'

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

      // Extract memories async — non-blocking, non-fatal
      if (tier !== 'free') {
        memoryExtractor
          .extract(content, fullResponse, conversationId)
          .then(entries => Promise.all(entries.map(e => memoryStore.upsert(e))))
          .catch(console.error)
      }
    },
    [conversationId, isStreaming, messages, conversations, contextManager, memoryRetriever, memoryStore, tier]
  )

  const loadConversation = useCallback(async (id: string) => {
    const msgs = await getMessages(id)
    setMessages(msgs)
  }, [])

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStream,
    conversations,
    loadConversation,
  }
}
