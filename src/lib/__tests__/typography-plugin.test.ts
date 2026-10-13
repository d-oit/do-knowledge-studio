import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The editor preview and the chat bubbles render Markdown inside `prose`
 * classes, and those classes do nothing unless `@tailwindcss/typography` is
 * both declared in the stylesheet and installed. It was missing from both, so
 * the preview shipped unstyled and nothing failed (plans/166 N1).
 *
 * This guards the wiring; the rendered result — that the plugin's scale is
 * actually applied — is asserted in `e2e/markdown-preview.spec.ts`.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..')

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8')

describe('markdown typography wiring', () => {
  it('declares the typography plugin after the stylesheet imports', () => {
    const css = read(join('src', 'app', 'globals.css'))
    const pluginIndex = css.search(/@plugin\s+"@tailwindcss\/typography"/)
    expect(pluginIndex).toBeGreaterThan(-1)

    // CSS requires `@import` to precede every other at-rule; a plugin declared
    // between the imports is dropped by the parser.
    const lastImport = css.lastIndexOf('@import')
    expect(lastImport).toBeLessThan(pluginIndex)
  })

  it('lists the plugin as an installed dependency', () => {
    const manifest = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declared = { ...manifest.dependencies, ...manifest.devDependencies }
    expect(Object.keys(declared)).toContain('@tailwindcss/typography')
  })

  it('keeps the Markdown surfaces on the prose classes', () => {
    // The plugin only styles what carries `prose`; dropping the class would
    // silently return the preview and the chat to unstyled output.
    for (const file of [
      join('src', 'components', 'studio', 'views', 'editor-preview.tsx'),
      join('src', 'components', 'studio', 'views', 'chat-subcomponents.tsx'),
    ]) {
      expect(read(file)).toMatch(/className="[^"]*\bprose\b/)
    }
  })
})
