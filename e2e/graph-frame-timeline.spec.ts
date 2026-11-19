import { test, expect, type Page } from '@playwright/test'
import { navClick } from './helpers/navigation'
import { seedStore } from './helpers/store'
import {
  MIN_SAMPLED_FRAMES,
  PAN_P50_CEILING_MS,
  PAN_P95_CEILING_MS,
  SETTLE_MS,
  ZOOM_P50_CEILING_MS,
  ZOOM_P95_CEILING_MS,
  buildSeededEntities,
  dragCanvas,
  recordEnvironment,
  sampleHeap,
  startFrameSampling,
  stopFrameSampling,
  summarize,
  waitForPlacement,
  zoomCanvas,
} from './helpers/graph-perf'

/**
 * Graph frame-timeline guard (plans/198 "Known gap", plans/207, plans/211).
 *
 * Seeds a large library through the shared store fixture, waits for progressive
 * placement, then records the real interval between animation frames while a
 * drag runs and, separately, while a wheel zoom runs. The numbers are printed
 * with the browser/OS/hardware context they were measured under; the ceilings
 * are regression floors, not product targets (see plans/perf-baselines.md).
 *
 * The default run asserts the 5k case. Set GRAPH_BENCH_SIZES (e.g.
 * "1,5,10" for 1k/5k/10k) to sweep every size with the same gestures.
 */

/** The seeded size the CI floors are recorded at. */
const DEFAULT_NODE_COUNT = 5000

/** Node counts to sweep when GRAPH_BENCH_SIZES is set (values in thousands). */
const readSweepSizes = (): number[] => {
  const raw = process.env.GRAPH_BENCH_SIZES
  if (!raw) return []
  return raw.split(',').flatMap((part) => {
    const thousands = Number(part.trim())
    return Number.isFinite(thousands) && thousands > 0 ? [thousands * 1000] : []
  })
}

const measureFrameTimeline = (nodeCount: number) => async ({ page }: { page: Page }): Promise<void> => {
  test.setTimeout(180_000)
  const svg = page.locator('svg[aria-label^="Knowledge graph"]')

  await seedStore(page, { entities: buildSeededEntities(nodeCount) })
  await page.goto('/')
  await navClick(page, /graph/i)

  await waitForPlacement(page)
  await page.waitForTimeout(SETTLE_MS)

  const env = await recordEnvironment(page)
  const heapLoaded = await sampleHeap(page)

  const box = await svg.boundingBox()
  expect(box).not.toBeNull()
  if (box === null) return

  await startFrameSampling(page)
  await dragCanvas(page, box)
  const panDeltas = await stopFrameSampling(page)
  const heapAfterPan = await sampleHeap(page)
  const pan = summarize(panDeltas)

  await startFrameSampling(page)
  await zoomCanvas(page, box)
  const zoomDeltas = await stopFrameSampling(page)

  const zoom = summarize(zoomDeltas)
  // Printed, not merely annotated: the numbers are the deliverable, and a
  // failing run must say what the machine actually produced.
  console.log(
    `[frame-timeline] nodes=${nodeCount} env=${JSON.stringify(env)} ` +
      `heapLoaded=${JSON.stringify(heapLoaded)} heapAfterPan=${JSON.stringify(heapAfterPan)} ` +
      `pan=${pan.text} zoom=${zoom.text}`,
  )

  expect(pan.frames).toBeGreaterThanOrEqual(MIN_SAMPLED_FRAMES)
  expect(zoom.frames).toBeGreaterThanOrEqual(MIN_SAMPLED_FRAMES)
  expect(pan.p50).toBeLessThanOrEqual(PAN_P50_CEILING_MS)
  expect(zoom.p50).toBeLessThanOrEqual(ZOOM_P50_CEILING_MS)
  expect(pan.p95).toBeLessThanOrEqual(PAN_P95_CEILING_MS)
  expect(zoom.p95).toBeLessThanOrEqual(ZOOM_P95_CEILING_MS)
}

