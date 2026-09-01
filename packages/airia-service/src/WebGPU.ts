// Lightweight WebGPU capability check. Keep this module free of WebLLM imports so
// browsers that cannot run WebLLM never have to parse or initialize its bundle.

interface GPUProvider {
  requestAdapter(): Promise<unknown | null>
}

type NavigatorWithGPU = Navigator & {
  gpu?: GPUProvider
  maxTouchPoints?: number
}

export class WebGPUUnavailableError extends Error {
  constructor() {
    super('On-device WebLLM is not supported safely in this browser.')
    this.name = 'WebGPUUnavailableError'
  }
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const nav = navigator as NavigatorWithGPU
  const ua = nav.userAgent ?? ''
  // iPadOS can request the desktop site and report itself as Macintosh.
  return /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1)
}

export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false

  const gpu = (navigator as NavigatorWithGPU).gpu
  if (!gpu || typeof gpu.requestAdapter !== 'function') return false

  try {
    return (await gpu.requestAdapter()) !== null
  } catch {
    return false
  }
}

export async function canUseWebLLM(): Promise<boolean> {
  // All browsers on iPhone/iPad use WebKit. Safari can expose WebGPU and return
  // an adapter, then terminate the page when WebLLM allocates its WASM/model
  // runtime. Do not import WebLLM on iOS until that path is reliable.
  if (isIOSDevice()) return false
  return isWebGPUAvailable()
}
