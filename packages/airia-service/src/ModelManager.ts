// AIrIA — ModelManager
// CTO-owned. Handles hot model swaps and rollback via Ollama + training server.
// Swap = create new Ollama model from adapter weights, update TierRouter.
// Rollback = revert TierRouter to previous model name (previous model stays in Ollama).

import { timeoutSignal } from './timeoutSignal'
import { tierRouter } from './TierRouter'

const OLLAMA_ENDPOINT = 'http://localhost:11434'
const TRAINING_SERVER = 'http://localhost:8765'

export class ModelManager {
  private ollamaEndpoint: string
  private trainingServer: string

  constructor(
    ollamaEndpoint = OLLAMA_ENDPOINT,
    trainingServer = TRAINING_SERVER
  ) {
    this.ollamaEndpoint = ollamaEndpoint.replace(/\/$/, '')
    this.trainingServer = trainingServer.replace(/\/$/, '')
  }

  // Create a new Ollama model from adapter weights via the training server, then
  // update TierRouter so all subsequent requests use the new model.
  async swap(modelName: string, adapterPath: string, baseModel: string): Promise<void> {
    const res = await fetch(`${this.trainingServer}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName, adapter_path: adapterPath, base_model: baseModel }),
      signal: timeoutSignal(60_000),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText })) as { message: string }
      throw new Error(`Model swap failed: ${body.message}`)
    }

    const current = tierRouter.getCurrent()
    await tierRouter.switchTier(current.tier, { modelName })
  }

  // Revert TierRouter to a previously-known good model.
  // The previous model is already registered in Ollama — no re-create needed.
  async rollback(previousModelName: string): Promise<void> {
    const current = tierRouter.getCurrent()
    await tierRouter.switchTier(current.tier, { modelName: previousModelName })
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.ollamaEndpoint}/api/tags`, {
        signal: timeoutSignal(3000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return data.models?.map(m => m.name) ?? []
    } catch {
      return []
    }
  }

  async modelExists(name: string): Promise<boolean> {
    const models = await this.listModels()
    return models.some(m => m === name || m.startsWith(name + '-'))
  }
}
