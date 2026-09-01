// AIrIA — NativeAppBridgeImpl
// Real llama.rn implementation of NativeAppBridgeInterface.
// Used in EAS dev-client / production builds (not Expo Go).

import { initLlama, releaseAllLlama, RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER } from 'llama.rn'
import type { LlamaContext } from 'llama.rn'
import * as FileSystem from 'expo-file-system/legacy'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import type { NativeAppBridgeInterface, NativeDeviceInfo } from '@airia/service'
import type { OllamaMessage } from '@airia/types'
import { getModel, modelPath, mmprojPath, isModelOnDisk, isFileComplete, discardPartialFile, DEFAULT_MODEL_ID, MAX_RESPONSE_TOKENS } from './models'

export class NativeAppBridgeImpl implements NativeAppBridgeInterface {
  private contexts = new Map<string, LlamaContext>()
  private activeModelId: string | null = null

  // ── Device info ────────────────────────────────────────────────────────────

  async getDeviceInfo(): Promise<NativeDeviceInfo> {
    const totalRamBytes = Device.totalMemory ?? 0
    const ramGB = totalRamBytes / (1024 ** 3)
    return {
      platform: Platform.OS as 'ios' | 'android',
      totalRam: Math.round(ramGB * 10) / 10,
      freeRam: 0,              // expo-device doesn't expose free RAM; llama.rn manages pressure internally
      supportsOnDevice: ramGB >= 2,
    }
  }

  // ── Model management ───────────────────────────────────────────────────────

  async isModelDownloaded(modelId: string): Promise<boolean> {
    return isModelOnDisk(modelId)
  }

  async listModels(): Promise<string[]> {
    const dir = `${FileSystem.documentDirectory}airia-models/`
    try {
      const info = await FileSystem.getInfoAsync(dir)
      if (!info.exists) return []
      const files = await FileSystem.readDirectoryAsync(dir)
      return files
        .filter(f => f.endsWith('.gguf'))
        .map(f => f.replace('.gguf', ''))
    } catch {
      return []
    }
  }

  async downloadModel(
    modelId: string,
    onProgress: (progress: number, text: string) => void
  ): Promise<void> {
    const entry = getModel(modelId)
    if (!entry) throw new Error(`Unknown model: ${modelId}`)

    const dir = `${FileSystem.documentDirectory}airia-models/`
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {})

    const dest = modelPath(modelId)

    if (await isFileComplete(dest, entry.sizeBytes)) {
      onProgress(1, 'Model already downloaded')
      await this.initModel(modelId, onProgress)
      return
    }

    // Anything left here is a half-written file from an attempt that was cut
    // short. Clear it, or the next attempt resumes into a corrupt GGUF.
    await discardPartialFile(dest)

    onProgress(0, 'Starting download…')