test.describe('Graph frame timeline at 5k nodes', () => {
  test('pan and zoom stay inside the recorded frame floors', async ({ page }) => {
    // A 5k corpus plus a real gesture outlives the suite-wide 30s timeout.
    test.setTimeout(180_000)
    const svg = page.locator('svg[aria-label^="Knowledge graph"]')

    await seedStore(page, { entities: buildSeededEntities(DEFAULT_NODE_COUNT) })
    await page.goto('/')
    await navClick(page, /graph/i)

    await expect(svg).toBeVisible()
    await waitForPlacement(page)
    await page.waitForTimeout(SETTLE_MS)

    const env = await recordEnvironment(page)
    const heapLoaded = await sampleHeap(page)

    const box = await svg.boundingBox()
    expect(box).not.toBeNull()
    if (box === null) return

    // Above the label threshold each node draws exactly one circle: the
    // decorative core dot is LOD-gated (plans/211). Re-adding it doubles the
    // per-node DOM, which the trace in plans/210 shows is what React spends
    // the frame on, so the shape is asserted rather than left to review.
    const nodeDom = await page.evaluate(() => {
      const canvas = document.querySelector('svg[aria-label^="Knowledge graph"]')
      if (canvas === null) return { nodes: 0, circles: 0, tabStops: 0 }
      return {
        nodes: canvas.querySelectorAll('g[role="button"]').length,
        circles: canvas.querySelectorAll('circle').length,
        // Roving tabindex: 5,000 nodes must not mean 5,000 tab stops
        // (plans/213).
        tabStops: canvas.querySelectorAll('g[role="button"][tabindex="0"]').length,
      }
    })
    expect(nodeDom.nodes).toBeGreaterThan(0)
    expect(nodeDom.circles).toBe(nodeDom.nodes)
    expect(nodeDom.tabStops).toBe(1)

    await startFrameSampling(page)
    await dragCanvas(page, box)
    const panDeltas = await stopFrameSampling(page)
    const heapAfterPan = await sampleHeap(page)

    await startFrameSampling(page)
    await zoomCanvas(page, box)
    const zoomDeltas = await stopFrameSampling(page)

    const pan = summarize(panDeltas)
    const zoom = summarize(zoomDeltas)
    console.log(
      `[frame-timeline] nodes=${DEFAULT_NODE_COUNT} env=${JSON.stringify(env)} ` +
        `heapLoaded=${JSON.stringify(heapLoaded)} heapAfterPan=${JSON.stringify(heapAfterPan)} ` +
        `pan=${pan.text} zoom=${zoom.text}`,
    )

    expect(pan.frames).toBeGreaterThanOrEqual(MIN_SAMPLED_FRAMES)
    expect(zoom.frames).toBeGreaterThanOrEqual(MIN_SAMPLED_FRAMES)
    expect(pan.p50).toBeLessThanOrEqual(PAN_P50_CEILING_MS)
    expect(zoom.p50).toBeLessThanOrEqual(ZOOM_P50_CEILING_MS)
    expect(pan.p95).toBeLessThanOrEqual(PAN_P95_CEILING_MS)
    expect(zoom.p95).toBeLessThanOrEqual(ZOOM_P95_CEILING_MS)
  })

  test('applies a type filter on the 5k corpus and re-renders', async ({ page }) => {
    test.setTimeout(180_000)
    const svg = page.locator('svg[aria-label^="Knowledge graph"]')

    await seedStore(page, { entities: buildSeededEntities(DEFAULT_NODE_COUNT) })
    await page.goto('/')
    await navClick(page, /graph/i)

    await expect(svg).toBeVisible()
    await waitForPlacement(page)

    await page.getByRole('button', { name: /^queries$/i }).click()
    await page.getByRole('checkbox', { name: 'Concept' }).check()

    const startedAt = Date.now()
    await waitForPlacement(page)
    const elapsedMs = Date.now() - startedAt

    const label = await svg.getAttribute('aria-label')
    const entityCount = Number(/with (\d+) entities/.exec(label ?? '')?.[1] ?? Number.NaN)
    expect(Number.isFinite(entityCount)).toBe(true)
    expect(entityCount).toBeGreaterThan(0)
    expect(entityCount).toBeLessThan(DEFAULT_NODE_COUNT)
    console.log(
      `[frame-timeline-filter] nodes=${DEFAULT_NODE_COUNT} → ${entityCount} entities in ${elapsedMs}ms`,
    )
  })
})

test.describe('Graph frame timeline size sweep (GRAPH_BENCH_SIZES)', () => {
  const sizes = readSweepSizes()
  for (const nodeCount of sizes) {
    test(`pan and zoom at ${nodeCount} nodes`, measureFrameTimeline(nodeCount))
  }
})
