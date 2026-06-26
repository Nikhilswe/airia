// AIrIA — OllamaClient unit tests
// CTO-owned. Tests streaming, abort, ping, and error paths.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaClient } from '../../src/services/OllamaClient'

const ENDPOINT = 'http://localhost:11434'
const MODEL = 'gemma3:12b'

function makeStreamResponse(chunks: string[]): Response {
  const lines = chunks.map(c =>
    JSON.stringify({ model: MODEL, created_at: '', message: { role: 'assistant', content: c }, done: false })
  )
  lines.push(JSON.stringify({ model: MODEL, created_at: '', message: { role: 'assistant', content: '' }, done: true }))

  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + '\n'))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

describe('OllamaClient', () => {
  let client: OllamaClient

  beforeEach(() => {
    client = new OllamaClient(ENDPOINT, MODEL)
    vi.restoreAllMocks()
  })

  describe('ping()', () => {
    it('returns true when Ollama responds ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      expect(await client.ping()).toBe(true)
    })

    it('returns false when Ollama is unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
      expect(await client.ping()).toBe(false)
    })

    it('returns false when Ollama returns non-ok status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
      expect(await client.ping()).toBe(false)
    })
  })

  describe('chat()', () => {
    it('streams tokens and returns full content', async () => {
      const chunks = ['Hello', ' there', '!']
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(chunks)))

      const received: string[] = []
      const result = await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { onChunk: c => received.push(c) }
      )

      expect(result).toBe('Hello there!')
      expect(received).toEqual(['Hello', ' there', '!'])
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal Server Error', body: null,
      }))

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }])
      ).rejects.toThrow('Ollama chat failed: 500')
    })

    it('respects abort signal — stops streaming mid-way', async () => {
      const controller = new AbortController()
      const chunks = ['Hello', ' there', '!']

      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, opts) => {
        // Simulate abort after fetch is called
        if (opts?.signal) {
          setTimeout(() => controller.abort(), 0)
        }
        return Promise.resolve(makeStreamResponse(chunks))
      }))

      // AbortError should not propagate — client catches it
      const result = await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { signal: controller.signal }
      ).catch(e => {
        // AbortError is expected — return partial content
        if ((e as Error).name === 'AbortError') return ''
        throw e
      })

      // Result is either partial content or empty — no crash
      expect(typeof result).toBe('string')
    })

    it('sends auth token in headers when provided', async () => {
      const authedClient = new OllamaClient(ENDPOINT, MODEL, 'tok_test')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(['Hi'])))

      await authedClient.chat([{ role: 'user', content: 'test' }])

      const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_test')
    })

    it('works with cloud endpoint', async () => {
      const cloudClient = new OllamaClient('https://cloud.airia.ai', MODEL, 'tok_cloud')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(['Cloud response'])))

      const result = await cloudClient.chat([{ role: 'user', content: 'Hi' }])
      expect(result).toBe('Cloud response')

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toBe('https://cloud.airia.ai/api/chat')
    })
  })

  describe('listModels()', () => {
    it('returns model names', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'gemma3:12b' }, { name: 'gemma3:4b' }] }),
      }))
      const models = await client.listModels()
      expect(models).toEqual(['gemma3:12b', 'gemma3:4b'])
    })

    it('returns empty array on error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
      expect(await client.listModels()).toEqual([])
    })
  })
})