    const dl = FileSystem.createDownloadResumable(
      entry.url,
      dest,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const expected = totalBytesExpectedToWrite > 0
          ? totalBytesExpectedToWrite
          : entry.sizeBytes
        const pct = Math.min(totalBytesWritten / expected, 0.99)
        const mb = Math.round(totalBytesWritten / 1_000_000)
        const total = Math.round(expected / 1_000_000)
        onProgress(pct, `${mb} / ${total} MB`)
      }
    )

    const result = await dl.downloadAsync()
    if (!result || result.status !== 200) {
      throw new Error(`Download failed (HTTP ${result?.status ?? 'unknown'})`)
    }

    // Vision models need their projector too — without it llama.rn can load
    // the weights but will reject every image, so treat it as part of the model.
    if (entry.mmprojUrl) {
      await this.downloadMmproj(entry.mmprojUrl, entry.mmprojSizeBytes ?? 0, modelId, onProgress)
    }

    onProgress(0.99, 'Loading model…')
    await this.initModel(modelId, onProgress)
    onProgress(1, 'Ready')
  }

  private async downloadMmproj(
    url: string,
    sizeBytes: number,
    modelId: string,
    onProgress: (progress: number, text: string) => void
  ): Promise<void> {
    const dest = mmprojPath(modelId)
    if (await isFileComplete(dest, sizeBytes)) return
    await discardPartialFile(dest)

    const dl = FileSystem.createDownloadResumable(
      url,
      dest,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const expected = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : sizeBytes
        const mb = Math.round(totalBytesWritten / 1_000_000)
        const total = Math.round(expected / 1_000_000)
        onProgress(Math.min(totalBytesWritten / expected, 0.99), `Vision projector ${mb} / ${total} MB`)
      }
    )

    const result = await dl.downloadAsync()
    if (!result || result.status !== 200) {
      throw new Error(`Projector download failed (HTTP ${result?.status ?? 'unknown'})`)
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const ctx = this.contexts.get(modelId)
    if (ctx) {
      await ctx.release()
      this.contexts.delete(modelId)
    }
    if (this.activeModelId === modelId) this.activeModelId = null

    const path = modelPath(modelId)
    const info = await FileSystem.getInfoAsync(path)
    if (info.exists) await FileSystem.deleteAsync(path)
  }

  // Loads a downloaded GGUF file into a llama.rn context.
  async initModel(
    modelId: string,
    onProgress?: (p: number, t: string) => void
  ): Promise<void> {
    if (this.contexts.has(modelId)) {
      this.activeModelId = modelId
      return
    }

    const entry = getModel(modelId)
    const path = modelPath(modelId)
    onProgress?.(0.99, 'Initialising model…')

    const ctx = await initLlama({
      model: path,
      use_mlock: true,
      n_ctx: entry?.nCtx ?? 4096,
      n_threads: entry?.nThreads ?? 4,
    })

    // Load the vision projector before the context is handed out, so the first
    // image-bearing turn doesn't race an uninitialised multimodal path.
    if (entry?.mmprojUrl) {
      const proj = mmprojPath(modelId)
      const projInfo = await FileSystem.getInfoAsync(proj)
      if (projInfo.exists) {
        onProgress?.(0.99, 'Loading vision projector…')
        try {
          // The Simulator's Metal shim (MTLSimDriver) aborts the process when
          // CLIP tensors are uploaded into a GPU buffer, and that native SIGTRAP
          // escapes this catch — so only ask for GPU on real hardware.
          await ctx.initMultimodal({ path: proj, use_gpu: Device.isDevice })
        } catch (err) {
          console.warn(`Multimodal init failed for ${modelId}:`, err)
        }
      }
    }

    this.contexts.set(modelId, ctx)
    this.activeModelId = modelId
  }

  getActiveModelId(): string | null {
    return this.activeModelId
  }

  // ── Inference ──────────────────────────────────────────────────────────────

  async chat(
    messages: OllamaMessage[],
    options: {
      temperature?: number
      onChunk?: (token: string) => void
      signal?: AbortSignal
      mediaPaths?: string[]
    } = {}
  ): Promise<string> {
    const modelId = this.activeModelId ?? DEFAULT_MODEL_ID

    if (!this.contexts.has(modelId)) {
      throw new Error(
        `Model "${modelId}" is not loaded. Download and initialise it first.`
      )
    }

    const ctx = this.contexts.get(modelId)!

    // llama.rn splices images in where the media marker sits. Without it the
    // chat template is built as if there were no image and Qwen answers with a
    // bare turn-start token instead of a description.
    const mediaPaths = options.mediaPaths?.map(p => p.replace(/^file:\/\//, ''))
    let outbound = messages
    if (mediaPaths?.length) {
      const lastUser = messages.map(m => m.role).lastIndexOf('user')
      if (lastUser !== -1) {
        const markers = mediaPaths.map(() => RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER).join('\n')
        outbound = messages.map((m, i) =>
          i === lastUser ? { ...m, content: `${markers}\n${m.content}` } : m
        )
      }
    }

    // Pass messages directly — llama.rn applies the GGUF's built-in chat
    // template (Gemma, Llama, …) internally, so no manual formatting.
    // Skipping the callback is not enough to stop anything: llama.cpp keeps
    // generating to n_predict, so the promise settles minutes later and the UI
    // stays locked. stopCompletion actually halts the loop.
    const onAbort = () => { ctx.stopCompletion().catch(() => {}) }
    options.signal?.addEventListener('abort', onAbort)

    let fullResponse = ''
    try {
      const result = await ctx.completion(
      {
        messages: outbound,
        // Only skip structured parsing for models whose template cannot drive
        // it. Blanket-forcing this would silently disable tool calling for
        // every model once tools land, so the decision lives in the registry.
        force_pure_content: !getModel(modelId)?.supportsToolCalls,
        // llama.rn opens media by filesystem path, not URL — a file:// prefix
        // makes it report the file as missing.
        ...(mediaPaths?.length ? { media_paths: mediaPaths } : {}),
        n_predict: MAX_RESPONSE_TOKENS,
        temperature: options.temperature ?? 0.7,
        // Turn-end markers across the registry: Gemma, Llama, Phi, and the
        // ChatML pair Qwen uses — without <|im_end|> the Qwen models leak
        // raw template tokens into the reply.
        stop: ['<end_of_turn>', '<|eot_id|>', '<|end|>', '</s>', '<|im_end|>'],
      },
      (data: { token: string }) => {
        if (options.signal?.aborted) return
        fullResponse += data.token
        options.onChunk?.(data.token)
      }
      )
      return result.text ?? fullResponse
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  // ── Adapter stubs (LoRA — not yet supported in llama.rn stable) ───────────

  async applyAdapter(_adapterPath: string, _baseModelId: string): Promise<void> {
    throw new Error('LoRA adapters are not yet supported in the RN build.')
  }

  async getActiveAdapter(): Promise<string | null> {
    return null
  }

  async removeAdapter(): Promise<void> {}

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async releaseAll(): Promise<void> {
    await releaseAllLlama()
    this.contexts.clear()
    this.activeModelId = null
  }
}

// Singleton — survives re-renders, released on app background if needed
export const nativeBridge = new NativeAppBridgeImpl()
