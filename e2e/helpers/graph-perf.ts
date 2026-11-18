import type { Page } from '@playwright/test'
import type { PersistedStudioState } from './store'

/**
 * Shared large-graph benchmark harness (#1163).
 *
 * The pieces here are extracted from the original frame-timeline guard so the
 * 1k/5k/10k sweeps and the default 5k CI assertion run the exact same gesture
 * and sampler code. All measurements are software-rendered Chromium timings
 * unless the environment metadata says otherwise — never GPU or physical-device
 * numbers (see plans/perf-baselines.md).
 */

/** The #1053 frame target in milliseconds (1000/30). */
export const TARGET_FRAME_MS = 1000 / 30

/** Below this, a frame sample says nothing and the percentile list is empty. */
export const MIN_SAMPLED_FRAMES = 30

/** Regression ceilings, not the product target (see perf-baselines.md). */
export const PAN_P50_CEILING_MS = 120
export const PAN_P95_CEILING_MS = 1_500
export const ZOOM_P50_CEILING_MS = 120
export const ZOOM_P95_CEILING_MS = 1_500

/** Frames the app needs to finish progressive placement before a gesture. */
export const PLACEMENT_MAX_WAIT_MS = 90_000

/** Quiet period after placement, so its frames are never part of the sample. */
export const SETTLE_MS = 500

/** Quantiles reported: the typical frame, the slow tail, and the single worst. */
const QUANTILE_MEDIAN = 0.5
const QUANTILE_P95 = 0.95
const QUANTILE_MAX = 1

/** Drag steps per sampling phase — enough pointer moves to cover a real gesture. */
const DRAG_STEPS = 48

/** Pixels per drag step; small enough to read as a drag, not a jump. */
const DRAG_STEP_PX = 3

/** Wheel-zoom events per phase; enough that the sample clears the minimum. */
const ZOOM_STEPS = 24

/** Wheel delta per event. */
const ZOOM_DELTA_Y = 25

/** In-page sampler handle; the name is shared between the injected scripts. */
const SAMPLER_KEY = '__dksFrameSampler'

/** Shape of the sampler the page keeps between `page.evaluate` calls. */
interface FrameSampler {
  deltas: number[]
  handle: number | null
}

/** Browser/OS/hardware context a measurement was taken under. */
export interface BenchEnvironment {
  userAgent: string
  platform: string
  deviceMemory: number | null
  hardwareConcurrency: number | null
  viewport: { width: number; height: number }
}

/** Heap snapshot via the Chromium metrics API; null when unavailable. */
export interface HeapSample {
  jsHeapUsedSize: number | null
  jsHeapTotalSize: number | null
}

/** Distribution summary used both for reporting and for the assertions. */
export interface FrameSummary {
  frames: number
  p50: number
  p95: number
  worst: number
  /** Frames slower than the 30 fps budget (dropped-frame proxy). */
  overBudget: number
  overBudgetFraction: number
  text: string
}

/** Sorted percentile of a sample, linearly interpolated between neighbours. */
export const percentile = (sample: number[], fraction: number): number => {
  if (sample.length === 0) return Number.NaN
  const sorted = [...sample].sort((a, b) => a - b)
  const position = (sorted.length - 1) * fraction
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex]
  const upper = sorted[upperIndex]
  if (lower === undefined || upper === undefined) return Number.NaN
  return lower + (upper - lower) * (position - lowerIndex)
}

/** Describe a frame-interval sample. */
export const summarize = (deltas: number[]): FrameSummary => {
  const p50 = percentile(deltas, QUANTILE_MEDIAN)
  const p95 = percentile(deltas, QUANTILE_P95)
  const worst = percentile(deltas, QUANTILE_MAX)
  const overBudget = deltas.filter((delta) => delta > TARGET_FRAME_MS).length
  return {
    frames: deltas.length,
    p50,
    p95,
    worst,
    overBudget,
    overBudgetFraction: deltas.length === 0 ? Number.NaN : overBudget / deltas.length,
    text:
      `frames=${deltas.length} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms ` +
      `worst=${worst.toFixed(1)}ms over30fps=${overBudget}`,
  }
}

