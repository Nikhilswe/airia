// AIrIA — on-device model registry
// Maps model IDs to their Hugging Face GGUF download URLs and metadata.
// Models are downloaded once to the app's document directory and loaded
// by llama.rn via the local file path.

import * as FileSystem from 'expo-file-system/legacy'

import type { Capability } from '@airia/types'

export interface ModelEntry {
  id: string
  displayName: string
  description: string      // what's special about this model
  sizeBytes: number        // approximate, shown in download UI
  url: string              // direct GGUF download URL
  nCtx: number             // context window to use when loading
  nThreads: number
  minRamGB: number         // device RAM floor — skip on low-memory devices
  capability: Capability   // which routing capability this model serves
  /**
   * Multimodal projector. Vision models are useless without it — llama.rn can
   * only accept image input once `initMultimodal` has loaded this file.
   */
  mmprojUrl?: string
  mmprojSizeBytes?: number
}

// Order matters: TierRouter will pick the first one that fits the device.
export const MODEL_REGISTRY: ModelEntry[] = [
  // ── Reason (default / orchestrator) ──
  {
    id: 'gemma-3-1b-it-q4_k_m',
    displayName: 'Gemma 3 1B (Q4)',
    description: 'Google\'s latest lightweight model. Strong at reasoning, summarization, and multilingual tasks. Best balance of speed and quality for mobile.',
    sizeBytes: 806_058_272,
    url: 'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
    nCtx: 4096,
    nThreads: 4,
    minRamGB: 2,
    capability: 'reason',
  },
  // ── Code ──
  {
    id: 'qwen2.5-coder-1.5b-instruct-q4_k_m',
    displayName: 'Qwen 2.5 Coder 1.5B (Q4)',
    description: 'Alibaba\'s code-specialized model. Excels at code generation, debugging, and refactoring. Optimized for on-device coding assistance.',
    sizeBytes: 1_117_320_768,
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    nCtx: 4096,
    nThreads: 4,
    minRamGB: 3,
    capability: 'code',
  },
  // ── Vision ──
  {
    id: 'qwen2.5-vl-3b-instruct-q4_k_m',
    displayName: 'Qwen 2.5 VL 3B (Q4)',
    description: 'Alibaba\'s vision-language model. Understands images, screenshots, diagrams, and documents. Runs on-device for private visual analysis.',
    // ggml-org mirror, not the Qwen org repo — the latter is gated and 401s.
    sizeBytes: 1_929_901_056,
    url: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    mmprojUrl: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
    mmprojSizeBytes: 844_757_728,
    nCtx: 4096,
    nThreads: 4,
    minRamGB: 4,
    capability: 'vision',
  },
  // ── Alternate reason ──
  {
    id: 'llama-3.2-1b-instruct-q4_k_m',
    displayName: 'Llama 3.2 1B (Q4)',
    description: 'Meta\'s compact instruction-tuned model. Excels at conversational tasks, coding assistance, and structured output. Fastest inference on-device.',
    sizeBytes: 770_000_000,
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    nCtx: 4096,
    nThreads: 4,
    minRamGB: 2,
    capability: 'reason',
  },
]

export const DEFAULT_MODEL_ID = MODEL_REGISTRY[0].id

export function getModel(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find(m => m.id === id)
}

export function modelPath(id: string): string {
  return `${FileSystem.documentDirectory}airia-models/${id}.gguf`
}

export function mmprojPath(id: string): string {
  return `${FileSystem.documentDirectory}airia-models/${id}.mmproj.gguf`
}

export function getModelForCapability(capability: Capability): ModelEntry | undefined {
  return MODEL_REGISTRY.find(m => m.capability === capability)
}

export async function isModelOnDisk(id: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(modelPath(id))
  return info.exists && (info as { size?: number }).size !== undefined
    && (info as { size: number }).size > 100_000
}
