import { describe, it, expect } from 'vitest'
import { parseOkfBundle } from './import'

describe('OKF Bundle Import', () => {
  it('correctly parses an OKF bundle round-trip', () => {
    const filesMap = new Map<string, string>()
    filesMap.set('index.md', '---\nokf_version: "0.2"\n---\n# Knowledge Bundle')
    filesMap.set('log.md', '# Directory Update Log\n\n## 2026-07-24\n* Updated')
    filesMap.set(
      'concepts/google-cloud-platform.md',
      `---
type: Concept
title: Google Cloud Platform
description: A suite of cloud computing services.
tags:
  - cloud
  - google
sources:
  - id: src-1
    resource: https://github.com/GoogleCloudPlatform/knowledge-catalog
    title: Announcement blog post
status: stable
generated:
  by: do-knowledge-studio/0.1.0
  at: 2026-07-24T00:00:00.000Z
---

Google Cloud Platform provides infrastructure as a service.

# Claims

- OKF v0.2 was released in July 2026.[^src-1]

[^src-1]: Announcement blog post
`,
    )

    const result = parseOkfBundle(filesMap)
    expect(result.errors.length).toBe(0)
    expect(result.entities.length).toBe(1)
    expect(result.claims.length).toBe(1)

    const entity = result.entities[0]
    expect(entity.id).toBe('concepts/google-cloud-platform')
    expect(entity.name).toBe('Google Cloud Platform')
    expect(entity.type).toBe('concept')
    expect(entity.description).toBe('A suite of cloud computing services.')
    expect(entity.tags).toEqual(['cloud', 'google'])

    const claim = result.claims[0]
    expect(claim.entityId).toBe('concepts/google-cloud-platform')
    expect(claim.statement).toBe('OKF v0.2 was released in July 2026.')
    expect(claim.source).toBe('https://github.com/GoogleCloudPlatform/knowledge-catalog')
    expect(claim.evidence).toBe('Announcement blog post')
  })

  it('tolerates unknown types, unknown frontmatter keys, and missing optional fields', () => {
    const filesMap = new Map<string, string>()
    filesMap.set(
      'concepts/unknown-type.md',
      `---
type: SuperSpecialNewType
title: Unknown Type Title
something_unknown: value
---

Body
`,
    )

    const result = parseOkfBundle(filesMap)
    expect(result.errors.length).toBe(0)
    expect(result.entities.length).toBe(1)

    const entity = result.entities[0]
    expect(entity.type).toBe('concept') // fallbacks to concept
    expect(entity.name).toBe('Unknown Type Title')
  })

  it('derives claim verification from the concept trust tier, never hardcodes it', () => {
    const makeBundle = (verifiedYaml: string) =>
      new Map<string, string>([[
        'concepts/verified-concept.md',
        `---
type: Concept
title: Verified Concept
${verifiedYaml}---

Body text.

# Claims

- This claim is backed by a human review.
`,
      ]])

    const humanVerified = parseOkfBundle(
      makeBundle('verified:\n  - by: human:jules\n    at: 2026-07-24T00:00:00Z\n'),
    )
    expect(humanVerified.claims[0].verification).toBe('verified')

    const machineOnly = parseOkfBundle(
      makeBundle('verified:\n  - by: process:automated-scanner\n    at: 2026-07-24T00:00:00Z\n'),
    )
    expect(machineOnly.claims[0].verification).toBe('unverified')

    const noVerification = parseOkfBundle(makeBundle(''))
    expect(noVerification.claims[0].verification).toBe('unverified')
  })

  it('fails gracefully on invalid yaml or missing frontmatter', () => {
    const filesMap = new Map<string, string>()
    filesMap.set('concepts/invalid.md', 'Just some random markdown content without frontmatter block.')

    const result = parseOkfBundle(filesMap)
    expect(result.entities.length).toBe(0)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toContain('missing or unparseable frontmatter')
  })
})