/** Start recording the interval between animation frames. */
export const startFrameSampling = async (page: Page): Promise<void> => {
  await page.evaluate((key) => {
    const scope = globalThis as unknown as Record<string, FrameSampler>
    const sampler: FrameSampler = { deltas: [], handle: null }
    scope[key] = sampler
    let last = performance.now()
    const tick = (now: number): void => {
      sampler.deltas.push(now - last)
      last = now
      sampler.handle = requestAnimationFrame(tick)
    }
    sampler.handle = requestAnimationFrame(tick)
  }, SAMPLER_KEY)
}

/** Stop recording and return every frame interval the page observed. */
export const stopFrameSampling = async (page: Page): Promise<number[]> => {
  return page.evaluate((key) => {
    const scope = globalThis as unknown as Record<string, FrameSampler>
    const sampler = scope[key]
    if (sampler === null || sampler === undefined) return []
    if (sampler.handle !== null) cancelAnimationFrame(sampler.handle)
    delete scope[key]
    return sampler.deltas
  }, SAMPLER_KEY)
}

/**
 * The seeded library: `nodeCount` entities with `linksPerNode` outgoing links,
 * a spread of entity types and tags, and rich-enough labels to exercise the
 * renderer's LOD paths.
 */
export const buildSeededEntities = (
  nodeCount: number,
  linksPerNode = 2,
): PersistedStudioState['entities'] => {
  const types = ['note', 'concept', 'person', 'project']
  const tags = ['triz', 'innovation', 'method', 'pkm', 'search', 'ai']
  return Array.from({ length: nodeCount }, (_, index) => ({
    id: `frame-${index}`,
    name: `Frame node ${index}`,
    type: types[index % types.length]!,
    description: `Seeded node ${index} for the frame-timeline guard`,
    content: '',
    tags: [tags[index % tags.length]!],
    aliases: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-15T00:00:00Z',
    links: Array.from({ length: linksPerNode }, (_, linkIndex) => ({
      targetId: `frame-${(index + linkIndex + 1) % nodeCount}`,
      relation: 'relates_to',
    })),
  }))
}

/** Wait until progressive placement stops reporting progress. */
export const waitForPlacement = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('svg[aria-label^="Knowledge graph"]')
      if (canvas === null) return false
      const status = document.querySelector('[role="status"]')
      if (status === null) return true
      return !(status.textContent ?? '').includes('Placing nodes')
    },
    undefined,
    { timeout: PLACEMENT_MAX_WAIT_MS },
  )
}

/** Drag the canvas horizontally for `DRAG_STEPS` pointer moves. */
export const dragCanvas = async (
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> => {
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    const direction = step % 2 === 0 ? 1 : -1
    await page.mouse.move(centerX + direction * step * DRAG_STEP_PX, centerY)
  }
  await page.mouse.up()
}

/** Wheel-zoom in and out at the canvas centre. */
export const zoomCanvas = async (
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> => {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let step = 0; step < ZOOM_STEPS; step += 1) {
    await page.mouse.wheel(0, step % 2 === 0 ? -ZOOM_DELTA_Y : ZOOM_DELTA_Y)
  }
}

/** Records the browser/OS/hardware context a benchmark ran under. */
export const recordEnvironment = async (page: Page): Promise<BenchEnvironment> => {
  const navigatorInfo = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? '',
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  }))
  const viewport = page.viewportSize() ?? { width: 0, height: 0 }
  return { ...navigatorInfo, viewport }
}

/** Samples renderer heap through CDP; non-Chromium engines report nulls. */
export const sampleHeap = async (page: Page): Promise<HeapSample> => {
  try {
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Performance.enable')
      const { metrics } = await session.send('Performance.getMetrics')
      const value = (name: string): number | null =>
        metrics.find((metric) => metric.name === name)?.value ?? null
      return {
        jsHeapUsedSize: value('JSHeapUsedSize'),
        jsHeapTotalSize: value('JSHeapTotalSize'),
      }
    } finally {
      await session.detach()
    }
  } catch {
    return { jsHeapUsedSize: null, jsHeapTotalSize: null }
  }
}
