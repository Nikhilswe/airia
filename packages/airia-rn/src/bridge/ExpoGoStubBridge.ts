// Stub bridge used when running in Expo Go (no native modules available).
// All inference methods throw a clear "not available" message instead of a
// native module crash. UI and navigation work normally for design iteration.

import type { NativeAppBridgeInterface, NativeDeviceInfo } from '@airia/service'
import type { OllamaMessage } from '@airia/types'

const NOT_AVAILABLE = 'On-device inference is not available in Expo Go. Use an EAS dev-client build to run llama.rn.'

export class ExpoGoStubBridge implements NativeAppBridgeInterface {
  async getDeviceInfo(): Promise<NativeDeviceInfo> {
    return { platform: 'ios', totalRam: 0, freeRam: 0, supportsOnDevice: false }
  }
  async listModels(): Promise<string[]> { return [] }
  async isModelDownloaded(_id: string): Promise<boolean> { return false }
  async downloadModel(_id: string, _onProgress: (p: number, t: string) => void): Promise<void> {
    throw new Error(NOT_AVAILABLE)
  }
  async deleteModel(_id: string): Promise<void> { throw new Error(NOT_AVAILABLE) }
  async initModel(_id: string, _onProgress?: (p: number, t: string) => void): Promise<void> {
    throw new Error(NOT_AVAILABLE)
  }
  getActiveModelId(): string | null { return null }
  getActiveContextSize(): number | null { return null }
  async chat(_messages: OllamaMessage[], _options?: { temperature?: number; onChunk?: (token: string) => void; signal?: AbortSignal }): Promise<string> {
    throw new Error(NOT_AVAILABLE)
  }
  async applyAdapter(_path: string, _baseModelId: string): Promise<void> { throw new Error(NOT_AVAILABLE) }
  async getActiveAdapter(): Promise<string | null> { return null }
  async removeAdapter(): Promise<void> {}
}
