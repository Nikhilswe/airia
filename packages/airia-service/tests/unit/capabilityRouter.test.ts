// AIrIA — CapabilityRouter unit tests
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CapabilityRouterImpl,
  validateSkillContract,
  ContractValidationError,
  RegulatedDomainError,
} from '../../src/CapabilityRouter'
import type { SkillContract, AttachmentHint } from '@airia/types'

describe('CapabilityRouter', () => {
  let router: CapabilityRouterImpl

  beforeEach(() => {
    router = new CapabilityRouterImpl()
  })

  // ─── Rules pass ──────────────────────────────────────────────────────────

  describe('rules pass', () => {
    it('routes image attachments to vision', () => {
      const attachments: AttachmentHint[] = [{ type: 'image', mimeType: 'image/png' }]
      const result = router.route('what is this', attachments)
      expect(result.capability).toBe('vision')
      expect(result.method).toBe('rules')
      expect(result.modelName).toBe('qwen2.5-vl')
    })

    it('routes code fences to code', () => {
      const query = 'fix this bug:\n```typescript\nconst x: number = "hello"\n```'
      const result = router.route(query)
      expect(result.capability).toBe('code')
      expect(result.method).toBe('rules')
      expect(result.modelName).toBe('qwen2.5-coder')
    })

    it('routes stacktraces to code', () => {
      const query = 'why am I getting this?\nTypeError: Cannot read property of undefined\n  at Object.handler (/app/server.ts:42:12)'
      const result = router.route(query)
      expect(result.capability).toBe('code')
      expect(result.method).toBe('rules')
    })

    it('routes source-file extensions to code', () => {
      const query = 'review the changes in app/components/Header.tsx and fix any type errors'
      const result = router.route(query)
      expect(result.capability).toBe('code')
      expect(result.method).toBe('rules')
    })

    it('routes an attached PDF to vision', () => {
      const result = router.route('summarise this', [
        { type: 'file', mimeType: 'application/pdf', filename: 'contract.pdf' },
      ])
      expect(result.capability).toBe('vision')
      expect(result.method).toBe('rules')
    })

    it('routes an attached slide deck to vision by extension alone', () => {
      const result = router.route('what does this cover', [
        { type: 'file', filename: 'q3-review.pptx' },
      ])
      expect(result.capability).toBe('vision')
    })

    it('routes an attached source file to code', () => {
      const result = router.route('take a look', [
        { type: 'file', mimeType: 'text/x-python', filename: 'train.py' },
      ])
      expect(result.capability).toBe('code')
      expect(result.method).toBe('rules')
    })

    it('prefers vision when a visual doc and a source file are attached together', () => {
      const result = router.route('go through these', [
        { type: 'file', filename: 'utils.ts' },
        { type: 'file', filename: 'architecture.pdf' },
      ])
      expect(result.capability).toBe('vision')
    })

    it('leaves plain-text attachments to the semantic pass', () => {
      const result = router.route('help me plan the rollout', [
        { type: 'file', mimeType: 'text/plain', filename: 'notes.txt' },
      ])
      expect(result.capability).toBe('reason')
      expect(result.method).not.toBe('rules')
    })

    it('rules pass takes precedence over semantic', () => {
      const attachments: AttachmentHint[] = [{ type: 'image' }]
      // Query text is about code, but attachment is an image → vision wins
      const result = router.route('fix the bug in this screenshot', attachments)
      expect(result.capability).toBe('vision')
      expect(result.method).toBe('rules')
    })
  })

  // ─── Semantic pass ───────────────────────────────────────────────────────

  describe('semantic pass', () => {
    it('routes code-like queries via semantic when rules miss', () => {
      const result = router.route('write unit tests for the user service')
      expect(result.capability).toBe('code')
      expect(result.method).toBe('semantic')
    })

    it('routes reasoning queries to reason', () => {
      const result = router.route('what are the pros and cons of microservices')
      expect(result.capability).toBe('reason')
      // Could be semantic or default depending on score
      expect(['semantic', 'default']).toContain(result.method)
    })
  })

  // ─── Default-to-reason ─────────────────────────────────────────────────

  describe('default-to-reason', () => {
    it('defaults to reason for ambiguous queries', () => {
      const result = router.route('hello, how are you today?')
      expect(result.capability).toBe('reason')
      expect(result.method).toBe('default')
      expect(result.modelName).toBe('gemma3:12b')
    })

    it('defaults to reason for very short queries', () => {
      const result = router.route('hi')
      expect(result.capability).toBe('reason')
      expect(result.method).toBe('default')
    })
  })

  // ─── Threshold boundary ────────────────────────────────────────────────

  describe('threshold boundary', () => {
    it('returns semantic match above threshold 0.62', () => {
      // Direct exemplar match → high similarity
      const result = router.route('describe this image for me please')
      expect(result.score).toBeGreaterThanOrEqual(0.62)
      if (result.method === 'semantic') {
        expect(result.capability).toBe('vision')
      }
    })

    it('falls back to default below threshold', () => {
      const result = router.route('supercalifragilisticexpialidocious')
      expect(result.method).toBe('default')
      expect(result.capability).toBe('reason')
    })
  })

  // ─── Extensible registry ───────────────────────────────────────────────

  describe('registry', () => {
    it('allows registering new capability models', () => {
      router.registerCapability(
        { capability: 'code', modelName: 'deepseek-coder:33b', priority: 1 },
        ['write a function', 'debug this code'],
      )
      const entry = router.getRegistry().get('code')
      expect(entry?.modelName).toBe('deepseek-coder:33b')
    })

    it('uses registered model after override', () => {
      router.registerCapability({ capability: 'vision', modelName: 'llava:13b', priority: 1 })
      const result = router.route('look at this', [{ type: 'image' }])
      expect(result.modelName).toBe('llava:13b')
    })
  })

  // ─── Routing log ──────────────────────────────────────────────────────

  describe('logging', () => {
    it('logs every routing decision', () => {
      router.route('hello')
      router.route('fix this bug:\n```\ncode\n```')
      expect(router.getLog()).toHaveLength(2)
      expect(router.getLog()[0].query).toBe('hello')
      expect(router.getLog()[1].capability).toBe('code')
    })

    it('records outcome against logged decisions', () => {
      const decision = router.route('hello')
      router.recordOutcome(decision.timestamp, 'success')
      expect(router.getLog()[0].outcome).toBe('success')
    })
  })
})

