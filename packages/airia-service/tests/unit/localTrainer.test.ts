import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalTrainer, MIN_PAIRS_THRESHOLD } from '../../src/LocalTrainer'

// Mock all external dependencies
vi.mock('@airia/db', () => ({ storeTrainingJob: vi.fn() }))
vi.mock('../../src/TierRouter', () => ({
  tierRouter: {
    getCurrent: () => ({ tier: 'local', modelName: 'gemma3:4b', ollamaEndpoint: 'http://localhost:11434', trainingEnabled: true, updateChannelEnabled: false }),
    switchTier: vi.fn(),
  },
}))
vi.mock('../../src/PreferencePairBuilder', () => ({
  PreferencePairBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn().mockResolvedValue({
      pairs: Array.from({ length: MIN_PAIRS_THRESHOLD }, (_, i) => ({
        chosen: `chosen response ${i} with enough content`,
        rejected: `rejected response ${i} with enough content`,
        confidence: 0.9,
        signalType: 'retry',
        conversationId: 'conv_1',
        timestamp: Date.now(),
      })),
      jsonl: Array.from({ length: MIN_PAIRS_THRESHOLD })
        .map((_, i) => JSON.stringify({ chosen: `chosen ${i}`, rejected: `rejected ${i}` }))
        .join('\n'),
      invalidCount: 0,
      skippedCount: 0,
    }),
    getReadyCount: vi.fn().mockResolvedValue(MIN_PAIRS_THRESHOLD),
  })),
}))
vi.mock('../../src/ModelManager', () => ({
  ModelManager: vi.fn().mockImplementation(() => ({
    swap: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  })),
}))
vi.mock('../../src/RegressionEval', () => ({
  RegressionEval: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      jobId: 'job_1',
      baselineScore: 0.72,
      newScore: 0.73,
      delta: 0.01,
      passed: true,
      timestamp: Date.now(),
    }),
  })),
}))

describe('LocalTrainer', () => {
  let trainer: LocalTrainer

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('isReady returns false when pair count is below threshold', async () => {
    const { PreferencePairBuilder } = await import('../../src/PreferencePairBuilder')
    const MockBuilder = PreferencePairBuilder as ReturnType<typeof vi.fn>
    MockBuilder.mockImplementationOnce(() => ({ getReadyCount: vi.fn().mockResolvedValue(10) }))

    trainer = new LocalTrainer()
    const result = await trainer.isReady()
    expect(result.ready).toBe(false)
    expect(result.needed).toBe(MIN_PAIRS_THRESHOLD)
  })

  it('isReady returns true when pair count meets threshold', async () => {
    trainer = new LocalTrainer()
    const result = await trainer.isReady()
    expect(result.ready).toBe(true)
    expect(result.pairCount).toBe(MIN_PAIRS_THRESHOLD)
  })

  it('isServerReachable returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('refused')))
    trainer = new LocalTrainer()
    expect(await trainer.isServerReachable()).toBe(false)
  })

  it('isServerReachable returns true when server responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    trainer = new LocalTrainer()
    expect(await trainer.isServerReachable()).toBe(true)
  })

  it('run completes successfully and emits done progress', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({  // POST /train
        ok: true,
        json: () => Promise.resolve({ job_id: 'srv_job_1' }),
      })
      .mockResolvedValueOnce({  // GET /train/srv_job_1/status
        ok: true,
        json: () => Promise.resolve({ status: 'done', progress: 1, output_dir: './models/test' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    trainer = new LocalTrainer(undefined, 0)  // zero poll interval for tests
    const progress: string[] = []
    const job = await trainer.run(p => progress.push(p.status))

    expect(job.status).toBe('success')
    expect(job.outputModelVersion).toBeDefined()
    expect(progress).toContain('done')
  })

  it('run throws when below pair threshold', async () => {
    const { PreferencePairBuilder } = await import('../../src/PreferencePairBuilder')
    const MockBuilder = PreferencePairBuilder as ReturnType<typeof vi.fn>
    MockBuilder.mockImplementationOnce(() => ({
      build: vi.fn().mockResolvedValue({ pairs: [], jsonl: '', invalidCount: 0, skippedCount: 0 }),
      getReadyCount: vi.fn().mockResolvedValue(0),
    }))

    trainer = new LocalTrainer()
    await expect(trainer.run(() => {})).rejects.toThrow('Not enough quality pairs')
  })

  it('run throws and marks job failed when server unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    trainer = new LocalTrainer()
    const statuses: string[] = []
    await expect(trainer.run(p => statuses.push(p.status))).rejects.toThrow()
    expect(statuses).toContain('error')
  })
})
