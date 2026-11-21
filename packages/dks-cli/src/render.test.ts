import { describe, expect, it } from 'vitest'
import { HELP_TEXT, helpData } from './commands/help.js'
import { renderErrorText, renderPayloadText } from './render.js'

describe('renderPayloadText — static commands', () => {
  it('renders help from documented data', () => {
    const text = renderPayloadText('help', helpData())
    expect(text).toBe(HELP_TEXT)
    expect(text).toContain('commands:')
    expect(text).toContain('doctor')
    expect(text).toContain('--format')
  })

  it('renders bare-dks as help', () => {
    expect(renderPayloadText('help', helpData())).toContain('read-only OKF bundle operator CLI')
  })

  it('renders version identity', () => {
    const text = renderPayloadText('version', { version: '9.9.9', name: 'dks-cli', node: 'v22.0.0' })
    expect(text).toBe('dks-cli 9.9.9 (node v22.0.0)')
  })
})

describe('renderPayloadText — data commands', () => {
  it('renders search hits with score, name, and snippet', () => {
    const text = renderPayloadText('search', {
      query: 'graph',
      limit: 20,
      results: [
        { id: 'notes/graph-perf', type: 'entity', name: 'Graph performance', snippet: 'Graph rendering stays smooth', score: 0.802 },
        { id: 'notes/graph-perf#claim-1', type: 'claim', name: 'Graph performance', snippet: 'Virtualized nodes', score: 0.54, entityId: 'notes/graph-perf', entityName: 'Graph performance' },
      ],
    })
    expect(text).toContain('search: "graph" — 2 hit(s) (limit 20)')
    expect(text).toContain('[0.802] Graph performance — notes/graph-perf')
    expect(text).toContain('claim in Graph performance (notes/graph-perf)')
    expect(text).toContain('Virtualized nodes')
  })

  it('renders doctor checks and warnings', () => {
    const text = renderPayloadText('doctor', {
      bundle: { path: '/tmp/bundle', kind: 'directory', declaredOkfVersion: '0.2', supportedOkfVersion: '0.2' },
      counts: { entities: 3, claims: 2, warnings: 1 },
      checks: [
        { id: 'bundle-present', ok: true, detail: 'directory at /tmp/bundle' },
        { id: 'engine-intl-segmenter', ok: false, detail: 'unavailable' },
      ],
      warnings: ['notes/raw.md: no readable frontmatter and was skipped.'],
      engine: { node: 'v22', intlSegmenter: false },
      healthy: false,
    })
    expect(text).toContain('bundle: /tmp/bundle (directory)')
    expect(text).toContain('[ok] bundle-present')
    expect(text).toContain('[FAIL] engine-intl-segmenter')
    expect(text).toContain('healthy: no')
    expect(text).toContain('warnings:')
  })

  it('renders graph stats with types and orphans', () => {
    const text = renderPayloadText('graph', {
      nodes: 2,
      edges: 1,
      types: [{ type: 'Note', count: 2 }],
      orphans: 1,
      orphanIds: ['notes/lone'],
    })
    expect(text).toContain('edges (undirected): 1')
    expect(text).toContain('  - Note: 2')
    expect(text).toContain('  orphan: notes/lone')
  })

  it('renders index pagination header', () => {
    const text = renderPayloadText('index', { total: 4, shown: 2, items: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] })
    expect(text).toContain('entities (2 shown of 4):')
    expect(text).toContain('  a — A')
  })

  it('renders export markdown passthrough', () => {
    const text = renderPayloadText('export', { rendered: '# content\n' })
    expect(text).toBe('# content\n')
  })
})

describe('renderErrorText', () => {
  it('prefixes the command and appends the hint', () => {
    const text = renderErrorText('entity', 'unknown entity id "x"', 'run "dks index"')
    expect(text).toBe('dks entity: unknown entity id "x"\nhint: run "dks index"')
  })

  it('opens with the label the runner passes for an unparsed command', () => {
    const text = renderErrorText('(none)', 'bad flag', undefined)
    expect(text).toBe('dks (none): bad flag')
    expect(text).not.toContain('hint:')
  })
})