// ─── Contract validation ─────────────────────────────────────────────────────

describe('SkillContract validation', () => {
  const validInformational: SkillContract = {
    skillId: 'conversation_search',
    riskTier: 'informational',
    grounding: { retrievalScoreFloor: 0, citationsRequired: false, allowModelRecall: true },
    output: { disclaimerInjection: false, refusalOnLowConfidence: false },
    gate: { requiresUserAck: false, auditLog: false, humanReviewBeforePublish: false },
  }

  it('accepts a valid informational contract', () => {
    expect(() => validateSkillContract(validInformational)).not.toThrow()
  })

  it('accepts a contract that tightens policies', () => {
    const tighter: SkillContract = {
      ...validInformational,
      grounding: { retrievalScoreFloor: 0.5, citationsRequired: true, allowModelRecall: false },
      output: { disclaimerInjection: true, refusalOnLowConfidence: true },
      gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: true },
    }
    expect(() => validateSkillContract(tighter)).not.toThrow()
  })

  it('rejects a consequential contract that loosens disclaimerInjection', () => {
    const loose: SkillContract = {
      skillId: 'fine_tune',
      riskTier: 'consequential',
      grounding: { retrievalScoreFloor: 0.4, citationsRequired: false, allowModelRecall: true },
      output: { disclaimerInjection: false, refusalOnLowConfidence: false },
      gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: false },
    }
    expect(() => validateSkillContract(loose)).toThrow(ContractValidationError)
    try { validateSkillContract(loose) } catch (e) {
      expect((e as ContractValidationError).violations).toContain('disclaimerInjection cannot be loosened from tier default')
    }
  })

  it('rejects a regulated contract that loosens allowModelRecall', () => {
    const loose: SkillContract = {
      skillId: 'adapter_registry',
      riskTier: 'regulated',
      grounding: { retrievalScoreFloor: 0.7, citationsRequired: true, allowModelRecall: true },
      output: { disclaimerInjection: true, refusalOnLowConfidence: true },
      gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: true },
      corpusId: 'medical-corpus',
    }
    expect(() => validateSkillContract(loose)).toThrow(ContractValidationError)
  })

  it('rejects a regulated contract that lowers retrievalScoreFloor', () => {
    const loose: SkillContract = {
      skillId: 'adapter_registry',
      riskTier: 'regulated',
      grounding: { retrievalScoreFloor: 0.3, citationsRequired: true, allowModelRecall: false },
      output: { disclaimerInjection: true, refusalOnLowConfidence: true },
      gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: true },
      corpusId: 'legal-corpus',
    }
    expect(() => validateSkillContract(loose)).toThrow(ContractValidationError)
  })

  it('rejects a regulated contract without a corpusId', () => {
    const noCorpus: SkillContract = {
      skillId: 'advanced_context',
      riskTier: 'regulated',
      grounding: { retrievalScoreFloor: 0.7, citationsRequired: true, allowModelRecall: false },
      output: { disclaimerInjection: true, refusalOnLowConfidence: true },
      gate: { requiresUserAck: true, auditLog: true, humanReviewBeforePublish: true },
    }
    expect(() => validateSkillContract(noCorpus)).toThrow(ContractValidationError)
    try { validateSkillContract(noCorpus) } catch (e) {
      expect((e as ContractValidationError).violations).toContain(
        'regulated skills must specify a corpusId — cannot answer from model weights alone'
      )
    }
  })

  it('collects multiple violations in a single throw', () => {
    const veryLoose: SkillContract = {
      skillId: 'fine_tune',
      riskTier: 'regulated',
      grounding: { retrievalScoreFloor: 0.1, citationsRequired: false, allowModelRecall: true },
      output: { disclaimerInjection: false, refusalOnLowConfidence: false },
      gate: { requiresUserAck: false, auditLog: false, humanReviewBeforePublish: false },
    }
    try { validateSkillContract(veryLoose) } catch (e) {
      const err = e as ContractValidationError
      expect(err.violations.length).toBeGreaterThanOrEqual(8)
    }
  })
})

