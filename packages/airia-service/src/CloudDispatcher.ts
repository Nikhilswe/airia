// AIrIA — CloudDispatcher
// Dispatches training jobs to the cloud GPU API.
// PLACEHOLDER: Cloud backend not yet built. All methods throw NotImplementedError.
// CTO will wire this when cloud API is ready.

import { TrainingJobStatus } from '@airia/types'

export class CloudDispatcher {
  /**
   * Submit a JSONL string of preference pairs to the cloud training API.
   * Returns a jobId that can be used to poll status.
   *
   * @throws {Error} Cloud training not yet implemented.
   */
  async dispatch(_pairsJsonl: string): Promise<string> {
    throw new Error('Cloud training not yet implemented')
  }

  /**
   * Poll the status of a cloud training job.
   * Returns the current status and a progress value in [0, 1].
   *
   * @throws {Error} Cloud training not yet implemented.
   */
  async getStatus(
    _jobId: string,
  ): Promise<{ status: TrainingJobStatus; progress: number }> {
    throw new Error('Cloud training not yet implemented')
  }

  /**
   * Block until the cloud job completes, then pull the resulting model
   * into the local Ollama registry.
   * Returns the new Ollama model name when ready.
   *
   * @throws {Error} Cloud training not yet implemented.
   */
  async pullModel(_jobId: string): Promise<string> {
    throw new Error('Cloud training not yet implemented')
  }
}
