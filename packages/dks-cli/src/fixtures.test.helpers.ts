/**
 * Test-only fixtures: deterministic OKF bundles, backup archives, and skill
 * trees on real tmpdirs, built with `node:fs/promises`.
 *
 * This module is excluded from the package build (tsconfig.build.json) and
 * exists only for vitest. Runtime sources go exclusively through the
 * reviewed FsPort (LESSON-063); no runtime code may import this file.
 */

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Bundle-relative ids of the three seeded concepts. */
export const SEED_GRAPH_PERF_ID = 'notes/graph-perf'
export const SEED_BACKUPS_ID = 'notes/backups'
export const SEED_ORPHAN_ID = 'notes/orphan'

/** Runs `run` inside a self-cleaning temp directory. */
export const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'dks-cli-'))
  try {
    return await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const GRAPH_PERF_MD = `---
title: Graph performance
type: Concept
description: How the graph scales.
aliases: [graph-perf]
tags: [graph, perf]
sources:
  - id: bench
    resource: bench/baseline.json
    title: Performance baseline
verified:
  - by: human:ada
---

Graph rendering stays smooth at 60fps under load.

# Claims
- Virtualized nodes keep rendering at 60fps [^bench]
- Unverified claim without a source

[^bench]: bench/baseline.json

# Related
* [Backups](/notes/backups.md)
`

const BACKUPS_MD = `---
title: Backups
type: Note
description: Backup integrity model.
tags: [backup]
---

Encrypted backups verify checksums before decrypting.

# Claims
- Tampered archives fail with a checksum error

# Related
* [Graph performance](/notes/graph-perf.md)
`

const ORPHAN_MD = `---
title: Orphan
type: Idea
description: Nothing links here.
tags: [orphan]
---

A standalone idea with no relations.
`

/** Seeds a 3-concept OKF bundle (1 warning-free, deterministic ids). */
export const seedBundle = async (dir: string, options: { skipIndex?: boolean; version?: string } = {}): Promise<string> => {
  const bundle = join(dir, 'bundle')
  await mkdir(join(bundle, 'notes'), { recursive: true })
  await writeFile(join(bundle, 'notes', 'graph-perf.md'), GRAPH_PERF_MD, 'utf8')
  await writeFile(join(bundle, 'notes', 'backups.md'), BACKUPS_MD, 'utf8')
  await writeFile(join(bundle, 'notes', 'orphan.md'), ORPHAN_MD, 'utf8')
  if (options.skipIndex !== true) {
    const version = options.version ?? '0.2'
    await writeFile(join(bundle, 'index.md'), `---\nokf_version: '${version}'\n---\n\n# Index\n`, 'utf8')
  }
  return bundle
}

/** Seeds a warning-producing bundle: one concept without frontmatter. */
export const seedBundleWithUnparsableConcept = async (dir: string): Promise<string> => {
  const bundle = await seedBundle(dir)
  await writeFile(join(bundle, 'notes', 'raw.md'), 'no frontmatter here\n', 'utf8')
  return bundle
}

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const ENTITIES_JSON = JSON.stringify({ entities: [{ id: 'e1', name: 'One' }] })
const CLAIMS_JSON = JSON.stringify({ claims: [{ id: 'c1', entityId: 'e1', statement: 'One exists' }] })
const CANVAS_JSON = JSON.stringify({ graph: { nodes: [{ id: 'e1' }] }, tags: ['t'] })

export interface BackupFixture {
  path: string
  manifestFiles: { path: string; bytes: number; sha256: string }[]
}

/** Writes a structurally valid unencrypted `.dksb` archive. */
export const writeBackupArchive = async (dir: string, name = 'backup.dksb'): Promise<BackupFixture> => {
  const files: Record<string, string> = {
    'data/entities.json': ENTITIES_JSON,
    'data/claims.json': CLAIMS_JSON,
    'data/canvas.json': CANVAS_JSON,
  }
  const manifestFiles = await Promise.all(Object.entries(files).map(async ([path, content]) => ({
    path,
    bytes: content.length,
    sha256: await sha256Hex(content),
  })))
  const archive = {
    format: 'do-knowledge-studio-backup',
    formatVersion: 1,
    encryption: null,
    manifest: {
      format: 'do-knowledge-studio-backup',
      formatVersion: 1,
      schemaVersion: 1,
      appVersion: '0.2.0',
      exportedAt: '2026-11-18T00:00:00.000Z',
      counts: { entities: 1, claims: 1, graphNodes: 1, graphEdges: 0, mindMapNodes: 0, mindMapEdges: 0, links: 0, tags: 1 },
      files: manifestFiles,
    },
    files,
  }
  const path = join(dir, name)
  await writeFile(path, JSON.stringify(archive), 'utf8')
  return { path, manifestFiles }
}

/** Overwrites one payload file after hashing (tamper simulation). */
export const tamperBackupArchive = async (fixture: BackupFixture): Promise<void> => {
  const archive = JSON.parse(await readFile(fixture.path, 'utf8')) as { files: Record<string, string> }
  archive.files['data/claims.json'] = JSON.stringify({ claims: [{ id: 'c1', entityId: 'e1', statement: 'TAMPERED' }] })
  await writeFile(fixture.path, JSON.stringify(archive), 'utf8')
}

/**
 * Writes an archive whose header passes validation up to the passphrase
 * check: a genuinely encrypted look with a self-consistent ciphertext hash
 * but a payload no passphrase can decrypt.
 */
export const writeEncryptedBackupArchive = async (dir: string): Promise<BackupFixture> => {
  const fixture = await writeBackupArchive(dir, 'encrypted.dksb')
  const ciphertext = new Uint8Array([1, 2, 3, 4])
  const digest = await globalThis.crypto.subtle.digest('SHA-256', ciphertext)
  const ciphertextSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const base64 = (bytes: Uint8Array): string => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  const archive = JSON.parse(await readFile(fixture.path, 'utf8')) as Record<string, unknown>
  archive.encryption = {
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-HMAC-SHA256',
    iterations: 310_000,
    salt: base64(new TextEncoder().encode('salt')),
    iv: base64(new TextEncoder().encode('iv')),
    ciphertextSha256,
  }
  archive.ciphertext = base64(ciphertext)
  await writeFile(fixture.path, JSON.stringify(archive), 'utf8')
  return fixture
}

export interface SkillFixtureOptions {
  frontmatter?: string
  body?: string
  skillMd?: string
  /** When set, points an existing file as a dangling symlink target. */
  symlinkDirName?: string
}

const DEFAULT_SKILL_FRONTMATTER = 'name: sample\ndescription: Sample skill for tests\n'
const DEFAULT_SKILL_BODY = 'Run `scripts/sample.sh` and read `references/notes.md`.\n'

/** Writes one skill directory under `.agents/skills` inside `root`. */
export const writeSkill = async (root: string, name: string, options: SkillFixtureOptions = {}): Promise<void> => {
  const skillDir = join(root, '.agents', 'skills', name)
  await mkdir(skillDir, { recursive: true })
  const content = options.skillMd ?? `---\n${options.frontmatter ?? DEFAULT_SKILL_FRONTMATTER}---\n\n${options.body ?? DEFAULT_SKILL_BODY}\n`
  await writeFile(join(skillDir, 'SKILL.md'), content, 'utf8')
  if (options.body === undefined && options.skillMd === undefined) {
    const scripts = join(skillDir, 'scripts')
    await mkdir(scripts, { recursive: true })
    await writeFile(join(scripts, 'sample.sh'), '#!/usr/bin/env bash\necho sample\n', 'utf8')
    const references = join(skillDir, 'references')
    await mkdir(references, { recursive: true })
    await writeFile(join(references, 'notes.md'), 'notes\n', 'utf8')
  }
  if (options.symlinkDirName !== undefined) {
    await symlink(join(root, 'outside'), join(root, '.agents', 'skills', options.symlinkDirName), 'dir')
  }
}

/** Writes a `.agents/skills` tree with the default sample skill only. */
export const seedSkills = async (dir: string): Promise<string> => {
  await seedBundle(dir)
  await writeSkill(dir, 'sample')
  return join(dir, 'bundle')
}
