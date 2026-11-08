import { describe, expect, it, vi } from 'vitest'
import type { Entity } from '@/lib/studio/types'
import { findDuplicateEntity, nameSimilarity } from './dedupe'
import {
  buildExtractionMessages,
  clipExtractionInput,
  leavesDevice,
  parseExtractionResponse,
  runExtraction,
  toProvenance,
  verifyEvidenceSpan,
} from './extraction'
import { MAX_EXTRACTION_INPUT_CHARS, MAX_PROPOSED_CLAIMS } from './schema'

const NOTE_TEXT = 'Local-first software keeps the canonical copy on your device.'

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'note-1',
  name: 'Local-first notes',
  type: 'note',
  description: '',
  content: NOTE_TEXT,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const request = { provider: 'local' as const, model: 'test-model', apiKey: '' }

describe('parseExtractionResponse', () => {
  it('accepts a JSON object with entities and claims', () => {
    const raw = JSON.stringify({
      entities: [{ name: 'Local-first software', type: 'concept', description: 'd', evidence: NOTE_TEXT }],
      claims: [
        {
          statement: 'The canonical copy stays on the device.',
          entity: 'Local-first software',
          confidence: 0.9,
          evidence: 'keeps the canonical copy on your device',
        },
      ],
    })
    const result = parseExtractionResponse(raw, NOTE_TEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.knowledge.entities[0]?.name).toBe('Local-first software')
    expect(result.knowledge.claims[0]?.confidence).toBe(0.9)
    expect(result.knowledge.claims[0]?.evidence).toBe('keeps the canonical copy on your device')
  })

  it('strips a code fence and surrounding prose', () => {
    const raw = 'Here you go:\n```json\n{"entities":[{"name":"Thing"}],"claims":[]}\n```\nDone.'
    const result = parseExtractionResponse(raw, NOTE_TEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.knowledge.entities).toHaveLength(1)
    expect(result.knowledge.entities[0]?.entityType).toBe('concept')
  })

  it('rejects non-JSON output instead of guessing', () => {
    expect(parseExtractionResponse('no JSON here', NOTE_TEXT)).toEqual({
      ok: false,
      reason: 'not-json',
    })
  })

  it('rejects a schema mismatch', () => {
    expect(parseExtractionResponse('{"entities":"nope"}', NOTE_TEXT)).toEqual({
      ok: false,
      reason: 'schema',
    })
  })

  it('rejects an oversized response', () => {
    expect(parseExtractionResponse('x'.repeat(70_000), NOTE_TEXT)).toEqual({
      ok: false,
      reason: 'too-large',
    })
  })

  it('rejects more claims than the cap', () => {
    const claims = Array.from({ length: MAX_PROPOSED_CLAIMS + 1 }, (_, index) => ({
      statement: `claim ${index}`,
    }))
    expect(parseExtractionResponse(JSON.stringify({ entities: [], claims }), NOTE_TEXT)).toEqual({
      ok: false,
      reason: 'too-many',
    })
  })

  it('rejects a response with nothing usable', () => {
    expect(parseExtractionResponse('{"entities":[],"claims":[]}', NOTE_TEXT)).toEqual({
      ok: false,
      reason: 'empty',
    })
    expect(
      parseExtractionResponse('{"entities":[{"name":"  "}],"claims":[]}', NOTE_TEXT),
    ).toEqual({ ok: false, reason: 'empty' })
  })

  it('clamps confidence and drops evidence that is not quoted', () => {
    const raw = JSON.stringify({
      entities: [],
      claims: [{ statement: 'A claim', confidence: 4.2, evidence: 'not in the note' }],
    })
    const result = parseExtractionResponse(raw, NOTE_TEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.knowledge.claims[0]?.confidence).toBe(1)
    expect(result.knowledge.claims[0]?.evidence).toBe('')
  })
})