// ─── Unsafe-fallback guard ───────────────────────────────────────────────────

describe('Unsafe-fallback guard', () => {
  let router: CapabilityRouterImpl

  beforeEach(() => {
    router = new CapabilityRouterImpl()
  })

  it('throws RegulatedDomainError for medical queries with no grounded skill', () => {
    expect(() => router.route('what is the recommended dosage for metformin'))
      .toThrow(RegulatedDomainError)
  })

  it('throws for legal advice queries', () => {
    expect(() => router.route('can you give me legal advice on this contract'))
      .toThrow(RegulatedDomainError)
  })

  it('throws for compliance queries', () => {
    expect(() => router.route('help me with our HIPAA compliance audit'))
      .toThrow(RegulatedDomainError)
  })

  it('does NOT throw when a grounded skill is registered for the domain', () => {
    router.registerGroundedSkill('medical')
    expect(() => router.route('what is the recommended dosage for metformin'))
      .not.toThrow()
  })

  it('includes the domain name in the error', () => {
    try {
      router.route('provide medical diagnosis for these symptoms')
    } catch (e) {
      expect((e as RegulatedDomainError).domain).toBe('medical')
    }
  })

  it('uses the product voice — not robotic', () => {
    try {
      router.route('give me legal advice')
    } catch (e) {
      const msg = (e as RegulatedDomainError).message
      expect(msg).toContain('grounded')
      expect(msg).toContain('honest')
      expect(msg).not.toContain('Error:')
    }
  })
})
