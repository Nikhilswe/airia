// AIrIA — UpdateChannelClient
// Free tier: polls for curator-signed model updates and applies them on user consent.
// Signature verification is a TODO — requires Ed25519 public key infrastructure (Phase 3).

import { ModelUpdate, UpdateChannel } from '@airia/types'

export class UpdateChannelClient implements UpdateChannel {
  private readonly channelUrl: string

  constructor(channelUrl: string) {
    this.channelUrl = channelUrl
  }

  /**
   * Fetch the latest model update manifest from the update channel.
   * GETs `${channelUrl}/latest.json` and parses the response as a ModelUpdate.
   * Returns null on any network or parse error (callers should treat null as
   * "no update available" rather than a hard failure).
   */
  async checkForUpdate(): Promise<ModelUpdate | null> {
    try {
      const response = await fetch(`${this.channelUrl}/latest.json`)
      if (!response.ok) {
        return null
      }
      const data = await response.json() as ModelUpdate
      return data
    } catch {
      return null
    }
  }

  /**
   * Verify the cryptographic signature on a model update.
   *
   * TODO (Phase 3): Implement Ed25519 signature verification against the
   * AIrIA update signing public key. This is separate from the adapter
   * signing key used in AdapterRegistry.
   *
   * Currently returns true unconditionally — DO NOT ship to production
   * without proper verification.
   */
  async verify(_update: ModelUpdate): Promise<boolean> {
    console.warn(
      '[UpdateChannelClient] Signature verification not yet implemented (Phase 3). ' +
      'Skipping Ed25519 check — do not use in production.',
    )
    return true
  }

  /**
   * Download and apply the model update via Ollama pull.
   * Downloads the model to a temp path, then triggers an Ollama pull
   * from the download URL.  Progress is reported via the onProgress callback
   * as a percentage value in [0, 100].
   */
  async apply(
    update: ModelUpdate,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    onProgress?.(0)

    // Stream the download and track progress against the declared size.
    const response = await fetch(update.downloadUrl)
    if (!response.ok) {
      throw new Error(
        `Failed to download model update from ${update.downloadUrl}: ${response.status} ${response.statusText}`,
      )
    }

    // Track download progress using Content-Length if available.
    const contentLength = Number(response.headers.get('Content-Length') ?? update.sizeBytes)
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    let received = 0
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.byteLength
        if (contentLength > 0) {
          onProgress?.(Math.min(Math.round((received / contentLength) * 90), 90))
        }
      }
    }

    onProgress?.(90)

    // Ask Ollama to pull the model by URL.
    // The Ollama pull API accepts a name (which may be a full URL for custom models).
    const ollamaResp = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: update.downloadUrl, stream: false }),
    })

    if (!ollamaResp.ok) {
      const detail = await ollamaResp.text()
      throw new Error(`Ollama pull failed: ${ollamaResp.status} ${detail}`)
    }

    onProgress?.(100)
  }

  /**
   * Roll back to the previously active model.
   *
   * TODO (Phase 3): Implement rollback by tracking the previous model
   * version and re-activating it via Ollama.
   */
  async rollback(): Promise<void> {
    console.log('[UpdateChannelClient] rollback not yet implemented')
  }
}