describe('verifyEvidenceSpan', () => {
  it('keeps a verbatim span and strips wrapping quotes', () => {
    expect(verifyEvidenceSpan('"on your device"', NOTE_TEXT)).toBe('on your device')
  })

  it('drops a paraphrase', () => {
    expect(verifyEvidenceSpan('on your own device', NOTE_TEXT)).toBe('')
  })
})

describe('buildExtractionMessages', () => {
  it('sends a JSON-only instruction with the trimmed note', () => {
    const messages = buildExtractionMessages('x'.repeat(MAX_EXTRACTION_INPUT_CHARS + 50))
    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('JSON')
    expect(messages[1]?.content.length).toBe(MAX_EXTRACTION_INPUT_CHARS)
  })

  it('trims the note before it can leave the device', () => {
    expect(clipExtractionInput('  short  ')).toBe('  short  ')
  })
})

describe('provenance and privacy', () => {
  it('prefixes the model with the ai: source marker', () => {
    expect(toProvenance('gpt-4o-mini')).toBe('ai:gpt-4o-mini')
  })

  it('only treats a remote provider as leaving the device', () => {
    expect(leavesDevice('openrouter')).toBe(true)
    expect(leavesDevice('ollama')).toBe(false)
    expect(leavesDevice('local')).toBe(false)
  })
})

describe('runExtraction', () => {
  it('returns pending proposals flagged against the corpus', async () => {
    const note = makeEntity()
    const existing = makeEntity({ id: 'existing', name: 'Local-first notes' })
    const result = await runExtraction({
      note,
      request,
      entities: [existing],
      now: '2026-02-02T00:00:00.000Z',
      send: async () => ({
        content: JSON.stringify({
          entities: [{ name: 'Local-first notes', evidence: 'on your device' }],
          claims: [{ statement: 'A claim', confidence: 0.4 }],
        }),
        provider: 'local',
        model: 'test-model',
      }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposals).toHaveLength(2)
    expect(result.proposals[0]?.status).toBe('pending')
    expect(result.proposals[0]?.duplicateOf).toBe('existing')
    expect(result.proposals[0]?.createdAt).toBe('2026-02-02T00:00:00.000Z')
    expect(result.proposals[1]?.kind).toBe('claim')
  })

  it('refuses an empty note without calling the provider', async () => {
    const send = vi.fn()
    const result = await runExtraction({
      note: makeEntity({ content: '   ' }),
      request,
      entities: [],
      send,
    })
    expect(result).toEqual({ ok: false, reason: 'empty-input' })
    expect(send).not.toHaveBeenCalled()
  })

  it('reports a provider failure as one safe reason', async () => {
    const result = await runExtraction({
      note: makeEntity(),
      request,
      entities: [],
      send: async () => {
        throw new Error('401 invalid api key sk-secret')
      },
    })
    expect(result).toEqual({ ok: false, reason: 'provider' })
  })

  it('rethrows an abort so the caller can stay silent', async () => {
    const controller = new AbortController()
    const promise = runExtraction({
      note: makeEntity(),
      request,
      entities: [],
      signal: controller.signal,
      send: async () => {
        controller.abort()
        throw new DOMException('aborted', 'AbortError')
      },
    })
    await expect(promise).rejects.toThrow()
  })
})

describe('duplicate detection', () => {
  const corpus: Entity[] = [
    makeEntity({ id: 'a', name: 'Local-first software' }),
    makeEntity({ id: 'b', name: 'Knowledge graph' }),
  ]

  it('matches an exact name regardless of case and spacing', () => {
    expect(findDuplicateEntity('  local-first   SOFTWARE ', corpus)?.id).toBe('a')
  })

  it('matches a near-identical name above the threshold', () => {
    expect(findDuplicateEntity('Local first software', corpus)?.id).toBe('a')
  })

  it('does not flag an unrelated name', () => {
    expect(findDuplicateEntity('Espresso brewing', corpus)).toBeNull()
  })

  it('scores identical token sets as 1', () => {
    expect(nameSimilarity('Knowledge graph', 'graph knowledge')).toBe(1)
  })
})
