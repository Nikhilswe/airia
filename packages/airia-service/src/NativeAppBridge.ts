// AIrIA — NativeAppBridge
// CTO-owned. Interface contract for native app wrappers.
//
// MIGRATION PATH (PWA → Native):
//   When moving from PWA to a native app (React Native, Capacitor, Flutter):
//   1. Implement NativeAppBridgeInterface using your bridge plugin
//      e.g. @capacitor/...  or  react-native-llm-inference
//   2. Call setNativeAppBridge(new YourNativeImpl()) before app init
//   3. TierRouter will automatically use it when tier === 'on-device'
//
// The stub below is what runs in the PWA (WebLLM path).
// It throws NotImplementedError so missing implementations surface immediately.

import type { OllamaMessage } from '@airia/types'

export interface NativeDeviceInfo {
  platform: 'ios' | 'android' | 'web'
  totalRam: number    // GB
  freeRam: number     // GB (0 if not available)
  supportsOnDevice: boolean
}

export interface NativeAppBridgeInterface {
  // ── Inference ──────────────────────────────────────────────────────────────
  chat(
    messages: OllamaMessage[],
    options: {
      temperature?: number
      onChunk?: (token: string) => void
      signal?: AbortSignal
      /** Local file paths for image input; requires a multimodal model. */
      mediaPaths?: string[]
    }
  ): Promise<string>

  listModels(): Promise<string[]>

  // ── Model management ───────────────────────────────────────────────────────
  // Download a model from the MLC/GGUF registry to on-device storage
  downloadModel(modelId: string, onProgress: (progress: number, text: string) => void): Promise<void>
  deleteModel(modelId: string): Promise<void>
  isModelDownloaded(modelId: string): Promise<boolean>
  initModel(modelId: string, onProgress?: (progress: number, text: string) => void): Promise<void>
  /** Registry id of the model currently loaded, or null if none is. */
  getActiveModelId(): string | null
  /** Context size the active model was actually loaded with. */
  getActiveContextSize(): number | null

  // ── Adapter sync (model weight parity) ────────────────────────────────────
  // Apply a LoRA adapter produced by LocalTrainer on the desktop.
  // adapterPath: remote URL or local path depending on sync mechanism.
  applyAdapter(adapterPath: string, baseModelId: string): Promise<void>
  getActiveAdapter(): Promise<string | null>
  removeAdapter(): Promise<void>

  // ── Device info ────────────────────────────────────────────────────────────
  getDeviceInfo(): Promise<NativeDeviceInfo>
}

// ── Stub (active in PWA / browser) ────────────────────────────────────────────
// All methods throw — ensures that any accidental call to the native bridge
// surface immediately in development rather than silently doing nothing.

class NativeAppBridgeStub implements NativeAppBridgeInterface {
  private err(method: string): never {
    throw new Error(
      `NativeAppBridge.${method}() is not implemented. ` +
      'Register a real implementation via setNativeAppBridge() when running in a native shell.'
    )
  }

  chat(_m: OllamaMessage[], _o: object): Promise<string> { this.err('chat') }
  listModels(): Promise<string[]> { this.err('listModels') }
  downloadModel(_id: string, _p: (n: number, t: string) => void): Promise<void> { this.err('downloadModel') }
  deleteModel(_id: string): Promise<void> { this.err('deleteModel') }
  isModelDownloaded(_id: string): Promise<boolean> { this.err('isModelDownloaded') }
  initModel(_id: string, _p?: (n: number, t: string) => void): Promise<void> { this.err('initModel') }
  getActiveModelId(): string | null { return null }
  getActiveContextSize(): number | null { return null }
  applyAdapter(_path: string, _base: string): Promise<void> { this.err('applyAdapter') }
  getActiveAdapter(): Promise<string | null> { this.err('getActiveAdapter') }
  removeAdapter(): Promise<void> { this.err('removeAdapter') }
  async getDeviceInfo(): Promise<NativeDeviceInfo> { this.err('getDeviceInfo') }
}

// ── Registry ───────────────────────────────────────────────────────────────────
let _bridge: NativeAppBridgeInterface = new NativeAppBridgeStub()

export function setNativeAppBridge(impl: NativeAppBridgeInterface): void {
  _bridge = impl
}

export function getNativeAppBridge(): NativeAppBridgeInterface {
  return _bridge
}
