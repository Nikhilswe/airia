// AIrIA — OnDeviceClient
// CTO-owned. Runs inference directly in the browser via WebLLM (MLC-LLM).
// Used on mobile when Ollama is not reachable. No server required.
//
// WebLLM requires WebGPU. Model weights download once and are cached in the
// browser's Cache Storage indefinitely.

import type { OllamaClient as IOllamaClient, OllamaMessage } from '@airia/types'
import { canUseWebLLM, WebGPUUnavailableError } from './WebGPU'

// Best available small model per device class:
//   Mobile flagship  → Llama-3.2-1B-Instruct-q4f32_1-MLC  (~600 MB, ~15 tok/s)
//   Low-memory       → Llama-3.2-1B-Instruct-q4f16_1-MLC  (~400 MB, slower)
export const ON_DEVICE_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
export const ON_DEVICE_MODEL_ID_LOW = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

export interface DownloadProgress {
  progress: number  // 0–1
  text: string
}

// Minimal types we need from @mlc-ai/web-llm (avoids importing the whole package at module level)
interface MLCEngine {
  chat: {
    completions: {
      create(opts: {
        messages: Array<{ role: string; content: string }>
        temperature?: number
        stream: true
      }): Promise<AsyncIterable<{ choices: Array<{ delta: { content?: string }; finish_reason?: string }> }>>
    }
  }
  resetChat(): Promise<void>
  unload(): Promise<void>
}

interface InitProgressReport {
  progress: number
  text: string
}

export class OnDeviceClient implements IOllamaClient {
  private engine: MLCEngine | null = null
  private modelId: string
  private initPromise: Promise<void> | null = null
  private onDownloadProgress?: (p: DownloadProgress) => void

  constructor(modelId = ON_DEVICE_MODEL_ID) {
    this.modelId = modelId
  }

  setProgressCallback(cb: (p: DownloadProgress) => void): void {
    this.onDownloadProgress = cb
  }

  isInitialized(): boolean {
    return this.engine !== null
  }

  // Call this when the engine may have been killed by the OS (e.g. iOS backgrounding)
  reset(): void {
    this.engine = null
    this.initPromise = null
  }

  // Idempotent — safe to call multiple times; subsequent calls return the same promise
  async initialize(): Promise<void> {
    if (this.engine) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      // Check before importing WebLLM. In particular, this keeps its large WASM
      // bundle away from iOS Safari when WebGPU is absent or cannot get an adapter.
      if (!(await canUseWebLLM())) {
        throw new WebGPUUnavailableError()
      }

      // Safari iOS blocks the Cache API over plain HTTP (requires HTTPS).
      // WebLLM uses caches internally; throw early with an actionable message.
      if (typeof caches === 'undefined') {
        throw new Error(
          'On-device inference requires HTTPS (Safari blocks Cache API over HTTP). ' +
          'Open AIrIA over HTTPS, or connect to an Ollama server on your local network.'
        )
      }

      // Dynamic import keeps WebLLM out of the desktop bundle
      const webllm = await import('@mlc-ai/web-llm')

      const engine = await webllm.CreateMLCEngine(this.modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          this.onDownloadProgress?.({ progress: report.progress, text: report.text })
        },
      })

      this.engine = engine as unknown as MLCEngine
    })()

    try {
      await this.initPromise
    } catch (error) {
      // A failed initialization must be retryable after the user changes backend
      // settings or the browser restores a lost GPU context.
      this.initPromise = null
      throw error
    }
  }

  async ping(): Promise<boolean> {
    return this.engine !== null
  }

  async chat(
    messages: OllamaMessage[],
    options: {
      temperature?: number
      onChunk?: (chunk: string) => void
      signal?: AbortSignal
    } = {}
  ): Promise<string> {
    if (!this.engine) await this.initialize()
    const { temperature = 0.7, onChunk, signal } = options

    const stream = await this.engine!.chat.completions.create({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      stream: true,
    })

    let fullContent = ''
    for await (const chunk of stream) {
      if (signal?.aborted) break
      const token = chunk.choices[0]?.delta?.content ?? ''
      if (token) {
        fullContent += token
        onChunk?.(token)
      }
      if (chunk.choices[0]?.finish_reason) break
    }

    return fullContent
  }

  async listModels(): Promise<string[]> {
    return [this.modelId]
  }

  async loadModel(_modelName: string): Promise<void> {
    // On-device: model is already loaded via initialize()
  }
}

// Module-level singleton so the engine survives re-renders
export const onDeviceClient = new OnDeviceClient()
