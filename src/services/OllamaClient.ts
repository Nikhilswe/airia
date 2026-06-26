// AIrIA — OllamaClient
// Implements the OllamaClient interface from src/types/core.ts
// SSE-based streaming, abort control, works for local + cloud endpoints.

import type { OllamaClient as IOllamaClient, OllamaMessage, OllamaStreamChunk } from '../types/core'

export class OllamaClient implements IOllamaClient {
  private endpoint: string
  private authToken?: string
  private modelName: string

  constructor(endpoint: string, modelName: string, authToken?: string) {
    this.endpoint = endpoint.replace(/\/$/, '')
    this.modelName = modelName
    this.authToken = authToken
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`
    return h
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        headers: this.headers,
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async chat(
    messages: OllamaMessage[],
    options: {
      temperature?: number
      onChunk?: (chunk: string) => void
      signal?: AbortSignal
    } = {}
  ): Promise<string> {
    const { temperature = 0.7, onChunk, signal } = options

    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: this.headers,
      signal,
      body: JSON.stringify({
        model: this.modelName,
        messages,
        stream: true,
        options: { temperature },
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama chat failed: ${res.status} ${res.statusText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body from Ollama')

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line) as OllamaStreamChunk
            const token = chunk.message?.content ?? ''
            if (token) {
              fullContent += token
              onChunk?.(token)
            }
            if (chunk.done) break
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullContent
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return data.models?.map(m => m.name) ?? []
    } catch {
      return []
    }
  }

  async loadModel(modelName: string): Promise<void> {
    const res = await fetch(`${this.endpoint}/api/pull`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name: modelName, stream: false }),
    })
    if (!res.ok) {
      throw new Error(`Failed to load model ${modelName}: ${res.status}`)
    }
  }
}
